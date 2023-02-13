import importlib.resources
from pathlib import Path
import shutil
import subprocess

from .command import BaseCommand


class BuildCommand(BaseCommand):
    """ Implements the 'build' CLI command. """

    def __init__(self, *args, **kwargs):
        super(BuildCommand, self).__init__(*args, **kwargs)
    
    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('build', help='Build or rebuild services.')
        parser.add_argument('services', nargs='*', help='services to (re)build (defaults to all)')
        parser.set_defaults(func=self)
    
    def __call__(self, *, services):
        command = self.compose_cmd + ['build'] + services
        ret = subprocess.check_call(command, env=self.visione_env)
        return ret