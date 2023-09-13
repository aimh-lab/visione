import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import urllib.parse
import urllib.request

from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn, MofNCompleteColumn

from .command import BaseCommand

# TODO test supported video formats
SUPPORTED_VIDEO_FORMATS = [
    ".webm",
    ".mpg", ".mp2", ".mpeg", ".mpe", ".mpv"
    ".ogg",
    ".mp4", ".m4p", ".m4v",
    ".avi",
    ".wmv",
    ".mov", ".qt",
    ".flv", ".swf"
    ".h264",
    ".3g2", ".3gp",
    ".m4v",
]

DEFAULT_SCENE_LENGTH_PARAMS = [
    '--min-scene-len', '1',
    '--drop-short-scenes',  # ensures that every scene has at least one frame
]
DEFAULT_DETECTION_PARAMS = [
    'detect-adaptive',
    'detect-threshold',
]
DEFAULT_SCENE_FRAMES_PAARMS = [
    '--num-images', '1',
    '--png', '--compression', '9',
]

def str2list(string):
    return string.split(' ')


class ImportCommand(BaseCommand):
    """ Implements the 'import' CLI command. """

    def __init__(self, *args, **kwargs):
        super(ImportCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('import', help='Imports a video to the collection.')
        parser.add_argument('--id', dest='video_id', help='Video ID. If None, take the filename without extension as ID.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing video with the given Video ID.')
        parser.add_argument('--no-gpu', dest='gpu', default=self.is_gpu_available(), action='store_false', help='Do not use the GPU if available.')
        parser.add_argument('--bulk', default=False, action='store_true', help='Apply processing step-wise instead of video-wise.')

        parser.add_argument('--scene-length-params', default=DEFAULT_SCENE_LENGTH_PARAMS, type=str2list, help='A string (use quotes) with scenedetect option parameters (see https://www.scenedetect.com/docs/latest/cli.html#options)')
        parser.add_argument('--scene-detection-params', default=DEFAULT_DETECTION_PARAMS, type=str2list, help='A string (use quotes) with scenedetect detection parameters (see https://www.scenedetect.com/docs/latest/cli.html#detectors)')
        parser.add_argument('--scene-frames-params', default=DEFAULT_SCENE_FRAMES_PAARMS, type=str2list, help='A string (use quotes) with scenedetect save-image parameters (see https://www.scenedetect.com/docs/latest/cli.html#save-images)')

        parser.add_argument('video_path_or_url', nargs='?', default=None, help='Path or URL to video file to be imported. If not given, resumes importing of existing videos.')
        parser.set_defaults(func=self)

    def __call__(
        self, *,
        video_path_or_url,
        video_id,
        replace,
        gpu,
        scene_length_params,
        scene_detection_params,
        scene_frames_params,
        bulk=False,
        **kwargs,
        ):
        super(ImportCommand, ImportCommand).__call__(self, **kwargs)
        self.create_services_containers()

        assert not (video_id and video_path_or_url is None), "Cannot specify --id without video_path_or_url"

        multi_import = video_path_or_url is None
        if multi_import:
            # import all videos in the collection 'videos' directory
            videos_dir = self.collection_dir / 'videos'
            video_paths = [v for v in videos_dir.glob('*') if v.suffix.lower() in SUPPORTED_VIDEO_FORMATS]
            video_paths.sort()
            assert len({v.stem for v in video_paths}) == len(video_paths), "Duplicate video IDs found in collection 'videos' directory."
            video_paths = [str(v) for v in video_paths]
        else:
            # import a single video
            video_paths = [video_path_or_url]
        
        scene_params = [
            scene_length_params,
            scene_detection_params,
            scene_frames_params,
        ]

        if bulk and multi_import:
           return self._import_bulk(video_paths, replace, gpu, scene_params)
        
        return self._import_sequential(video_paths, multi_import, video_id, replace, gpu, scene_params)


    def _import_sequential(self, video_paths, multi_import, video_id, replace, gpu, scene_params):
        progress_cols = [SpinnerColumn(), *Progress.get_default_columns(), TimeElapsedColumn()]
        with Progress(*progress_cols, transient=not self.develop_mode) as progress:

            def show_progress(task_id):
                return lambda completed, total: progress.update(task_id, completed=completed, total=total)

            task = progress.add_task(f"Importing ...", total=len(video_paths))

            for video_path in video_paths:
                progress.update(task, description=f"Importing {video_id or video_path}")
                video_id = None if multi_import else video_id
                subtasks = []

                # import video file
                subtask = progress.add_task('- Copying video file')
                overwrite = replace if not multi_import else False
                video_id, video_path = self.copy_or_download_video(video_path, video_id, overwrite, show_progress(subtask))
                subtasks.append(subtask)

                # create resized video files
                subtask = progress.add_task('- Resizing video')
                thread = threading.Thread(target=self.create_resized_videos, args=(video_path, video_id, replace, gpu, show_progress(subtask)))
                thread.start()
                subtasks.append(subtask)

                # detect scenes and extract frames
                subtask = progress.add_task('- Detect scenes', total=None)
                self.detect_scenes_and_extract_frames(video_path, video_id, *scene_params, force=replace, show_progress=show_progress(subtask))
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

        # if bulk import, return an empty list to represent all imported videos
        # otherwise, return the video ID of the imported video
        # XXX this is for supporting the 'add' cli command but the interface needs to be improved
        ret = [] if multi_import else [video_id]
        return ret

    def _import_bulk(self, video_paths, replace, gpu, scene_params):
        progress_cols = [SpinnerColumn(), *Progress.get_default_columns(), MofNCompleteColumn(), TimeElapsedColumn()]
        with Progress(*progress_cols, transient=not self.develop_mode) as progress, \
             concurrent.futures.ThreadPoolExecutor(os.cpu_count()) as executor:
            
            def map_with_progress(func, iterable, description=None, total=None):
                total = total if total else len(iterable) if hasattr(iterable, '__len__') else None
                task = progress.add_task(description, total=total)

                futures = [executor.submit(func, it) for it in iterable]
                results = []
                for future in concurrent.futures.as_completed(futures):
                    results.append(future.result())
                    progress.advance(task)

                return results

            # copy all video files
            video_ids_and_paths = map_with_progress(self.copy_or_download_video, video_paths, description='Copying video files')

            # create all resized videos
            func = lambda x: self.create_resized_videos(x[1], x[0], replace, gpu)
            map_with_progress(func, video_ids_and_paths, description='Resizing videos')

            # detect scenes and extract frames
            func = lambda x: self.detect_scenes_and_extract_frames(x[1], x[0], *scene_params, force=replace)
            map_with_progress(func, video_ids_and_paths, description='Detecting scenes')

            # create frames thumbnails
            func = lambda x: self.create_frames_thumbnails(x[0], replace)
            map_with_progress(func, video_ids_and_paths, description='Generating thumbs')

            progress.console.log('Import complete.')

        # if bulk import, return an empty list to represent all imported videos
        # otherwise, return the video ID of the imported video
        # XXX this is for supporting the 'add' cli command but the interface needs to be improved
        return []

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
        if video_out.exists() and (not replace or video_out.samefile(video_path_or_url)):
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

        return self.compose_run(service, command, stdout_callback=stdout_callback)

    def detect_scenes_and_extract_frames(
        self,
        video_path,
        video_id,
        scene_length_params,
        scene_detection_params,
        scene_frames_params,
        force=False,
        show_progress=None,
    ):
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

        scene_length_params = [
            '--min-scene-len', '1',
            '--drop-short-scenes',  # ensures that every scene has at least one frame
        ]
        detection_params = [
            'detect-adaptive',
            'detect-threshold',
        ]
        saved_frames_params = [
            '--num-images', '1',
            '--png', '--compression', '9',
        ]

        command = [
            '--quiet',
            '--input', str(input_file),
            '--output', str(output_dir),
        ] + scene_length_params + [
        ] + detection_params + [
            'list-scenes', # '--quiet',
            '--skip-cuts',
            '--filename', f"{video_id}-scenes",
            'save-images',
            '--filename', f"{video_id}-$SCENE_NUMBER",
        ] + saved_frames_params + [
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

