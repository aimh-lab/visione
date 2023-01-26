from abc import ABC, abstractmethod


class BaseCommand(ABC):

    def __init__(self, install_dir, collection_dir):
        self.install_dir = install_dir
        self.collection_dir = collection_dir

    @abstractmethod
    def add_arguments(self, subparser):
        pass

    @abstractmethod
    def __call__(self):
        pass
