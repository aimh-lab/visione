import subprocess

from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn, MofNCompleteColumn

from .command import BaseCommand, progress_callback

class AnalyzeCommand(BaseCommand):
    """ Implements the 'analyze' CLI command. """

    def __init__(self, *args, **kwargs):
        super(AnalyzeCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('analyze', help='Analyzes videos imported in the collection')
        parser.add_argument('--id', dest='video_ids', nargs='+', default=(), help='Video ID(s) to be indexed. If not given, proceeds on all imported videos.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing analyses.')
        parser.set_defaults(func=self)

    def __call__(self, *, config_file, video_ids, replace):
        super(AnalyzeCommand, AnalyzeCommand).__call__(self, config_file)

        analysis_config = self.config.get('analysis', {})

        if len(video_ids) == 0:
            thumb_dir = self.collection_dir / 'selected-frames'
            video_ids = [p.name for p in thumb_dir.iterdir() if p.is_dir()]

        progress_cols = [
            SpinnerColumn(),
            *Progress.get_default_columns()[:1],
            MofNCompleteColumn(),
            *Progress.get_default_columns()[1:],
            TimeElapsedColumn()
        ]
        with Progress(*progress_cols, transient=True) as progress:
            n_videos = len(video_ids)
            progress.console.log(f"Starting analysis on {n_videos} video{'' if n_videos == 1 else 's'}.")
            task = progress.add_task('', total=n_videos)

            for video_id in video_ids:
                progress.update(task, description=f"Analyzing '{video_id}'")
                subtasks = []

                # Objects & Colors Detection
                active_object_detectors = analysis_config.get('object_detectors', [])
                if 'colors' in active_object_detectors:
                    subtask = progress.add_task('- Extracting colors', total=None)
                    self.extract_color_map(video_id, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                if 'vfnet_X-101-64x4d' in active_object_detectors:
                    subtask = progress.add_task('- Detecting objects (vfnet_X-101-64x4d)', total=None)
                    self.detect_objects_mmdet(video_id, 'vfnet_X-101-64x4d', force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                if 'mask_rcnn_lvis' in active_object_detectors:
                    subtask = progress.add_task('- Detecting objects (mask_rcnn_lvis)', total=None)
                    self.detect_objects_mmdet(video_id, 'mask_rcnn_lvis', force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                if 'frcnn_incep_resnetv2_openimagesv4' in active_object_detectors:
                    subtask = progress.add_task('- Detecting objects (frcnn_incep_resnetv2_openimagesv4)', total=None)
                    self.detect_objects_oiv4(video_id, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Feature vector extraction
                active_feature_extractors = analysis_config.get('features', [])
                if 'gem' in active_feature_extractors:
                    subtask = progress.add_task('- Extracting features (GeM)', total=None)
                    self.extract_gem_features(video_id, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                if 'clip-laion' in active_feature_extractors:
                    subtask = progress.add_task('- Extracting features (CLIP LAION)', total=None)
                    self.extract_clip_features(video_id, 'clip-laion', dimensions=1024, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                if 'clip-openai' in active_feature_extractors:
                    subtask = progress.add_task('- Extracting features (CLIP OpenAI)', total=None)
                    self.extract_clip_features(video_id, 'clip-openai', dimensions=768, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Frame clustering
                clustering_features = analysis_config.get('frame-cluster', {}).get('feature', None)
                if clustering_features:
                    subtask = progress.add_task(f'- Clustering frames ({clustering_features})', total=None)
                    self.cluster_frames(video_id, features=clustering_features, force=replace, stdout_callback=progress_callback(progress, subtask))
                    subtasks.append(subtask)

                progress.console.log(f"- '{video_id}' analyzed.")
                for subtask in subtasks:
                    progress.remove_task(subtask)
                progress.update(task, advance=1)

            progress.console.log('Analysis complete.')

    def extract_gem_features(self, video_id, force=False, **run_kws):
        """ Extracts GeM features from selected keyframes of a video for instance retrieval.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            TODO
        """
        gem_dir = self.collection_dir / 'features-gem' / video_id
        gem_dir.mkdir(parents=True, exist_ok=True)

        gem_features_file = gem_dir / f'{video_id}-gem.hdf5'
        if not force and gem_features_file.exists():
            print('Skipping GeM extraction, using existing file:', gem_features_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / gem_features_file.relative_to(self.collection_dir)

        service = 'features-gem'
        command = [
            'python', 'extract.py',
            str(input_dir),
            '--save-every', '200',
            '--gpu',
            'hdf5',
            '--output', str(output_file),
            '--features-name', 'gem',
        ]

        return self.compose_run(service, command, **run_kws)

    def extract_clip_features(self, video_id, features_name, dimensions, force=False, **run_kws):
        """ Extracts CLIP features from selected keyframes of a video for cross-media retrieval.

        Args:
            video_id (str): Input Video ID.
            features_name (str): Specifies the CLIP model to be used.
            dimensions (int): Number of dimensions of the extracted feature vector.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            TODO
        """
        clip_dir = self.collection_dir / f'features-{features_name}' / video_id
        clip_dir.mkdir(parents=True, exist_ok=True)

        clip_features_file = clip_dir / f'{video_id}-{features_name}.hdf5'
        if not force and clip_features_file.exists():
            print(f'Skipping {features_name} extraction, using existing file:', clip_features_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / clip_features_file.relative_to(self.collection_dir)

        service = f'features-{features_name}'
        command = [
            'python', 'extract.py',
            str(input_dir),
            '--save-every', '200',
            '--gpu',
            'hdf5',
            '--output', str(output_file),
            '--dimensionality', str(dimensions),
            '--features-name', features_name,
        ]

        return self.compose_run(service, command, **run_kws)

    def extract_color_map(self, video_id, force=False, **run_kws):
        colors_dir = self.collection_dir / 'objects-colors' / video_id
        colors_dir.mkdir(parents=True, exist_ok=True)

        colors_file = colors_dir / f'{video_id}-objects-colors.jsonl.gz'
        if not force and colors_file.exists():
            print(f'Skipping color extraction, using existing file:', colors_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / colors_file.relative_to(self.collection_dir)

        service = 'objects-colors'
        command = [
            'python', 'extract.py',
            str(input_dir),
            '--save-every', '200',
            'file',
            '--output', str(output_file),
        ]

        return self.compose_run(service, command, **run_kws)

    def detect_objects_mmdet(self, video_id, detector, force=False, **run_kws):
        """ Detect objects form the selected keyframes of a video using pretrained models from mmdetection.

        Args:
            video_id (str): Input Video ID.
            detector (str): Specifies the detector to use. It must be one of 'vfnet_X-101-32x4d', 'vfnet_X-101-64x4d', or 'mask_rcnn_lvis'.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        objects_dir = self.collection_dir / f'objects-{detector}' / video_id
        objects_dir.mkdir(parents=True, exist_ok=True)

        objects_file = objects_dir / f'{video_id}-objects-{detector}.jsonl.gz'
        if not force and objects_file.exists():
            print(f'Skipping object detection ({detector}), using existing file:', objects_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / objects_file.relative_to(self.collection_dir)

        service = 'objects-mmdet'
        command = [
            'python', 'extract.py',
            str(input_dir),
            detector,
        ] + (['--force'] if force else []) + [
            '--gpu',
            '--save-every', '200',
            'file',
            '--output', str(output_file),
        ]

        return self.compose_run(service, command, **run_kws)

    def detect_objects_oiv4(self, video_id, force=False, **run_kws):
        """ Detect objects form the selected keyframes of a video using the
            Faster RCNN Inception ResNet V2 model trained on OpenImagesV4
            available in tensorflow hub.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        detector = 'frcnn_incep_resnetv2_openimagesv4'
        objects_dir = self.collection_dir / f'objects-{detector}' / video_id
        objects_dir.mkdir(parents=True, exist_ok=True)

        objects_file = objects_dir / f'{video_id}-objects-{detector}.jsonl.gz'
        if not force and objects_file.exists():
            print(f'Skipping object detection ({detector}), using existing file:', objects_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / objects_file.relative_to(self.collection_dir)

        service = 'objects-openimagesv4'
        command = [
            'python', 'extract.py',
            str(input_dir),
        ] + (['--force'] if force else []) + [
            '--save-every', '200',
            'file',
            '--output', str(output_file),
        ]

        return self.compose_run(service, command, **run_kws)

    def cluster_frames(self, video_id, features='gem', force=False, **run_kws):
        """ Cluster selected frames of a video by visual similarity.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """
        clusters_dir = self.collection_dir / 'cluster-codes' / video_id
        clusters_dir.mkdir(parents=True, exist_ok=True)

        clusters_file = clusters_dir / f'{video_id}-cluster-codes.jsonl.gz'
        if not force and clusters_file.exists():
            print(f'Skipping frame clustering, using existing file:', clusters_file.name)
            return 0

        features_file = self.collection_dir / f'features-{features}' / video_id / f'{video_id}-{features}.hdf5'
        assert features_file.exists(), f"Cannot cluster by {features}, file not found: {features_file}"

        input_file = '/data' / features_file.relative_to(self.collection_dir)
        output_file = '/data' / clusters_file.relative_to(self.collection_dir)

        service = 'frame-cluster'
        command = [
            'python', 'cluster.py',
            str(input_file),
        ] + (['--force'] if force else []) + [
            str(output_file),
        ]

        return self.compose_run(service, command, **run_kws)