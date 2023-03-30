import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import urllib.parse
import urllib.request

from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn

from .command import BaseCommand


class ImportCommand(BaseCommand):
    """ Implements the 'import' CLI command. """

    def __init__(self, *args, **kwargs):
        super(ImportCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('import', help='Import videos to the collection')
        parser.add_argument('--id', dest='video_id', help='Video ID. If None, take the filename without extension as ID.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing video with the given Video ID.')
        parser.add_argument('--no-gpu', dest='gpu', default=self.is_gpu_available(), action='store_false', help='Do not use the GPU if available.')
        parser.add_argument('video_path_or_url', nargs='?', default=None, help='Path or URL to video file to be imported. If not given, resumes importing of existing videos.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_path_or_url, video_id, replace, gpu, **kwargs):
        super(ImportCommand, ImportCommand).__call__(self, **kwargs)
        self.create_services_containers('analysis')

        # TODO handle (video_path_or_url == None) case

        progress_cols = [SpinnerColumn(), *Progress.get_default_columns(), TimeElapsedColumn()]
        with Progress(*progress_cols, transient=True) as progress:

            def show_progress(task_id):
                return lambda completed, total: progress.update(task_id, completed=completed, total=total)

            task = progress.add_task(f"Importing '{video_id}'", total=1)
            subtasks = []

            # import video file
            subtask = progress.add_task('- Copying video file')
            video_id, video_path = self.copy_or_download_video(video_path_or_url, video_id, replace, show_progress(subtask))
            subtasks.append(subtask)

            # create resized video files
            subtask = progress.add_task('- Resizing video')
            thread = threading.Thread(target=self.create_resized_videos, args=(video_path, video_id, replace, gpu, show_progress(subtask)))
            thread.start()
            subtasks.append(subtask)

            # detect scenes and extract frames
            subtask = progress.add_task('- Detect scenes', total=None)
            self.detect_scenes_and_extract_frames(video_path, video_id, replace, show_progress(subtask))
            subtasks.append(subtask)

            # create frames thumbnails
            subtask = progress.add_task('- Generating thumbs')
            self.create_frames_thumbnails(video_id, replace, show_progress(subtask))
            subtasks.append(subtask)

            thread.join()
            progress.console.log(f"- '{video_id}' imported.")
            for subtask in subtasks:
                progress.remove_task(subtask)
            progress.update(task, advance=1)

            progress.console.log('Import complete.')

        return video_id

    def copy_or_download_video(self, video_path_or_url, video_id=None, replace=False, show_progress=None):
        """ Copies or downloads a video from a local path or URL and places it
            in `./videos/<video_id>.<ext>`.

        Args:
            video_path_or_url (str or pathlib.Path): Local path or URL of the video.
            video_id (str, optional): New ID of the downloaded video. If None, take the video file stem as video ID. Defaults to None.
            replace (bool, optional): Whether to replace any existing video with the same video_id. Defaults to False.
            show_progress (func, optional): Callback to show progress.

        Returns:
            video_id (str): The given video ID (useful if video_id was None).
            video_path (pathlib.Path): Path to the copied video.
        """

        # get the URL path to extract the video filename and extension
        url_parts = urllib.parse.urlparse(video_path_or_url)
        video_filename = Path(url_parts.path)

        video_id = str(video_filename.stem) if not video_id else video_id
        video_ext = str(video_filename.suffix)

        video_out = self.collection_dir / 'videos' / f'{video_id}{video_ext}'
        if video_out.exists() and not replace:
            print(f'Using existing video file: {video_out.name}')
            if show_progress:
                show_progress(1, 1)  # set as completed
            return video_id, video_out

        video_url = video_path_or_url
        if not url_parts.scheme:  # convert local path to file:// URI
            video_url = Path(video_path_or_url).resolve().as_uri()

        show_progress_fn = None
        if show_progress:
            show_progress_fn = lambda block_num, block_size, total_size: show_progress(block_num * block_size, total_size)

        # use urlretrieve
        urllib.request.urlretrieve(video_url, video_out, show_progress_fn)
        return video_id, video_out

    def create_resized_videos(self, video_path, video_id, force=False, gpu=False, show_progress=None):
        """ Creates downsampled videos for visualization purposes.
            This implementation uses a dockerized version of ffmpeg.

        Args:
            video_path (pathlib.Path): Path to input video.
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            gpu (bool, optional): Whether to use the GPU if available. Defaults to False.
            show_progress (func, optional): Callback to show progress.

        Returns:
            int: Return code of the ffmpeg command.
        """

        resized_video_dir = self.collection_dir / 'resized-videos'
        tiny_video_path   = resized_video_dir / 'tiny'   / f'{video_id}-tiny.mp4'
        medium_video_path = resized_video_dir / 'medium' / f'{video_id}-medium.mp4'

        if not force and tiny_video_path.exists() and medium_video_path.exists():
            print('Skipping video resizing, using existing files:', tiny_video_path.name, medium_video_path.name)
            if show_progress:
                show_progress(1, 1)  # set as completed
            return 0

        tiny_video_path  .parent.mkdir(parents=True, exist_ok=True)
        medium_video_path.parent.mkdir(parents=True, exist_ok=True)

        video_input   = '/data' / video_path       .relative_to(self.collection_dir)
        tiny_output   = '/data' / tiny_video_path  .relative_to(self.collection_dir)
        medium_output = '/data' / medium_video_path.relative_to(self.collection_dir)

        # find out video duration
        service = 'ffmpeg'
        command = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json', '-show_format',
            str(video_input),
        ]

        ffprobe_output = []
        ret = self.compose_run(service, command, stdout_callback=ffprobe_output.append)
        ffprobe_output = ''.join(ffprobe_output)
        duration_s = float(json.loads(ffprobe_output).get('format').get('duration', 0))

        # execute reduction via ffmpeg
        command = [
            'ffmpeg',
            '-y', '-hide_banner', '-loglevel', 'error',
            '-progress', '-', '-nostats',
            ## Define input
            ] + (['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda',] if gpu else []) + [
            '-i', str(video_input),
            ## Define output 1 (tiny, 146 x height)
            ] + ([
                '-vf', "scale_npp=146:-1:force_divisible_by=2",
                '-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq',
            ] if gpu else [
                '-vf', "scale=146:-1:force_divisible_by=2,pad='iw+mod(iw\,2)':'ih+mod(ih\,2)'",
                '-c:v', 'libx264', '-preset', 'slower', '-crf', '28', '-movflags', '+faststart',
            ]) + [
            '-c:a', 'aac', '-b:a', '128k',
            str(tiny_output),
            # Define output 2 (medium, width x 480)
            ] + ([
                '-vf', "scale_npp=-1:480:force_divisible_by=2",
                '-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq',
            ] if gpu else [
                '-vf', "scale=-1:480:force_divisible_by=2,pad='iw+mod(iw\,2)':'ih+mod(ih\,2)'",
                '-c:v', 'libx264', '-preset', 'slower', '-crf', '30', '-movflags', '+faststart',
            ]) + [
            '-c:a', 'aac', '-b:a', '128k',
            str(medium_output),
        ]

        def stdout_callback(line):
            # parse ffmpeg progress output, keep only current time in milliseconds to update progress bar
            if show_progress and line.startswith('out_time_us'):
                current_time_s = float(line.rstrip().split('=')[1]) / 1_000_000
                show_progress(current_time_s, duration_s)

        return self.compose_run(service, command, stdout_callback=stdout_callback, stderr_callback=print)

    def detect_scenes_and_extract_frames(self, video_path, video_id, force=False, show_progress=None):
        """ Detect scenes from a video file and extract the middle frame of every scene.

        Args:
            video_path (pathlib.Path): Path to input video.
            video_id (str): Input Video ID.
            force (bool, optional): Whether to replace existing output or skip computation. Defaults to False.
            show_progress (func, optional): Callback to show progress.

        Returns:
            int: Return code of the scene detection command.
        """

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id

        scene_file = selected_frames_dir / f'{video_id}-scenes.csv'
        if not force and scene_file.exists():
            print('Skipping scene detection and frame generation, using existing files:', scene_file.name)
            if show_progress:
                show_progress(1, 1)  # set as completed
            return 0

        input_file = '/data' / video_path.relative_to(self.collection_dir)
        output_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)

        service = 'scene-detection'
        command = [
            '--quiet',
            '--input', str(input_file),
            '--output', str(output_dir),
            # '--min-scene-len', '0.6s'
            'detect-adaptive',
            'detect-threshold',
            'list-scenes', # '--quiet',
            '--skip-cuts',
            '--filename', f"{video_id}-scenes",
            'save-images',
            '--filename', f"{video_id}-$SCENE_NUMBER",
            '--num-images', '1',
            '--png', '--compression', '9',
        ]

        ret = self.compose_run(service, command)

        if show_progress:
            show_progress(1, 1)  # set as completed

        return ret

    def create_frames_thumbnails(self, video_id, force=False, show_progress=None):
        """ Creates thumbnails for the selected frames of a video.
            This implementation uses a dockerized version of ffmpeg.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.
            show_progress (func, optional): Callback to show progress.

        Returns:
            int: Return code of the thumbnail generation command.
        """
        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        thumbnail_dir = self.collection_dir / 'thumbnails' / video_id

        thumbnail_dir.mkdir(parents=True, exist_ok=True)

        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))
        thumbnails_list = sorted(thumbnail_dir.glob('*.jpg'))

        if not force and [i.stem for i in selected_frames_list] == [i.stem for i in thumbnails_list]:
            print('Skipping thumbnail generation, using existing files ...')
            if show_progress:
                show_progress(1,1)  # set as completed
            return 0

        n_frames = len(selected_frames_list)
        n_digits = len(selected_frames_list[0].stem.split('-')[-1])

        selected_frames = '/data' / selected_frames_dir.relative_to(self.collection_dir) / f'{video_id}-%0{n_digits}d.png'
        thumbnails = '/data' / thumbnail_dir.relative_to(self.collection_dir) / f'{video_id}-%0{n_digits}d.jpg'

        service = 'ffmpeg'
        command = [
            'ffmpeg',
            '-y', '-hide_banner',
            '-loglevel', 'error',
            '-progress', '-', '-nostats',
            '-i', str(selected_frames),
            '-vf', 'scale=192:-1',
            str(thumbnails),
        ]

        def stdout_callback(line):
            if show_progress and line.startswith('frame'):
                current_frame = int(line.rstrip().split('=')[1])
                show_progress(current_frame, n_frames)

        return self.compose_run(service, command, stdout_callback=stdout_callback, stderr_callback=print)

