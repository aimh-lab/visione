from pathlib import Path
import subprocess

from .command import BaseCommand


class ServeCommand(BaseCommand):
    """ Implements the 'serve' CLI command. """

    def __init__(self, *args, **kwargs):
        super(ServeCommand, self).__init__(*args, **kwargs)
    
    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('serve', help='Start the VISIONE server')
        parser.add_argument('-p', '--port', type=int, help='port to which the server will listen')
        parser.set_defaults(func=self)
    
    def __call__(self, *, port):
        command = [
            'docker-compose',
            '--project-directory', str(self.install_dir),
            '--env-file', str(self.collection_dir / 'config.env'),
            '--profile', 'query',
            'up',
            '--build'
        ]

        ret = subprocess.run(command, check=True, env=self.visione_env)
        return ret