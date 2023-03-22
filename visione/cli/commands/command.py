from abc import ABC, abstractmethod
from functools import partial
import os
import selectors
import shutil
import subprocess
import sys

from rich.console import Console

from ...services.common import load_config


class BaseCommand(ABC):

    def __init__(self, compose_dir, collection_dir, cache_dir):
        self.compose_dir = compose_dir
        self.collection_dir = collection_dir
        self.cache_dir = cache_dir

        self.config_file = None

    @abstractmethod
    def add_arguments(self, subparser):
        pass

    @abstractmethod
    def __call__(self, *, config_file, verbose):
        if self.config_file:  # avoid loading config again
            return

        # ensure cache folder exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)

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
            **config_env_vars,
            'VISIONE_ROOT': self.collection_dir,
            'VISIONE_CACHE': self.cache_dir,
        }

        self.develop_mode = self.config['main'].get('develop_mode', False)
        self.verbose = verbose

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

        if self.develop_mode:
            compose_files += [
                '--file', str(self.compose_dir / 'devel-options.yaml'),  # for development
            ]

        self.compose_cmd = compose_executable + compose_files + [
            '--project-directory', str(self.compose_dir),
            '--project-name', str(self.collection_dir.name),
        ]

        self.compose_run_cmd = self.compose_cmd + [
            'run',
            '--rm',
            '--no-deps',
            '--user', f'{os.getuid()}:{os.getgid()}',
        ]

    def compose_run(self, service_name, service_command, stdout_callback=None, stderr_callback=None, **run_kws):
        command = self.compose_run_cmd + [service_name] + service_command

        if self.verbose:
            print(f"Running: {' '.join(command)}")
            stdout_callback = stdout_callback or partial(print, end='')
            stderr_callback = stderr_callback or partial(print, end='')

        popen_kws = dict(
            text='utf8',
            bufsize=0,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=self.compose_env,
        )
        with subprocess.Popen(command, **popen_kws) as service_process, selectors.DefaultSelector() as selector:
            selector.register(service_process.stdout, selectors.EVENT_READ, stdout_callback)
            selector.register(service_process.stderr, selectors.EVENT_READ, stderr_callback)

            while selector.get_map():
                for key, mask in selector.select():
                    line = key.fileobj.readline()
                    if not line:
                        selector.unregister(key.fileobj)
                        continue

                    callback = key.data
                    if callback:
                        callback(line)

            return service_process.returncode

    def is_gpu_available(self):
        # FIXME we are assuming nvidia-smi is installed on systems with GPU(s)
        if shutil.which('nvidia-smi') is None:
            return False

        try:
            command = "nvidia-smi --list-gpus | wc -l"
            gpus = subprocess.check_output(command, shell=True, text='utf8')
            return int(gpus) > 0

        except Exception:
            return False
    
    def create_services_containers(self, profiles=None):
        profiles = profiles or ()
        profiles = profiles if isinstance(profiles, (list, tuple)) else (profiles,)

        command = self.compose_cmd.copy()

        for profile in profiles:
            command += ['--profile', profile]

        command += [
            'up',
            '--no-start',
            '--no-recreate',
            '--remove-orphans',
        ]

        return subprocess.run(command, env=self.compose_env, check=True)

    
    def progress_callback(self, progress, task_id):
        def _func(line, **kwargs):
            if line.startswith('progress:'):
                completed, total = map(int, line[len('progress:'):].strip().split('/'))
                total = total if total >= 0 else None
                progress.update(task_id, completed=completed, total=total)

            if self.verbose:
                print(line, end='', **kwargs)
        return _func