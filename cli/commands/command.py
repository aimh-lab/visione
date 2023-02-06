from abc import ABC, abstractmethod
import os


class BaseCommand(ABC):

    def __init__(self, install_dir, collection_dir, cache_dir):
        self.install_dir = install_dir
        self.collection_dir = collection_dir
        self.cache_dir = cache_dir

        self.visione_env = {
            'VISIONE_ROOT': self.collection_dir,
            'VISIONE_CACHE': self.cache_dir,
            **os.environ
        }

    @abstractmethod
    def add_arguments(self, subparser):
        pass

    @abstractmethod
    def __call__(self):
        pass
