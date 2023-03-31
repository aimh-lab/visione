import argparse
import subprocess

from .command import BaseCommand


class ComposeCommand(BaseCommand):
    """ Implements the 'compose' CLI command. """

    def __init__(self, *args, **kwargs):
        super(ComposeCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('compose', help='Execute compose commands in the compose project of the collection.')
        parser.add_argument('cmd', nargs=argparse.REMAINDER, help='compose command to execute')
        parser.set_defaults(func=self)

    def __call__(self, *, cmd, **kwargs):
        super(ComposeCommand, ComposeCommand).__call__(self, **kwargs)

        command = self.compose_cmd + cmd
        ret = subprocess.check_call(command, env=self.compose_env)
        return ret