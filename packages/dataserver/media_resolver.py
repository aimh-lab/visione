from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
from pathlib import Path
from urllib.parse import quote, urlencode

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response


class ManifestResolver:
    def __init__(self, manifest_path: str, allowed_roots: tuple[str, ...]):
        self.manifest_path = str(Path(manifest_path).resolve())
        self.allowed_roots = tuple(str(Path(root).resolve()) for root in allowed_roots)
        self._local = threading.local()
        connection = self._connect()
        metadata = dict(connection.execute("SELECT key, value FROM manifest_metadata"))
        if metadata.get("schema_version") != "1":
            raise RuntimeError("Unsupported or missing media manifest schema")
        connection.close()
        self.metadata = metadata

    def _connect(self):
        uri = Path(self.manifest_path).as_uri() + "?mode=ro&immutable=1"
        connection = sqlite3.connect(uri, uri=True, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _connection(self):
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = self._connect()
            self._local.connection = connection
        return connection

    def _validate_path(self, file_path):
        resolved = str(Path(file_path).resolve())
        if not any(
            os.path.commonpath((resolved, root)) == root for root in self.allowed_roots
        ):
            raise RuntimeError(f"Manifest path is outside allowed roots: {file_path}")
        return resolved

    def resolve(self, collection, resource_id, element_type, tpad=None):
        row = self._connection().execute(
            "SELECT f.path, f.media_kind, r.start_seconds, r.end_seconds "
            "FROM resources AS r JOIN files AS f USING(file_key) "
            "WHERE r.collection = ? AND r.resource_id = ? AND r.element_type = ?",
            (collection, resource_id, element_type),
        ).fetchone()
        if row is None:
            return None

        file_path = self._validate_path(row["path"])
        encoded_path = quote(file_path.lstrip("/"), safe="/-._~")
        redirect = f"/_media/{row['media_kind']}/{encoded_path}"
        if row["start_seconds"] is not None:
            try:
                padding = 0.0 if tpad is None else float(tpad)
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    "tpad must be a finite, non-negative number"
                ) from exc
            if not math.isfinite(padding) or padding < 0:
                raise ValueError("tpad must be a finite, non-negative number")
            start = max(0.0, row["start_seconds"] - padding)
            end = row["end_seconds"] + padding
            redirect += "?" + urlencode(
                {
                    "start": format(start, ".15g"),
                    "end": format(end, ".15g"),
                }
            )
        return redirect

    def discovery(self):
        rows = self._connection().execute(
            "SELECT collection, element_type FROM collection_types "
            "ORDER BY collection, element_type"
        )
        result = {}
        for collection, element_type in rows:
            result.setdefault(collection, []).append(element_type)
        return result

    def health(self):
        return {
            "status": "ok",
            "schema_version": self.metadata["schema_version"],
            "generated_at": self.metadata["generated_at"],
            "available_counts": json.loads(self.metadata["available_counts"]),
            "missing_counts": json.loads(self.metadata["missing_counts"]),
        }


def create_app(manifest_path=None, allowed_roots=None):
    path = manifest_path or os.environ.get(
        "MEDIA_MANIFEST_PATH", "/manifest/media.sqlite"
    )
    roots = allowed_roots or tuple(
        root
        for root in os.environ.get("MEDIA_ALLOWED_ROOTS", "/data1:/data2").split(":")
        if root
    )
    resolver = ManifestResolver(path, tuple(roots))
    application = FastAPI()

    @application.get("/resolve/{collection}/{resource_id}/{element_type}")
    def resolve(
        collection: str,
        resource_id: str,
        element_type: str,
        tpad: str | None = None,
    ):
        try:
            redirect = resolver.resolve(
                collection,
                resource_id,
                element_type,
                tpad=tpad,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        if redirect is None:
            raise HTTPException(status_code=404, detail="Media resource not found")
        return Response(headers={"X-Accel-Redirect": redirect})

    @application.get("/discovery")
    def discovery():
        return resolver.discovery()

    @application.get("/health")
    def health():
        return resolver.health()

    return application


def create_default_app():
    return create_app()
