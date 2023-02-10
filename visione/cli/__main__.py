#!/usr/bin/env python3
import argparse
import importlib.resources
import os
from pathlib import Path
import sys

from . import commands


def main():
    compose_dir = Path(importlib.resources.files("visione.services").joinpath(''))  # directory containing services for docker compose
    collection_dir = Path.cwd()  # data dir of current collection
    cache_dir = os.environ.get("XDG_CACHE_HOME", None) or Path.home() / '.cache'
    cache_dir = Path(cache_dir, 'visione')

    parser = argparse.ArgumentParser(description='Manage VISIONE instances')
    subparsers = parser.add_subparsers(help='command')

    for command in commands.available_commands:
        command(compose_dir, collection_dir, cache_dir).add_arguments(subparsers)

    if len(sys.argv) < 2:
        parser.print_usage()
        sys.exit(1)

    args = parser.parse_args()
    args = vars(args)
    func = args.pop('func')
    return func(**args)


if __name__ == "__main__":
    sys.exit(main())