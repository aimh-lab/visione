from pathlib import Path
import signal
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

    def __call__(self, *, port, **kwargs):
        super(ServeCommand, ServeCommand).__call__(self, **kwargs)

        # selects mandatory services needed to respond to queries
        profile_options = ['--profile', 'query']

        # figure out which optional services are also needed;
        # each optional service is contained in a profile named as the service
        enabled_features = self.config.get('analysis', {}).get('features', {}).keys()
        optional_services = [f'features-{f}' for f in enabled_features]
        for service in optional_services:
            profile_options.extend(['--profile', service])

        command = self.compose_cmd + profile_options + ['up']

        if port:
            self.compose_env['VISIONE_PORT'] = str(port)

        process = subprocess.Popen(command, env=self.compose_env)

        # forward CTRL+Cs to subprocess
        signal.signal(signal.SIGINT, lambda s, f: process.send_signal(s))

        ret = process.wait()
        return ret