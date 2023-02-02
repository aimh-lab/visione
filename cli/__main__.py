#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
import sys

from . import commands


if __name__ == "__main__":
    install_dir = Path(__file__).resolve(strict=True).parent.parent  # installation dir of VISIONE
    collection_dir = Path.cwd()  # data dir of current collection
    cache_dir = os.environ.get("XDG_CACHE_HOME", None) or Path.home() / '.cache'
    cache_dir = Path(cache_dir, 'visione')

    cmd_args = (install_dir, collection_dir, cache_dir)

    parser = argparse.ArgumentParser(description='Manage VISIONE instances')
    subparsers = parser.add_subparsers(help='command')

    commands.InitCommand  (*cmd_args).add_arguments(subparsers)
    commands.ImportCommand(*cmd_args).add_arguments(subparsers)

    if len(sys.argv) < 2:
        parser.print_usage()
        sys.exit(1)

    args = parser.parse_args()
    args = vars(args)
    func = args.pop('func')
    ret = func(**args)
    sys.exit(ret)