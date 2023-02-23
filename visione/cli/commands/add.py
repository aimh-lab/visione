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
        parser.add_argument('video_id', help='ID of the video to be added.')
        parser.add_argument('video_path_or_url', help='Path or URL to video file to be added.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing video and analyses.')
        parser.set_defaults(func=self)

    def __call__(self, *, config_file, video_id, video_path_or_url, replace):
        common = dict(config_file=config_file, replace=replace)

        ImportCommand.__call__(self, video_id=video_id, video_path_or_url=video_path_or_url, **common)
        AnalyzeCommand.__call__(self, video_ids=[video_id], **common)
        IndexCommand.__call__(self, video_ids=[video_id], **common)