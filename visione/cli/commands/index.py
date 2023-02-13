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

        # generate surrogate text representation of features
        self.str_encode_features(video_id, 'clip-laion-CLIP-ViT-H-14-laion2B-s32B-b79K', force=replace)
        self.str_encode_features(video_id, 'clip-openai-clip-vit-large-patch14', force=replace)
        self.str_encode_features(video_id, 'gem', force=replace)

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

    def str_encode_features(self, video_id, features_name, force=False):
        """ Encodes feature vectors of each selected frame of a video with surrogate text representations.

        Args:
            video_id (str): Input Video ID.
            features_name (str): Name of the features to encode.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        input_file = self.collection_dir / f'{features_name}' / video_id / f'{video_id}-{features_name}.hdf5'

        str_encoder_file = self.collection_dir / f'str-features-encoder-{features_name}.pkl'

        str_features_dir = self.collection_dir / 'str-features' / video_id
        str_features_dir.mkdir(parents=True, exist_ok=True)
        str_features_file = str_features_dir / f'{video_id}-str-features-{features_name}.jsonl.gz'

        if not force and str_features_file.exists():
            print(f'Skipping STR features encoding, using existing file:', str_features_file.name)
            return 0

        input_file = '/data' / input_file.relative_to(self.collection_dir)
        str_encoder_file = '/data' / str_encoder_file.relative_to(self.collection_dir)
        str_output_file = '/data' / str_features_file.relative_to(self.collection_dir)

        service = 'str-feature-encoder'
        command = [
            'python', 'encode.py',
            '--save-every', '200',
        ] + (['--force', '--force-encoder'] if force else []) + [
            str(input_file),
            str(str_encoder_file),
            str(str_output_file),
        ]

        return self.compose_run(service, command)

    def prepare_lucene_doc(self, video_id, force=False):
        """ Merges jsonl.gz document into a unique doc ready to be indexed by Lucene.

        Args:
            video_id (str): Input Video ID.
            force (bool, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.
        
        Returns:
            # TODO
        """

        lucene_documents_dir = self.collection_dir / 'lucene-documents' / video_id
        lucene_documents_dir.mkdir(parents=True, exist_ok=True)
        lucene_documents_file = lucene_documents_dir / f'{video_id}-lucene-doc.jsonl.gz'

        if not force and lucene_documents_file.exists():
            print(f'Skipping Lucene document merging, using existing file:', lucene_documents_file.name)
            return 0

        # prepare scene fields of records
        scenes_file = self.collection_dir / 'selected-frames' / video_id / f'{video_id}-scenes.csv'

        def map_scenes(csv_path):
            with open(csv_path, newline='') as csvfile:
                for row in csv.DictReader(csvfile):
                    yield {
                        "startframe": int(row["Start Frame"]),
                        "endframe": int(row["End Frame"]),
                        "middleframe": (int(row["Start Frame"]) + int(row["End Frame"])) // 2,  # TODO check correctness
                        "starttime": float(row["Start Time (seconds)"]),
                        "endtime": float(row["End Time (seconds)"]),
                        "middletime": (float(row["Start Time (seconds)"]) + float(row["End Time (seconds)"])) / 2,  # TODO check correctness
                    }
        
        scene_docs = map_scenes(scenes_file)

        # prepare objects fields of records
        str_objects_file = self.collection_dir / 'str-objects' / video_id / f'{video_id}-str-objects.jsonl.gz'

        def map_objects(jsonlgz_path):
            with gzip.open(jsonlgz_path, 'rt') as records:
                records = map(str.rstrip, records)
                records = map(json.loads, records)
                # insert mappings / processing here when needed
                yield from records

        str_object_docs = map_objects(str_objects_file)

        # prepare features fields of records
        str_features_dir = self.collection_dir / 'str-features' / video_id
        str_features_files = str_features_dir.glob(f'{video_id}-str-features-*.jsonl.gz')
        str_features_files = sorted(str_features_files)

        def map_features(jsonlgz_path):
            features_name = jsonlgz_path.name[len(f'{video_id}-str-features-'):-len('.jsonl.gz')]
            with gzip.open(jsonlgz_path, 'rt') as records:
                records = map(str.rstrip, records)
                records = map(json.loads, records)
                # insert mappings / processing here when needed
                def rename(r):
                    r[f'features_{features_name}_str'] = r.pop('feature_str')
                    return r
                records = map(rename, records)
                yield from records

        str_feature_docs = map(map_features, str_features_files)

        # merge fields into single documents
        str_documents = [str_object_docs, *str_feature_docs]

        def merge_docs(docs):
            for records in zip(*docs):
                merged_record = dict(collections.ChainMap(*records))
                yield merged_record

        records = merge_docs(str_documents)

        # FIXME remove when legacy fieldnames will be changed
        # add/rename fields
        def fix_fieldnames(record):
            # ids
            _id = record.pop('_id')
            record['imgID'] = record['visioneid'] = _id
            record['videoID'] = video_id
            record['collection'] = 'collection'

            # object fields
            record['txt'] = record.pop('object_box_str')
            record['objects'] = record.pop('object_count_str')
            record['objectsinfo'] = record.pop('object_info')

            # features
            record['features'] = record.pop('features_gem_str')
            # record['aladin'] = record.pop('features_aladin_str')
        
        records = map(fix_fieldnames, records)

        # save merged jsonl.gz file
        with gzip.open(lucene_documents_file, 'wt') as out:
            for record in tqdm(records, desc='Creating Lucene Docs'):
                out.write(json.dumps(record) + '\n')

    
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