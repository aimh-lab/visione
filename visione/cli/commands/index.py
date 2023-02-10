import json
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

from tqdm import tqdm

from .command import BaseCommand


class IndexCommand(BaseCommand):
    """ Implements the 'import' CLI command. """

    def __init__(self, *args, **kwargs):
        super(IndexCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('index', help='Create an index entry for imported videos.')
        parser.add_argument('--id', dest='video_id', default=None, help='Video ID. If None, take the filename without extension as ID.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing index entry.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_id, replace):
        # TODO handle (video_id == None) case

        # generate surrogate text representation of objects & colors
        self.str_encode_objects(video_id, force=replace)

        # push to index
        self.add_to_index(video_id, force=True)

    def str_encode_objects(self, video_id, force=False):
        """ Encodes colors, detected objects, and their count of each selected frame of a video with surrogate text representations.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        str_objects_dir = self.collection_dir / 'str-objects' / video_id
        str_objects_dir.mkdir(parents=True, exist_ok=True)
        str_objects_file = str_objects_dir / f'{video_id}-str-objects.jsonl.gz'

        count_objects_dir = self.collection_dir / 'count-objects' / video_id
        count_objects_dir.mkdir(parents=True, exist_ok=True)
        count_objects_file = count_objects_dir / f'{video_id}-count-objects.json'

        if not force and str_objects_file.exists() and count_objects_file.exists():
            print(f'Skipping STR object encoding, using existing file:', str_objects_file.name, count_objects_file.name)
            return 0

        detectors = self.collection_dir.glob('objects-*')
        detectors = [d.name[len('objects-'):] for d in detectors]
        input_files = [self.collection_dir / f'objects-{d}' / video_id / f'{video_id}-objects-{d}.jsonl.gz' for d in detectors]
        input_files = ['/data' / p.relative_to(self.collection_dir) for p in input_files]
        input_files = map(str, input_files)
        input_files = sorted(input_files)

        str_output_file = '/data' / str_objects_file.relative_to(self.collection_dir)
        count_output_file = '/data' / count_objects_file.relative_to(self.collection_dir)

        service = 'str-object-encoder'
        command = [
            'python', 'encode.py',
            '--save-every', '200',
        ] + (['--force'] if force else []) + [   
            str(str_output_file),
            str(count_output_file),
        ] + input_files

        return self.compose_run(service, command)

    def add_to_index(self, video_id, force=False):
        """ Adds the analyzed frames of a video to the collection index.
            
        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.

        Returns:
            # TODO
        """

        str_objects_file = self.collection_dir / 'str-objects' / video_id /  f'{video_id}-str-objects.jsonl.gz'
        scenes_file = self.collection_dir / 'selected-frames' / video_id / f'{video_id}-scenes.csv'
        lucene_index_dir = self.collection_dir / 'lucene-index'
        
        if not force and lucene_index_dir.exists():
            print(f'Skipping indexing in Lucene, using existing index:', lucene_index_dir.name)
            return 0

        input_file = '/data' / str_objects_file.relative_to(self.collection_dir)
        scenes_file = '/data' / scenes_file.relative_to(self.collection_dir)
        output_dir = '/data' / lucene_index_dir.relative_to(self.collection_dir)

        service = 'lucene-index-builder'
        command = [
            # 'java', '-jar', 'lucene-index-builder.jar',  # this is already in the ENTRYPOINT
            '--save-every', '200',  # TODO currently not used
        ] + (['--force'] if force else []) + [   
            str(input_file),
            str(scenes_file),
            video_id,
            str(output_dir),
        ]

        return self.compose_run(service, command)