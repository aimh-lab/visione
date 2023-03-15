import subprocess

from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn, MofNCompleteColumn

from .command import BaseCommand

class AnalyzeCommand(BaseCommand):
    """ Implements the 'analyze' CLI command. """

    def __init__(self, *args, **kwargs):
        super(AnalyzeCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('analyze', help='Analyzes videos imported in the collection')
        parser.add_argument('--id', dest='video_ids', nargs='+', default=(), help='Video ID(s) to be indexed. If not given, proceeds on all imported videos.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing analyses.')
        parser.add_argument('--no-gpu', dest='gpu', default=self.is_gpu_available(), action='store_false', help='Do not use the GPU if available.')
        parser.set_defaults(func=self)

    def __call__(self, *, config_file, video_ids, replace, gpu):
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
                for detector in active_object_detectors:
                    subtask = progress.add_task(f'- Detecting objects ({detector})', total=None)
                    self.detect_objects_single_video(video_id, detector, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Feature vector extraction
                active_feature_extractors = analysis_config.get('features', [])
                for feature_name in active_feature_extractors:
                    subtask = progress.add_task(f'- Extracting features ({feature_name})', total=None)
                    self.extract_features_single_video(video_id, feature_name, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                # Frame clustering
                clustering_features = analysis_config.get('frame_cluster', {}).get('feature', None)
                if clustering_features:
                    subtask = progress.add_task(f'- Clustering frames ({clustering_features})', total=None)
                    self.cluster_frames(video_id, features=clustering_features, force=replace, stdout_callback=self.progress_callback(progress, subtask))
                    subtasks.append(subtask)

                progress.console.log(f"- '{video_id}' analyzed.")
                for subtask in subtasks:
                    progress.remove_task(subtask)
                progress.update(task, advance=1)

            progress.console.log('Analysis complete.')

    def extract_features_single_video(self, video_id, features_name, force=False, gpu=False, **run_kws):
        """ Extracts features from selected keyframes of a video.

        Args:
            video_id (str): Input Video ID.
            features_name (str): Name of the features to extract.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            gpu (bool, optional): Whether to use the GPU. Defaults to False.
            run_kws: Additional arguments to pass to `subprocess.Popen()`.

        Returns:
            int: Return code of the subprocess.
        """
        features_file = self.collection_dir / f'features-{features_name}' / video_id / f'{video_id}-{features_name}.hdf5'
        features_file.parent.mkdir(parents=True, exist_ok=True)

        if not force and features_file.exists():
            print(f'Skipping {features_name} extraction, using existing file:', features_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / features_file.relative_to(self.collection_dir)

        service = f'features-{features_name}'
        command = [
            'python', 'extract.py',
        ] + (['--force'] if force else []) + [
        ] + (['--gpu'] if gpu else []) + [
            '--save-every', '200',
            str(input_dir),
            'hdf5',
            '--output', str(output_file),
            '--features-name', features_name,
        ]

        return self.compose_run(service, command, **run_kws)

    def detect_objects_single_video(self, video_id, detector_name, force=False, gpu=False, **run_kws):
        """ Detects objects in selected keyframes of a video.

        Args:
            video_id (str): Input Video ID.
            detector_name (str): Name of the detector to use.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            gpu (bool, optional): Whether to use the GPU. Defaults to False.
            run_kws: Additional arguments to pass to `subprocess.Popen()`.

        Returns:
            int: Return code of the subprocess.
        """
        objects_file = self.collection_dir / f'objects-{detector_name}' / video_id / f'{video_id}-objects-{detector_name}.jsonl.gz'
        objects_file.parent.mkdir(parents=True, exist_ok=True)

        if not force and objects_file.exists():
            print(f'Skipping object detection ({detector_name}), using existing file:', objects_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / objects_file.relative_to(self.collection_dir)

        service = f'objects-{detector_name}'
        command = [
            'python', 'extract.py',
        ] + (['--force'] if force else []) + [
        ] + (['--gpu'] if gpu else []) + [
            '--save-every', '200',
            str(input_dir),
            'jsonl',
            '--output', str(output_file),
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