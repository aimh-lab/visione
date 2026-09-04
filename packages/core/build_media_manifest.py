import argparse
import json
import traceback
from datetime import datetime, timezone
from pathlib import Path

from hydra import compose, initialize_config_dir
from hydra.utils import instantiate
from tqdm import tqdm

from media_manifest import build_manifest, update_manifest


DEFAULT_OUTPUT = (
    Path(__file__).parent.parent
    / "dataserver"
    / "nginx"
    / "generated"
    / "media.sqlite"
)


def _load_collection(loader_name, config_dir):
    with initialize_config_dir(config_dir=str(config_dir), version_base=None):
        config = compose(config_name="load", overrides=[f"loader={loader_name}"])
    return instantiate(config.loader, data_server_url=config.data.server_url)


COLLECTIONS = ("lsc", "lsc26", "v3c")


def _load_resource_groups(config_dir, collection_names=COLLECTIONS):
    groups = []
    totals = []
    for name in collection_names:
        loader = _load_collection(name, config_dir)
        groups.append((name, loader.iter_media_resources()))
        count = getattr(loader, "get_media_resource_count", None)
        totals.append(count() if count is not None else None)
    total = sum(totals) if all(count is not None for count in totals) else None
    return groups, total


def _track_resource_iterator(resources, progress_bar):
    for resource in resources:
        yield resource
        progress_bar.update()


def _track_resources(resource_groups, progress_bar):
    for name, resources in resource_groups:
        yield name, _track_resource_iterator(resources, progress_bar)


def main():
    parser = argparse.ArgumentParser(description="Build the dataserver media manifest")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--config-dir",
        type=Path,
        default=Path(__file__).parent / "configs",
    )
    parser.add_argument(
        "--collection",
        action="append",
        choices=COLLECTIONS,
        dest="collections",
        help="Update only this collection in an existing manifest; repeatable",
    )
    parser.add_argument(
        "--log",
        type=Path,
        help="Problem log path (default: replace the output suffix with .log)",
    )
    args = parser.parse_args()

    selected = (
        tuple(dict.fromkeys(args.collections))
        if args.collections
        else COLLECTIONS
    )
    log_path = (args.log or args.output.with_suffix(".log")).resolve()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log_file:
        def report(event):
            event = {"timestamp": datetime.now(timezone.utc).isoformat(), **event}
            log_file.write(json.dumps(event, sort_keys=True) + "\n")

        report(
            {
                "status": "started",
                "output": str(args.output.resolve()),
                "collections": list(selected),
            }
        )
        try:
            resource_groups, total = _load_resource_groups(args.config_dir, selected)
            with tqdm(
                total=total,
                desc="Building media manifest",
                unit="resource",
                unit_scale=True,
            ) as progress_bar:
                tracked_groups = _track_resources(resource_groups, progress_bar)
                if args.collections:
                    summary = update_manifest(
                        args.output,
                        tracked_groups,
                        selected,
                        issue_reporter=report,
                        status_reporter=progress_bar.set_description,
                    )
                else:
                    summary = build_manifest(
                        args.output,
                        tracked_groups,
                        issue_reporter=report,
                        status_reporter=progress_bar.set_description,
                    )
        except BaseException as exc:
            report(
                {
                    "status": "failed",
                    "error_type": type(exc).__name__,
                    "message": str(exc),
                    "traceback": traceback.format_exc(),
                }
            )
            raise
        report({"status": "completed", "summary": summary})
    print(json.dumps(summary, indent=2, sort_keys=True))
    print(f"Build log: {log_path}")


if __name__ == "__main__":
    main()
