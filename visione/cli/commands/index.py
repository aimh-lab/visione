import collections
import csv
import gzip
import json

from tqdm import tqdm

from .command import BaseCommand


class IndexCommand(BaseCommand):
    """ Implements the 'index' CLI command. """

    def __init__(self, *args, **kwargs):
        super(IndexCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('index', help='Create an index entry for imported videos.')
        parser.add_argument('--id', dest='video_ids', nargs='+', default=(), help='Video ID(s) to be indexed. If not given, proceeds on all analyzed videos.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing index entry.')
        parser.set_defaults(func=self)

    def __call__(self, *, config_file, video_ids, replace):
        super(IndexCommand, self).__call__(config_file)

        index_config = self.config.get('index', {})

        if len(video_ids) == 0:
            thumb_dir = self.collection_dir / 'selected-frames'
            video_ids = [p.name for p in thumb_dir.iterdir() if p.is_dir()]

        for video_id in tqdm(video_ids, desc="Indexing"):
            # generate surrogate text representation of objects & colors
            str_objects = index_config.get('objects', {})
            if str_objects:
                self.str_encode_objects(video_id, force=replace)

            # generate surrogate text representation of features
            indexed_features = index_config.get('features', {})
            str_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'str']
            for features_name in str_features:
                self.str_encode_features(video_id, features_name, force=replace)

            # push to Lucene index
            if str_objects or str_features:
                self.prepare_lucene_doc(video_id, force=replace)
                self.add_to_lucene_index(video_id, force=replace)

            faiss_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'faiss']
            for features_name in faiss_features:
                self.add_to_faiss_index(video_id, features_name, force=True)

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
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        service = 'str-object-encoder'
        command = [
            'python', 'encode.py',
            '--config-file', str(config_file),
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

        input_file = self.collection_dir / f'features-{features_name}' / video_id / f'{video_id}-{features_name}.hdf5'

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
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        service = 'str-feature-encoder'
        command = [
            'python', 'encode.py',
            '--config-file', str(config_file),
            '--save-every', '200',
        ] + (['--force'] if force else []) + [
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
        lucene_documents_file = lucene_documents_dir / f'{video_id}-lucene-docs.jsonl.gz'

        if not force and lucene_documents_file.exists():
            print(f'Skipping Lucene document creation, using existing file:', lucene_documents_file.name)
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

        # prepare frames cluster codes
        clusters_file = self.collection_dir / 'cluster-codes' / video_id / f'{video_id}-cluster-codes.jsonl.gz'
        cluster_docs = map_objects(clusters_file)

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
        str_documents = [
            scene_docs,
            str_object_docs,
            cluster_docs,
            *str_feature_docs
        ]

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
            return record

        records = map(fix_fieldnames, records)

        # save merged jsonl.gz file
        with gzip.open(lucene_documents_file, 'wt') as out:
            for record in tqdm(records, desc='Creating Lucene Docs'):
                out.write(json.dumps(record) + '\n')

    def add_to_lucene_index(self, video_id, force=False):
        """ Adds the analyzed frames of a video to the collection index.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.

        Returns:
            # TODO
        """

        documents_file = self.collection_dir / 'lucene-documents' / video_id /  f'{video_id}-lucene-docs.jsonl.gz'
        lucene_index_dir = self.collection_dir / 'lucene-index'

        if not force and lucene_index_dir.exists():
            print(f'Skipping indexing in Lucene, using existing index:', lucene_index_dir.name)
            return 0

        input_file = '/data' / documents_file.relative_to(self.collection_dir)
        output_dir = '/data' / lucene_index_dir.relative_to(self.collection_dir)

        service = 'lucene-index-builder'
        command = [
            # 'java', '-jar', 'lucene-index-builder.jar',  # this is already in the ENTRYPOINT
            '--save-every', '200',  # FIXME currently not used
        ] + (['--force'] if force else []) + [
            str(input_file),
            video_id,
            str(output_dir),
        ]

        return self.compose_run(service, command)

    def add_to_faiss_index(self, video_id, features_name, force=False):
        """ Adds the analyzed frames of a video to the FAISS index dedicated to the given type of features.

        Args:
            video_id (str): Input Video ID.
            features_name (str): Name of the features to index. This will be used to select the index for these features.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.

        Returns:
            # TODO
        """

        faiss_index_file = self.collection_dir / f'faiss-index_{features_name}.faiss'
        faiss_idmap_file = self.collection_dir / f'faiss-idmap_{features_name}.txt'

        if not force and faiss_index_file.exists() and faiss_idmap_file.exists():
            print(f'Skipping indexing in FAISS, using existing index:', faiss_index_file.name, faiss_idmap_file.name)
            return 0

        features_file = self.collection_dir / f'features-{features_name}' / video_id / f'{video_id}-{features_name}.hdf5'

        faiss_index_file = '/data' / faiss_index_file.relative_to(self.collection_dir)
        faiss_idmap_file = '/data' / faiss_idmap_file.relative_to(self.collection_dir)
        features_file = '/data' / features_file.relative_to(self.collection_dir)
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        service = 'faiss-index-manager'
        command = [
            'python', 'build.py',
            '--config-file', str(config_file),
            str(faiss_index_file),
            str(faiss_idmap_file),
            'add'
        ] + (['--force'] if force else []) + [
            str(features_file),
        ]

        return self.compose_run(service, command)