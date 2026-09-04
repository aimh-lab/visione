from __future__ import annotations

import json
import math
import os
import shutil
import sqlite3
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

from loaders.media import MediaResource


SCHEMA_VERSION = "1"


class InvalidVideoBoundsError(ValueError):
    pass


def _validate_resource(resource: MediaResource) -> None:
    for label, value in (
        ("collection", resource.collection),
        ("resource_id", resource.resource_id),
        ("element_type", resource.element_type),
        ("file_key", resource.file_key),
    ):
        if not value or "/" in value or "\x00" in value:
            raise ValueError(f"Invalid {label}: {value!r}")
    if resource.media_kind not in {"image", "video"}:
        raise ValueError(f"Invalid media kind: {resource.media_kind!r}")
    if resource.file_path is not None:
        if not os.path.isabs(resource.file_path):
            raise ValueError(f"Media path must be absolute: {resource.file_path!r}")
        if "\x00" in resource.file_path:
            raise ValueError("Media path contains a null byte")
    bounds = (resource.start_seconds, resource.end_seconds)
    if any(value is not None for value in bounds):
        if resource.media_kind != "video" or any(value is None for value in bounds):
            raise ValueError("Only videos may have complete start/end bounds")
        if (
            not math.isfinite(resource.start_seconds)
            or not math.isfinite(resource.end_seconds)
            or resource.start_seconds < 0
            or resource.end_seconds <= resource.start_seconds
        ):
            raise InvalidVideoBoundsError(
                f"Invalid video bounds for {resource.resource_id!r}"
            )


def _create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE files (
            file_key TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video'))
        ) WITHOUT ROWID;

        CREATE TABLE resources (
            collection TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            element_type TEXT NOT NULL,
            file_key TEXT NOT NULL REFERENCES files(file_key),
            start_seconds REAL,
            end_seconds REAL,
            PRIMARY KEY (collection, resource_id, element_type),
            CHECK (
                (start_seconds IS NULL AND end_seconds IS NULL)
                OR
                (start_seconds >= 0 AND end_seconds > start_seconds)
            )
        ) WITHOUT ROWID;

        CREATE INDEX resources_file_key_idx ON resources(file_key);

        CREATE TABLE manifest_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE collection_types (
            collection TEXT NOT NULL,
            element_type TEXT NOT NULL,
            PRIMARY KEY (collection, element_type)
        ) WITHOUT ROWID;

        CREATE TRIGGER reject_file_key_conflict
        BEFORE INSERT ON files
        WHEN EXISTS (
            SELECT 1 FROM files
            WHERE file_key = NEW.file_key
              AND (path != NEW.path OR media_kind != NEW.media_kind)
        )
        BEGIN
            SELECT RAISE(ABORT, 'conflicting file key');
        END;
        """
    )


def _insert_resources(
    connection,
    resource_groups,
    progress,
    allowed_collections=None,
    issue_reporter=None,
):
    available = Counter()
    missing = Counter()
    collection_types = set()
    reported_missing_files = set()
    last_file = None
    processed = 0
    for group_name, resources in resource_groups:
        for resource in resources:
            processed += 1
            if progress is not None and processed % 100_000 == 0:
                progress(processed)
            if (
                allowed_collections is not None
                and resource.collection not in allowed_collections
            ):
                raise ValueError(
                    f"Resource collection {resource.collection!r} is not selected"
                )
            counter_key = f"{resource.collection}:{resource.element_type}"
            try:
                _validate_resource(resource)
            except InvalidVideoBoundsError as exc:
                missing[counter_key] += 1
                if issue_reporter is not None:
                    issue_reporter(
                        {
                            "status": "ignored",
                            "reason": "invalid_video_bounds",
                            "message": str(exc),
                            "collection": resource.collection,
                            "resource_id": resource.resource_id,
                            "element_type": resource.element_type,
                            "file_key": resource.file_key,
                            "file_path": resource.file_path,
                            "start_seconds": resource.start_seconds,
                            "end_seconds": resource.end_seconds,
                        }
                    )
                continue
            if resource.file_path is None or not os.path.isfile(resource.file_path):
                missing[counter_key] += 1
                missing_file = (
                    resource.file_key,
                    resource.file_path,
                    resource.media_kind,
                )
                if (
                    issue_reporter is not None
                    and missing_file not in reported_missing_files
                ):
                    issue_reporter(
                        {
                            "status": "ignored",
                            "reason": "missing_file",
                            "collection": resource.collection,
                            "resource_id": resource.resource_id,
                            "element_type": resource.element_type,
                            "file_key": resource.file_key,
                            "file_path": resource.file_path,
                            "media_kind": resource.media_kind,
                        }
                    )
                    reported_missing_files.add(missing_file)
                continue
            current_file = (
                resource.file_key,
                resource.file_path,
                resource.media_kind,
            )
            if current_file != last_file:
                connection.execute(
                    "INSERT OR IGNORE INTO files(file_key, path, media_kind) "
                    "VALUES (?, ?, ?)",
                    current_file,
                )
                last_file = current_file
            try:
                connection.execute(
                    "INSERT INTO resources("
                    "collection, resource_id, element_type, file_key, "
                    "start_seconds, end_seconds"
                    ") VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        resource.collection,
                        resource.resource_id,
                        resource.element_type,
                        resource.file_key,
                        resource.start_seconds,
                        resource.end_seconds,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError(
                    "Conflicting media resource "
                    f"{resource.collection}/{resource.resource_id}/"
                    f"{resource.element_type} from {group_name}"
                ) from exc
            available[counter_key] += 1
            collection_types.add((resource.collection, resource.element_type))
    return available, missing, collection_types


def _store_metadata(connection, available, missing, generated_at):
    metadata = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "available_counts": json.dumps(dict(sorted(available.items()))),
        "missing_counts": json.dumps(dict(sorted(missing.items()))),
    }
    connection.executemany(
        "INSERT INTO manifest_metadata(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        metadata.items(),
    )


def _create_temp_path(destination):
    temp_file = tempfile.NamedTemporaryFile(
        prefix=f".{destination.name}.",
        suffix=".tmp",
        dir=destination.parent,
        delete=False,
    )
    temp_path = Path(temp_file.name)
    temp_file.close()
    return temp_path


def build_manifest(
    output_path: str | os.PathLike[str],
    resource_groups: Iterable[tuple[str, Iterable[MediaResource]]],
    progress: Callable[[int], None] | None = None,
    allowed_collections: set[str] | None = None,
    issue_reporter: Callable[[dict], None] | None = None,
    status_reporter: Callable[[str], None] | None = None,
) -> dict:
    destination = Path(output_path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = _create_temp_path(destination)
    connection = None
    try:
        connection = sqlite3.connect(temp_path)
        connection.execute("PRAGMA journal_mode=OFF")
        connection.execute("PRAGMA synchronous=OFF")
        connection.execute("PRAGMA foreign_keys=ON")
        _create_schema(connection)

        available, missing, collection_types = _insert_resources(
            connection,
            resource_groups,
            progress,
            allowed_collections=allowed_collections,
            issue_reporter=issue_reporter,
        )

        generated_at = datetime.now(timezone.utc).isoformat()
        _store_metadata(connection, available, missing, generated_at)
        connection.executemany(
            "INSERT INTO collection_types(collection, element_type) VALUES (?, ?)",
            sorted(collection_types),
        )
        if status_reporter is not None:
            status_reporter("Validating media manifest")
        foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_errors:
            raise ValueError(f"Manifest has foreign-key errors: {foreign_key_errors[:5]}")
        if status_reporter is not None:
            status_reporter("Committing media manifest")
        connection.commit()
        connection.close()
        connection = None
        os.replace(temp_path, destination)
        return {
            "path": str(destination),
            "generated_at": generated_at,
            "available": dict(sorted(available.items())),
            "missing": dict(sorted(missing.items())),
        }
    except BaseException:
        if connection is not None:
            connection.close()
        temp_path.unlink(missing_ok=True)
        raise


def update_manifest(
    output_path: str | os.PathLike[str],
    resource_groups: Iterable[tuple[str, Iterable[MediaResource]]],
    collections: Iterable[str],
    progress: Callable[[int], None] | None = None,
    issue_reporter: Callable[[dict], None] | None = None,
    status_reporter: Callable[[str], None] | None = None,
) -> dict:
    destination = Path(output_path).resolve()
    selected = tuple(dict.fromkeys(collections))
    if not selected:
        raise ValueError("At least one collection must be selected")
    if any(not name or "/" in name or "\x00" in name for name in selected):
        raise ValueError(f"Invalid collection selection: {selected!r}")
    if not destination.is_file():
        summary = build_manifest(
            destination,
            resource_groups,
            progress=progress,
            allowed_collections=set(selected),
            issue_reporter=issue_reporter,
            status_reporter=status_reporter,
        )
        summary["updated_collections"] = list(selected)
        return summary

    temp_path = _create_temp_path(destination)
    connection = None
    try:
        if status_reporter is not None:
            status_reporter("Copying existing manifest")
        shutil.copy2(destination, temp_path)
        connection = sqlite3.connect(temp_path)
        connection.execute("PRAGMA journal_mode=OFF")
        connection.execute("PRAGMA synchronous=OFF")
        connection.execute("PRAGMA foreign_keys=ON")
        metadata = dict(
            connection.execute("SELECT key, value FROM manifest_metadata")
        )
        if metadata.get("schema_version") != SCHEMA_VERSION:
            raise ValueError("Unsupported or missing media manifest schema")

        # Version 1 manifests created before this index was introduced need it
        # for orphan cleanup. Without it, the correlated lookup below becomes
        # prohibitively expensive for multi-million-row collections.
        if status_reporter is not None:
            status_reporter("Indexing existing manifest")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS resources_file_key_idx "
            "ON resources(file_key)"
        )

        if status_reporter is not None:
            status_reporter("Removing previous collection records")
        placeholders = ",".join("?" for _ in selected)
        connection.execute(
            f"DELETE FROM resources WHERE collection IN ({placeholders})",
            selected,
        )
        connection.execute(
            f"DELETE FROM collection_types WHERE collection IN ({placeholders})",
            selected,
        )
        connection.execute(
            "DELETE FROM files WHERE NOT EXISTS ("
            "SELECT 1 FROM resources WHERE resources.file_key = files.file_key)"
        )

        if status_reporter is not None:
            status_reporter("Building media manifest")
        new_available, new_missing, new_types = _insert_resources(
            connection,
            resource_groups,
            progress,
            allowed_collections=set(selected),
            issue_reporter=issue_reporter,
        )
        connection.executemany(
            "INSERT INTO collection_types(collection, element_type) VALUES (?, ?)",
            sorted(new_types),
        )
        if status_reporter is not None:
            status_reporter("Removing orphaned file records")
        connection.execute(
            "DELETE FROM files WHERE NOT EXISTS ("
            "SELECT 1 FROM resources WHERE resources.file_key = files.file_key)"
        )

        available = Counter(json.loads(metadata.get("available_counts", "{}")))
        missing = Counter(json.loads(metadata.get("missing_counts", "{}")))
        for counts in (available, missing):
            for key in list(counts):
                if key.partition(":")[0] in selected:
                    del counts[key]
        available.update(new_available)
        missing.update(new_missing)
        generated_at = datetime.now(timezone.utc).isoformat()
        _store_metadata(connection, available, missing, generated_at)

        if status_reporter is not None:
            status_reporter("Validating media manifest")
        foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_key_errors:
            raise ValueError(f"Manifest has foreign-key errors: {foreign_key_errors[:5]}")
        if status_reporter is not None:
            status_reporter("Committing media manifest")
        connection.commit()
        connection.close()
        connection = None
        os.replace(temp_path, destination)
        return {
            "path": str(destination),
            "generated_at": generated_at,
            "updated_collections": list(selected),
            "available": dict(sorted(available.items())),
            "missing": dict(sorted(missing.items())),
        }
    except BaseException:
        if connection is not None:
            connection.close()
        temp_path.unlink(missing_ok=True)
        raise
