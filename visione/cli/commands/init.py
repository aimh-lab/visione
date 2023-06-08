from pathlib import Path
import shutil

from .command import BaseCommand


def _get_skel_dir():
    try:  # Python < 3.9
        import importlib_resources
        return importlib_resources.files("visione.skel")._paths[0]
    except ImportError:  # Python >= 3.9
        import importlib.resources
        return Path(importlib.resources.files("visione.skel").joinpath(''))


class InitCommand(BaseCommand):
    """ Implements the 'init' CLI command. """

    def __init__(self, *args, **kwargs):
        super(InitCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('init', help='Create a new empty collection.')
        parser.add_argument('directory', nargs='?', type=Path, default=Path('.'), help='Directory to initialize (defaults to current directory)')
        parser.set_defaults(func=self)

    def __call__(self, *, directory, **kwargs):
        # FIXME config loading is in common command setup, but must be skipped for 'init'
        # super(InitCommand, InitCommand).__call__(self, **kwargs)

        skel = _get_skel_dir()
        # TODO manage already existing collection
        shutil.copytree(skel, directory, dirs_exist_ok=True)
        print(f"Initialzed VISIONE collection in {directory.absolute()}")
        return 0