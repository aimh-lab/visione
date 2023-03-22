import collections
import csv
import gzip
import json
from pathlib import Path
import tempfile
import threading

from rich.progress import Progress, SpinnerColumn, MofNCompleteColumn, TimeElapsedColumn

from .command import BaseCommand
from ...services.common import CliProgress


class IndexCommand(BaseCommand):
    """ Implements the 'index' CLI command. """

    def __init__(self, *args, **kwargs):
        super(IndexCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('index', help='Create an index entry for imported videos.')
        parser.add_argument('--id', dest='video_ids', nargs='+', default=(), help='Video ID(s) to be indexed. If not given, proceeds on all analyzed videos.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing index entry.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_ids, replace, **kwargs):
        super(IndexCommand, IndexCommand).__call__(self, **kwargs)
        self.create_services_containers('index')

        # if video IDs are given, index only those
        if len(video_ids):
            return self.index_videos(video_ids, replace=replace)

        # otherwise, bulk index all videos in the collection
        return self.bulk_index_videos(replace=replace)

    def index_videos(self, video_ids, replace=False):
        """ Indexes the given video IDs sequentially.
            Videos become searchable as soon as they are indexed.
        """

        progress_cols = [
            SpinnerColumn(),
            *Progress.get_default_columns()[:1],
            MofNCompleteColumn(),
            *Progress.get_default_columns()[1:],
            TimeElapsedColumn()
        ]
        with Progress(*progress_cols, transient=True) as progress:
            n_videos = len(video_ids)
            progress.console.log(f"Starting indexing of {n_videos} video{'' if n_videos == 1 else 's'}.")
            task = progress.add_task('', total=n_videos)

            index_config = self.config.get('index', {})
            str_objects = index_config.get('objects', {})
            indexed_features = index_config.get('features', {})
            str_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'str']
            faiss_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'faiss']

            for video_id in video_ids:
                progress.update(task, description=f"Indexing '{video_id}'")
                subtasks = []
                threads = []

                # generate surrogate text representation of objects & colors
                if str_objects:
                    subtask = progress.add_task('- STR Encoding: objects', total=None)
                    thread = threading.Thread(target=self.str_encode_objects, kwargs=dict(video_id=video_id, force=replace, stdout_callback=self.progress_callback(progress, subtask)))
                    thread.start()
                    threads.append(thread)
                    subtasks.append(subtask)

                # generate surrogate text representation of features
                for features_name in str_features:
                    subtask = progress.add_task(f"- STR Encoding: features '{features_name}'", total=None)
                    self.str_encode_features(features_name, video_id=video_id, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # push to Lucene index
                if str_objects or str_features:
                    for thread in threads:
                        thread.join()
                    subtask = progress.add_task('- Creating Lucene documents', total=None)
                    self.prepare_lucene_docs(video_id=video_id, force=replace, progress=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                    subtask = progress.add_task('- Adding to Lucene index', total=None)
                    self.add_to_lucene_index(video_id=video_id, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # push to FAISS index
                for features_name in faiss_features:
                    subtask = progress.add_task(f"- Adding features '{features_name}' to FAISS index", total=None)
                    self.add_to_faiss_index(features_name, video_ids=[video_id], force=replace)
                    subtasks.append(subtask)

                progress.console.log(f"- '{video_id}' indexed.")
                for subtask in subtasks:
                    progress.remove_task(subtask)
                progress.advance(task)

            progress.console.log('Indexing complete.')

    def bulk_index_videos(self, video_ids=None, replace=False):
        """ Indexes all or given videos in bulk. Videos become searchable only at the end of the bulk indexing operation. """

        video_ids = video_ids or []
        if len(video_ids) == 0:
            thumb_dir = self.collection_dir / 'selected-frames'
            video_ids = (p.name for p in thumb_dir.iterdir() if p.is_dir())

        with tempfile.NamedTemporaryFile(
            mode='w',
            encoding='utf8',
            prefix='bulk_indexing_',
            suffix='.txt',
            dir=self.collection_dir,
            delete=not self.develop_mode
        ) as video_list:

            n_videos = 0
            for video_id in video_ids:
                video_list.write(f'{video_id}\n')
                n_videos += 1

            video_list.flush()
            video_list.seek(0)

            video_list_path = Path(video_list.name)

            progress_cols = [
                SpinnerColumn(),
                *Progress.get_default_columns()[:1],
                MofNCompleteColumn(),
                *Progress.get_default_columns()[1:],
                TimeElapsedColumn()
            ]
            with Progress(*progress_cols, transient=False) as progress:
                progress.console.log(f"Starting bulk indexing of {n_videos} video{'' if n_videos == 1 else 's'}.")

                index_config = self.config.get('index', {})
                str_objects = index_config.get('objects', {})
                indexed_features = index_config.get('features', {})
                str_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'str']
                faiss_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'faiss']

                n_tasks = 0
                n_tasks += 1 if str_objects else 0
                n_tasks += len(str_features)
                n_tasks += 2 if str_objects or str_features else 0
                n_tasks += len(faiss_features)
                task = progress.add_task('Bulk indexing', total=n_tasks)
                
                # generate surrogate text representation of objects & colors
                if str_objects:
                    subtask = progress.add_task('- STR Encoding: objects', total=None)
                    self.str_encode_objects(video_list=video_list_path, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    progress.advance(task)

                # generate surrogate text representation of features
                for features_name in str_features:
                    subtask = progress.add_task(f"- STR Encoding: features '{features_name}'", total=None)
                    self.str_encode_features(features_name, video_list=video_list_path, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    progress.advance(task)

                # push to Lucene index
                if str_objects or str_features:
                    subtask = progress.add_task('- Creating Lucene documents', total=None)
                    self.prepare_lucene_docs(video_list=video_list_path, force=replace, progress=self.progress_callback(progress, subtask))
                    progress.advance(task)

                    subtask = progress.add_task('- Adding to Lucene index', total=None)
                    self.add_to_lucene_index(video_list=video_list_path, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    progress.advance(task)

                # push to FAISS index
                for features_name in faiss_features:
                    subtask = progress.add_task(f"- Adding features '{features_name}' to FAISS index", total=None)
                    self.add_to_faiss_index(features_name, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    progress.advance(task)

                progress.console.log('Indexing complete.')

    def str_encode_objects(self, video_list=None, video_id=None, force=False, **run_kws):
        """ Encodes colors, detected objects, and their count of each selected frame of a video with surrogate text representations.

        Args:
            video_list (Path, optional): Path to a file containing a list of video IDs to encode. Defaults to None.
            video_id (str, optional): Video ID to encode. Defaults to None.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            runs_kws (dict, optional): Keyword arguments to be passed to `subprocess.Popen()`.

        Note:
            Either `video_list` or `video_id` must be specified.

        Returns:
            int: Return code of the subprocess.
        """

        assert video_list or video_id, 'Either `video_list` or `video_id` must be specified.'
        assert not(video_list and video_id), 'Only one of `video_list` or `video_id` can be specified.'

        if video_list:
            video_list = '/data' / video_list.relative_to(self.collection_dir)
            inputs = ['--video-ids-list-path', str(video_list)]
        else:
            inputs = ['--video-ids', video_id]

        str_objects_template = self.collection_dir / 'str-objects' / '{video_id}' / '{video_id}-str-objects.jsonl.gz'
        count_objects_template = self.collection_dir / 'count-objects' / '{video_id}' / '{video_id}-count-objects.json'

        detectors = self.config.get('analysis', {}).get('object_detectors', [])
        objects_templates = [self.collection_dir / f'objects-{d}' / '{video_id}' / f'{{video_id}}-objects-{d}.jsonl.gz' for d in detectors]

        str_objects_template = '/data' / str_objects_template.relative_to(self.collection_dir)
        count_objects_template = '/data' / count_objects_template.relative_to(self.collection_dir)
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        objects_templates = ['/data' / p.relative_to(self.collection_dir) for p in objects_templates]
        objects_templates = map(str, objects_templates)
        objects_templates = sorted(objects_templates)

        service = 'str-object-encoder'
        command = [
            'python', 'encode.py',
            '--config-file', str(config_file),
            '--save-every', '200',
        ] + (['--force'] if force else []) + [
            str(str_objects_template),
            str(count_objects_template),
        ] + objects_templates + [
        ] + inputs

        return self.compose_run(service, command, **run_kws)

    def str_encode_features(self, features_name, video_list=None, video_id=None, force=False, **run_kws):
        """ Encodes feature vectors of each selected frame of a video with surrogate text representations.

        Args:
            features_name (str): Name of the features to encode.
            video_list (Path, optional): Path to a file containing a list of video IDs to encode. Defaults to None.
            video_id (str, optional): Video ID to encode. Defaults to None.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            runs_kws (dict, optional): Keyword arguments to be passed to `subprocess.Popen()`.

        Note:
            Either `video_list` or `video_id` must be specified.

        Returns:
            int: Return code of the subprocess.
        """

        assert video_list or video_id, 'Either `video_list` or `video_id` must be specified.'
        assert not(video_list and video_id), 'Only one of `video_list` or `video_id` can be specified.'

        if video_list:
            video_list = '/data' / video_list.relative_to(self.collection_dir)
            inputs = ['--video-ids-list-path', str(video_list)]
        else:
            inputs = ['--video-ids', video_id]

        input_template = self.collection_dir / f'features-{features_name}' / '{video_id}' / f'{{video_id}}-{features_name}.hdf5'
        str_encoder_file = self.collection_dir / f'str-features-encoder-{features_name}.pkl'

        str_features_template = self.collection_dir / 'str-features' / '{video_id}' / f'{{video_id}}-str-features-{features_name}.jsonl.gz'

        config_file = '/data' / self.config_file.relative_to(self.collection_dir)
        input_template = '/data' / input_template.relative_to(self.collection_dir)
        str_encoder_file = '/data' / str_encoder_file.relative_to(self.collection_dir)
        str_features_template = '/data' / str_features_template.relative_to(self.collection_dir)

        service = 'str-feature-encoder'
        command = [
            'python', 'encode.py',
            '--config-file', str(config_file),
            '--save-every', '200',
        ] + (['--force'] if force else []) + [
            str(input_template),
            str(str_encoder_file),
            str(str_features_template),
        ] + inputs + [
        ]

        return self.compose_run(service, command, **run_kws)

    def prepare_lucene_doc(self, video_id, force=False, progress=None):
        """ Merges jsonl.gz document into a unique doc ready to be indexed by Lucene.

        Args:
            video_id (str): Input Video ID.
            force (bool, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.
            progress (callback, optional): Callback function to report progress. Defaults to None.
        """
        lucene_documents_dir = self.collection_dir / 'lucene-documents' / video_id
        lucene_documents_dir.mkdir(parents=True, exist_ok=True)
        lucene_documents_file = lucene_documents_dir / f'{video_id}-lucene-docs.jsonl.gz'

        scenes_file = self.collection_dir / 'selected-frames' / video_id / f'{video_id}-scenes.csv'
        with scenes_file.open('r') as f:
            num_scenes = sum(1 for _ in f) - 1

        if progress:
            progress.total += num_scenes + (progress.total < 0)
            progress.print()

        if not force and lucene_documents_file.exists():
            print(f'Skipping Lucene document creation, using existing file:', lucene_documents_file.name)
            if progress:
                progress.initial += num_scenes
                progress.print()

            return 0

        # prepare scene fields of records

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
            record['aladin'] = record.pop('features_aladin_str')
            return record

        records = map(fix_fieldnames, records)

        if progress:
            records = progress(records)

        # save merged jsonl.gz file
        with gzip.open(lucene_documents_file, 'wt') as out:
            for record in records:
                out.write(json.dumps(record) + '\n')

    def prepare_lucene_docs(self, video_list=None, video_id=None, force=False, progress=None, **run_kws):
        """ Prepares the analyzed frames of the given videos for Lucene indexing.

        Args:
            video_list (str, optional): Path to a file containing a list of video IDs. Defaults to None.
            video_id (str, optional): Input Video ID. Defaults to None.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.
            progress (callback, optional): Callback function to report progress. Defaults to None.
            run_kws (dict, optional): Additional keyword arguments passed to `subprocess.Popen()`.

        Note:
            Either `video_list` or `video_id` must be specified.

        Returns:
            int: The return code of the subprocess.
        """

        assert video_list or video_id, 'Either `video_list` or `video_id` must be specified.'
        assert not (video_list and video_id), 'Only one of `video_list` or `video_id` must be specified.'

        if video_id:
            video_ids = [video_id]
        else:
            with open(video_list, 'r') as f:
                video_ids = [line.strip() for line in f.readlines()]


        progress_obj = CliProgress(print_fn=progress) if progress else None

        for video_id in video_ids:
            self.prepare_lucene_doc(video_id, force=force, progress=progress_obj, **run_kws)
        
        return 0

    def add_to_lucene_index(self, video_list=None, video_id=None, force=False, **run_kws):
        """ Adds the analyzed frames of a video to the collection index.

        Args:
            video_list (str, optional): Path to a file containing a list of video IDs. Defaults to None.
            video_id (str, optional): Input Video ID. Defaults to None.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.
            run_kws (dict, optional): Additional keyword arguments passed to `subprocess.Popen()`.

        Note:
            Either `video_list` or `video_id` must be specified.

        Returns:
            int: The return code of the subprocess.
        """

        assert video_list or video_id, 'Either `video_list` or `video_id` must be specified.'
        assert not (video_list and video_id), 'Only one of `video_list` or `video_id` must be specified.'

        if video_list:
            video_list = '/data' / video_list.relative_to(self.collection_dir)
            inputs = ['--video-ids-list-path', str(video_list)]
        else:
            inputs = ['--video-ids', video_id]

        documents_template = self.collection_dir / 'lucene-documents' / '{video_id}' /  '{video_id}-lucene-docs.jsonl.gz'
        lucene_index_dir = self.collection_dir / 'lucene-index'

        documents_template = '/data' / documents_template.relative_to(self.collection_dir)
        lucene_index_dir = '/data' / lucene_index_dir.relative_to(self.collection_dir)

        service = 'lucene-index-manager'
        command = [
            # 'java', '-jar', 'lucene-index-manager.jar',  # this is already in the ENTRYPOINT
            str(lucene_index_dir),
            'add',
        ] + (['--force'] if force else []) + [
            str(documents_template),
        ] + inputs

        return self.compose_run(service, command, **run_kws)

    def add_to_faiss_index(self, features_name, video_ids=None, force=False, **run_kws):
        """ Adds the analyzed frames of one or more videos to the FAISS index dedicated to the given type of features.

        Args:
            features_name (str): Name of the features to index. This will be used to select the index for these features.
            video_ids (list, optional): List of Video IDs to index. If None, all videos will be bulk indexed. Defaults to None.
            force (str, optional): Whether to replace existing output in the index or skip insertion. Defaults to False.
            run_kws (dict, optional): Additional keyword arguments passed to `subprocess.Popen()`.

        Returns:
            int: The return code of the subprocess.
        """

        faiss_index_file = self.collection_dir / f'faiss-index_{features_name}.faiss'
        faiss_idmap_file = self.collection_dir / f'faiss-idmap_{features_name}.txt'

        features_dir = self.collection_dir / f'features-{features_name}'
        features_input = [features_dir]

        bulk = video_ids is None
        assert bulk or len(video_ids) > 0, 'video_ids must be a non-empty list'

        if not bulk:
            features_input = [features_dir / video_id / f'{video_id}-{features_name}.hdf5' for video_id in video_ids]

        faiss_index_file = '/data' / faiss_index_file.relative_to(self.collection_dir)
        faiss_idmap_file = '/data' / faiss_idmap_file.relative_to(self.collection_dir)
        features_input = ['/data' / f.relative_to(self.collection_dir) for f in features_input]
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        service = 'faiss-index-manager'
        command = [
            'python', 'build.py',
            '--config-file', str(config_file),
            str(faiss_index_file),
            str(faiss_idmap_file),
        ] + (['create'] if bulk else ['add']) + [
        ] + (['--force'] if force else []) + [
        ] + [str(f) for f in features_input] + [
        ]

        return self.compose_run(service, command, **run_kws)