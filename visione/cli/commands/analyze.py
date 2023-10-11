from pathlib import Path
import subprocess
import tempfile

from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn, MofNCompleteColumn

from .command import BaseCommand

class AnalyzeCommand(BaseCommand):
    """ Implements the 'analyze' CLI command. """

    def __init__(self, *args, **kwargs):
        super(AnalyzeCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('analyze', help='Analyzes videos imported in the collection.')
        parser.add_argument('--id', dest='video_ids', nargs='+', default=(), help='Video ID(s) to be indexed. If not given, proceeds on all imported videos.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing analyses.')
        parser.add_argument('--no-gpu', dest='gpu', default=self.is_gpu_available(), action='store_false', help='Do not use the GPU if available.')
        parser.add_argument('analyses', nargs='*', default=None, help='Analysis to run. If not given, runs all analyses.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_ids, replace, gpu, analyses, **kwargs):
        super(AnalyzeCommand, AnalyzeCommand).__call__(self, **kwargs)
        self.create_services_containers()

        analyze_kwargs = dict(replace=replace, gpu=gpu, analyses=analyses)

        # if video IDs are given, analyze only those
        if len(video_ids):
            return self.analyze_videos(video_ids, **analyze_kwargs)

        # otherwise, bulk analyze all videos in the collection
        return self.bulk_analyze_videos(**analyze_kwargs)

    def analyze_videos(
        self,
        video_ids,
        replace=False,
        gpu=False,
        analyses=None,
    ):
        """ Analyzes a list of videos given by IDs. """

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

            analysis_config = self.config.get('analysis', {})

            for video_id in video_ids:
                progress.update(task, description=f"Analyzing '{video_id}'")
                subtasks = []

                active_object_detectors = analysis_config.get('object_detectors', {})
                active_feature_extractors = analysis_config.get('features', {})
                clustering_features = analysis_config.get('frame_cluster', {}).get('feature', None)

                if analyses:  # keep only requested analyses
                    available = list(active_object_detectors.keys()) + list(active_feature_extractors.keys()) + (['frame-cluster'] if clustering_features else [])
                    assert all(a in available for a in analyses), f"Unknown analysis: {set(analyses) - set(available)}. Available analyses: {available}"

                    active_object_detectors = {k: v for k, v in active_object_detectors.items() if k in analyses}
                    active_feature_extractors = {k: v for k, v in active_feature_extractors.items() if k in analyses}
                    clustering_features = clustering_features if 'frame-cluster' in analyses else False

                # Objects & Colors Detection
                for detector, params in active_object_detectors.items():
                    subtask = progress.add_task(f'- Detecting objects ({detector})', total=None)
                    self.detect_objects(detector, video_id=video_id, force=replace, gpu=gpu, params=params, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Feature vector extraction
                for extractor, params in active_feature_extractors.items():
                    subtask = progress.add_task(f'- Extracting features ({extractor})', total=None)
                    self.extract_features(extractor, video_id=video_id, force=replace, gpu=gpu, params=params, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Frame clustering
                if clustering_features:
                    subtask = progress.add_task(f'- Clustering frames ({clustering_features})', total=None)
                    self.cluster_frames(video_id, features=clustering_features, force=replace, gpu=gpu, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                progress.console.log(f"- '{video_id}' analyzed.")
                for subtask in subtasks:
                    progress.remove_task(subtask)
                progress.update(task, advance=1)

            progress.console.log('Analysis complete.')

    def bulk_analyze_videos(
        self,
        replace=False,
        gpu=False,
        analyses=None,
        **run_kws
    ):
        """ Analyzes all videos in the collection in bulk. """

        frames_dir = self.collection_dir / 'selected-frames'
        video_dirs = frames_dir.iterdir()
        video_dirs = filter(lambda p: p.is_dir(), video_dirs)

        with tempfile.NamedTemporaryFile(
                mode='w',
                encoding='utf8',
                prefix='bulk_analysis_',
                suffix='.txt',
                dir=self.collection_dir,
                delete=not self.develop_mode,
            ) as image_list:

            # generate image list
            n_frames = 0
            video_ids = []
            with Progress('[progress.description]{task.description}') as progress:
                task = progress.add_task('Collecting...')

                for video_dir in video_dirs:
                    video_id = video_dir.name
                    video_frames = sorted(
                        frame_name for frame_name in video_dir.iterdir()
                        if frame_name.name.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'))
                    )

                    for video_frame in video_frames:
                        frame_id = video_frame.stem
                        frame_path = '/data' / video_frame.relative_to(self.collection_dir)
                        image_list.write(f'{video_id}\t{frame_id}\t{frame_path}\n')
                        n_frames += 1

                    video_ids.append(video_id)

                    progress.update(task, description=f'Collecting... Videos: {len(video_ids):7d} Frames: {n_frames:7d}')

            image_list.flush()
            image_list.seek(0)

            image_list_path = Path(image_list.name)

            progress_cols = [
                SpinnerColumn(),
                *Progress.get_default_columns()[:1],
                MofNCompleteColumn(),
                *Progress.get_default_columns()[1:],
                TimeElapsedColumn()
            ]
            with Progress(*progress_cols, transient=True) as progress:
                progress.console.log(f"Starting analysis on {n_frames} frame{'' if n_frames == 1 else 's'}.")

                analysis_config = self.config.get('analysis', {})
                active_object_detectors = analysis_config.get('object_detectors', {})
                active_feature_extractors = analysis_config.get('features', {})
                clustering_features = analysis_config.get('frame_cluster', {}).get('feature', None)

                if analyses:  # keep only requested analyses
                    available = list(active_object_detectors.keys()) + list(active_feature_extractors.keys()) + (['frame-cluster'] if clustering_features else [])
                    assert all(a in available for a in analyses), f"Unknown analysis: {set(analyses) - set(available)}. Available analyses: {available}"

                    active_object_detectors = {k: v for k, v in active_object_detectors.items() if k in analyses}
                    active_feature_extractors = {k: v for k, v in active_feature_extractors.items() if k in analyses}
                    clustering_features = clustering_features if 'frame-cluster' in analyses else False

                n_analyses = len(active_object_detectors) + len(active_feature_extractors) + (1 if clustering_features else 0)

                task = progress.add_task(f'Bulk analysis ({"GPU" if gpu else "CPU"})', total=n_analyses)
                subtasks = []

                # run analysis: objects & colors detectors
                for detector, params in active_object_detectors.items():
                    subtask = progress.add_task(f'- Detecting objects ({detector})', total=n_frames)
                    self.detect_objects(detector, image_list=image_list_path, force=replace, gpu=gpu, params=params, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)
                    progress.advance(task)

                # run analysis: feature vector extraction
                for extractor, params in active_feature_extractors.items():
                    subtask = progress.add_task(f'- Extracting features ({extractor})', total=n_frames)
                    self.extract_features(extractor, image_list=image_list_path, force=replace, gpu=gpu, params=params, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)
                    progress.advance(task)

                # run analysis: frame clustering
                if clustering_features:
                    subtask = progress.add_task(f'- Clustering frames ({clustering_features})', total=len(video_ids))
                    for video_id in video_ids:
                        self.cluster_frames(video_id, features=clustering_features, force=replace, gpu=gpu)
                        progress.advance(subtask)
                    subtasks.append(subtask)

    def extract_features(self, extractor, image_list=None, video_id=None, force=False, gpu=False, params={}, **run_kws):
        """ Extracts features from selected keyframes of a video.

        Args:
            extractor (str): Name of the extractor.
            image_list (Path, optional): Path to a file containing a list of images to extract features from. Defaults to None.
            video_id (str, optional): ID of the video to extract features from. Defaults to None.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            gpu (bool, optional): Whether to use the GPU. Defaults to False.
            run_kws: Additional arguments to pass to `subprocess.Popen()`.

        Note:
            Either `image_list` or `video_id` must be given.

        Returns:
            int: Return code of the subprocess.
        """

        assert image_list or video_id, 'Either image_list or video_id must be given.'
        assert not (image_list and video_id), 'Only one of image_list or video_id must be given.'

        output_template = self.collection_dir / f'features-{extractor}' / '{video_id}' / f'{{video_id}}-{extractor}.hdf5'

        input_path = image_list
        if video_id:
            input_path = self.collection_dir / 'selected-frames' / video_id

        input_path = '/data' / input_path.relative_to(self.collection_dir)
        output_template = '/data' / output_template.relative_to(self.collection_dir)

        cmd_params = []
        for k, v in params.items():
            cmd_params += [f'--{k}', str(v)]

        service = f'features-{extractor}'
        command = [
            'python', 'extract.py',
        ] + (['--force'] if force else []) + [
        ] + (['--gpu'] if gpu else []) + [
            '--save-every', '200',
        ] + cmd_params + [
            str(input_path),
            'hdf5',
            '--features-name', extractor,
            '--output', str(output_template),
        ]

        return self.compose_run(service, command, **run_kws)

    def detect_objects(self, detector_name, image_list=None, video_id=None, force=False, gpu=False, params={}, **run_kws):
        """ Detects objects in selected keyframes.

        Args:
            detector_name (str): Name of the detector to use.
            image_list (Path, optional): Path to list of images to detect objects in. Defaults to None.
            video_id (str, optional): ID of the video to detect objects in. Defaults to None.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            gpu (bool, optional): Whether to use the GPU. Defaults to False.
            run_kws: Additional arguments to pass to `subprocess.Popen()`.

        Note:
            Either `image_list` or `video_id` must be specified.

        Returns:
            int: Return code of the subprocess.
        """

        assert image_list or video_id, 'Either `image_list` or `video_id` must be specified.'
        assert not (image_list and video_id), 'Only one of `image_list` or `video_id` can be specified.'

        output_template = self.collection_dir / f'objects-{detector_name}' / '{video_id}' / f'{{video_id}}-objects-{detector_name}.jsonl.gz'

        input_path = image_list
        if video_id:
            input_path = self.collection_dir / 'selected-frames' / video_id

        input_path = '/data' / input_path.relative_to(self.collection_dir)
        output_template = '/data' / output_template.relative_to(self.collection_dir)

        cmd_params = []
        for k, v in params.items():
            cmd_params += [f'--{k}', str(v)]

        service = f'objects-{detector_name}'
        command = [
            'python', 'extract.py',
        ] + (['--force'] if force else []) + [
        ] + (['--gpu'] if gpu else []) + [
            '--save-every', '200',
        ] + cmd_params + [
            str(input_path),
            'jsonl',
            '--output', str(output_template),
        ]

        return self.compose_run(service, command, **run_kws)

    def cluster_frames(self, video_id, features='gem', force=False, **run_kws):
        """ Cluster selected frames of a video by visual similarity.

        Args:
            video_id (str): Input Video ID.
            features (str, optional): Features to use for clustering. Defaults to 'gem'.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            run_kws: Additional arguments to pass to `subprocess.Popen()`.

        Returns:
            int: Return code of the subprocess.
        """
        clusters_file = self.collection_dir / 'cluster-codes' / video_id / f'{video_id}-cluster-codes.jsonl.gz'
        clusters_file.parent.mkdir(parents=True, exist_ok=True)

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