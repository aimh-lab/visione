from abc import ABC, abstractmethod
import os
import shutil
import subprocess

from ...services.common import load_config


class BaseCommand(ABC):

    def __init__(self, compose_dir, collection_dir, cache_dir):
        self.compose_dir = compose_dir
        self.collection_dir = collection_dir
        self.cache_dir = cache_dir

    @abstractmethod
    def add_arguments(self, subparser):
        pass

    @abstractmethod
    def __call__(self, config_file):
        # load config
        self.config_file = config_file or (self.collection_dir / 'config.yaml')

        abs_config_path = str(self.config_file.resolve())
        abs_collection_path = str(self.collection_dir.resolve())
        assert abs_config_path.startswith(abs_collection_path), "--config-file must point to a file contained in the collection directory."

        assert self.config_file.exists(), f"Config file not found: {self.config_file}. Are you in a VISIONE collection folder?"
        self.config = load_config(self.config_file)

        config_env_vars = {}
        config_env_vars.update({f'VISIONE_{k.upper()}': str(v) for k, v in self.config['main'].items()})
        config_env_vars.update({f'VISIONE_{k.upper()}': str(v) for k, v in self.config['static_files_urls'].items()})
        config_env_vars.update({f'VISIONE_{k.upper()}': str(v) for k, v in self.config['services_urls'].items()})

        self.compose_env = {
            **os.environ,
            **config_env_vars,
            'VISIONE_ROOT': self.collection_dir,
            'VISIONE_CACHE': self.cache_dir,
        }

        self._find_docker_compose_executable()


    def _find_docker_compose_executable(self):
        # check if docker executable is available
        if shutil.which('docker') is None:
            raise RuntimeError("'docker' executable not found. Do you have docker installed?")

        # check if docker is already shipped with compose v2
        ret_code = subprocess.call(['docker', 'compose'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        compose_v2 = ret_code == 0

        # check if the separate docker-compose executable is available
        compose_v1 = shutil.which('docker-compose') is not None

        if compose_v2:
            compose_executable = ['docker', 'compose']
        elif compose_v1:
            compose_executable = ['docker-compose']
        else:
            raise RuntimeError("Docker Compose not found. Install the 'docker-compose' executable or upgrade docker to a version that ships the 'compose' subcommand.")

        compose_files = [
            '--file', str(self.compose_dir / 'docker-compose.yaml'),
            '--file', str(self.compose_dir / 'analysis-services.yaml'),
            '--file', str(self.compose_dir / 'index-services.yaml'),
        ]

        self.compose_cmd = compose_executable + compose_files + [
            '--project-directory', str(self.compose_dir),
            '--project-name', str(self.collection_dir.name),
        ]

        self.compose_run_cmd = self.compose_cmd + [
            'run',
            '--rm',
            '--no-deps',
        ]

    def compose_run(self, service_name, service_command):
        command = self.compose_run_cmd + [service_name] + service_command
        ret = subprocess.run(command, check=True, env=self.compose_env)
        return ret
