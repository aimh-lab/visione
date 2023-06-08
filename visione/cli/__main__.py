#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
import sys

try:
    # Python < 3.9
    import importlib_resources
    def _get_compose_dir():
        return importlib_resources.files("visione.services")._paths[0]

except ImportError:
    import importlib.resources
    def _get_compose_dir():
        return Path(importlib.resources.files("visione.services").joinpath(''))

from . import commands


def main():
    compose_dir = _get_compose_dir()  # directory containing services for docker compose
    collection_dir = Path.cwd()  # data dir of current collection
    cache_dir = os.environ.get("XDG_CACHE_HOME", None) or Path.home() / '.cache'
    cache_dir = Path(cache_dir, 'visione')

    parser = argparse.ArgumentParser(description='Manage VISIONE instances')
    parser.add_argument('--config-file', type=Path, help="path to YAML config file to use. It must be inside the collection directory. Defaults to 'config.yaml' in the collection directory.")
    parser.add_argument('--verbose', '-v', action='store_true', help="Show verbose output. Useful for debugging.")
    subparsers = parser.add_subparsers(help='command')

    for command in commands.available_commands:
        command(compose_dir, collection_dir, cache_dir).add_arguments(subparsers)

    if len(sys.argv) < 2:
        parser.print_usage()
        sys.exit(1)

    args = parser.parse_args()
    args = vars(args)
    func = args.pop('func')
    ret = func(**args)
    ret = ret if isinstance(ret, int) else 0
    return ret


if __name__ == "__main__":
    sys.exit(main())