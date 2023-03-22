from tqdm import tqdm

from .analyze import AnalyzeCommand
from .command import BaseCommand
from .import_ import ImportCommand
from .index import IndexCommand


class AddCommand(ImportCommand, AnalyzeCommand, IndexCommand):
    """ Implements the 'add' CLI command. """

    def __init__(self, *args, **kwargs):
        super(AddCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('add', help='Imports, analyzes, and adds a video to the collection index')
        parser.add_argument('--id', dest='video_id', help='Video ID. If None, take the filename without extension as ID.')
        parser.add_argument('video_path_or_url', help='Path or URL to video file to be added.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing video and analyses.')
        parser.add_argument('--no-gpu', dest='gpu', default=self.is_gpu_available(), action='store_false', help='Do not use the GPU if available.')

        parser.set_defaults(func=self)

    def __call__(self, *, video_id, video_path_or_url, replace, **kwargs):
        gpu = kwargs.pop('gpu')
        common = dict(replace=replace, **kwargs)

        video_id = ImportCommand.__call__(self, video_id=video_id, video_path_or_url=video_path_or_url, **common)
        AnalyzeCommand.__call__(self, video_ids=[video_id], gpu=gpu, **common)
        IndexCommand.__call__(self, video_ids=[video_id], **common)