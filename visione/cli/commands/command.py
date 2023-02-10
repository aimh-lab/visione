from abc import ABC, abstractmethod
import os
import shutil
import subprocess


class BaseCommand(ABC):

    def __init__(self, compose_dir, collection_dir, cache_dir):
        self.compose_dir = compose_dir
        self.collection_dir = collection_dir
        self.cache_dir = cache_dir

        self.visione_env = {
            'VISIONE_ROOT': self.collection_dir,
            'VISIONE_CACHE': self.cache_dir,
            **os.environ
        }

        self._find_docker_compose_executable()

    @abstractmethod
    def add_arguments(self, subparser):
        pass

    @abstractmethod
    def __call__(self):
        pass

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

        self.compose_cmd = compose_executable + [
            '--project-directory', str(self.compose_dir),
            '--env-file', str(self.collection_dir / 'config.env'),
        ]
            
        self.compose_run_cmd = self.compose_cmd + [
            'run',
            '--rm',
            '--no-deps',
        ]

    def compose_run(self, service_name, service_command):
        command = self.compose_run_cmd + [service_name] + service_command
        ret = subprocess.run(command, check=True, env=self.visione_env)
        return ret
