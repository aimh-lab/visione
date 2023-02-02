import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

from tqdm import tqdm

from .command import BaseCommand


class ImportCommand(BaseCommand):
    """ Implements the 'import' CLI command. """

    def __init__(self, *args, **kwargs):
        super(ImportCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('import', help='Import videos to the collection')
        parser.add_argument('--id', dest='video_id', help='Video ID. If None, take the filename without extension as ID.')
        parser.add_argument('--replace', default=False, action='store_true', help='Replace any existing video with the given Video ID.')
        parser.add_argument('video_path_or_url', nargs='?', default=None, help='Path or URL to video file to be imported. If not given, resumes importing of existing videos.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_path_or_url, video_id, replace):
        # TODO handle (video_path_or_url == None) case

        # import video file
        video_id, video_path = self.copy_or_download_video_from_url(video_path_or_url, video_id, replace)

        # create resized video files
        # TODO run this in background
        self.create_resized_videos(video_path, video_id, replace)

        # detect scenes and extract frames
        self.detect_scenes_and_extract_frames(video_path, video_id, replace)

        # create frames thumbnails
        self.create_frames_thumbnails(video_id, replace)

        # do analyses
        self.extract_gem_features(video_id, force=replace)

    def copy_or_download_video_from_url(self, video_path_or_url, video_id=None, replace=False):
        """ Copies or downloads a video from a local path or URL and places it
            in `./videos/<video_id>.<ext>`.

        Args:
            video_path_or_url (str or pathlib.Path): Local path or URL of the video.
            video_id (str, optional): New ID of the downloaded video. If None, take the video file stem as video ID. Defaults to None.
            replace (bool, optional): Whether to replace any existing video with the same video_id. Defaults to False.

        Returns:
            video_id (str): The given video ID (useful if video_id was None).
            video_path (pathlib.Path): Path to the copied video.
        """
        try:  # try network URL
            video_file = urllib.request.urlopen(video_path_or_url)
            length = int(video_file.getheader('content-length', 0))

            video_filename = urllib.parse.urlparse(video_path_or_url).path
            video_filename = Path(video_filename)

        except ValueError:  # try local path
            video_file = open(video_path_or_url, 'rb')
            length = os.path.getsize(video_path_or_url)

            video_filename = Path(video_path_or_url)

        video_id = str(video_filename.stem) if not video_id else video_id
        video_ext = str(video_filename.suffix)

        video_out = self.collection_dir / 'videos' / f'{video_id}{video_ext}'
        if video_out.exists() and not replace:
            print(f'Using existing video file: {video_out.name}')
            video_file.close()
            return video_id, video_out

        print(f'Importing: {video_id} -> {video_out.name}')
        with open(video_out, 'wb') as out_file, tqdm(
            desc=f'Copying video',
            total=length,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
        ) as progress:
            data = video_file.read(1024)
            while data:
                size = out_file.write(data)
                progress.update(size)
                data = video_file.read(1024)

        video_file.close()
        return video_id, video_out

    def create_resized_videos(self, video_path, video_id, force=False):
        """ Created downsampled videos for visualization purposes.
            This implementation uses a dockerized version of ffmpeg.

        Args:
            video_path (pathlib.Path): Path to input video.
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        resized_video_dir = self.collection_dir / 'resized-videos'
        tiny_video_path   = resized_video_dir / 'tiny'   / f'{video_id}-tiny.mp4'
        medium_video_path = resized_video_dir / 'medium' / f'{video_id}-medium.mp4'

        if not force and tiny_video_path.exists() and medium_video_path.exists():
            print('Skipping video resizing, using existing files:', tiny_video_path.name, medium_video_path.name)
            return 0

        tiny_video_path  .parent.mkdir(parents=True, exist_ok=True)
        medium_video_path.parent.mkdir(parents=True, exist_ok=True)

        tiny_output   = Path('/out') / tiny_video_path  .relative_to(resized_video_dir)
        medium_output = Path('/out') / medium_video_path.relative_to(resized_video_dir)

        # find out video duration
        command = [
            'docker', 'run', '--rm',
            '-v', f'{video_path.resolve()}:/input_file:ro',
            '--entrypoint', 'ffprobe',
            'linuxserver/ffmpeg:5.1.2',
            '-v', 'quiet',
            '-print_format', 'json', '-show_format',
            '/input_file'
        ]
        
        ret = subprocess.run(command, stdout=subprocess.PIPE, check=True).stdout
        duration_s = float(json.loads(ret).get('format').get('duration', 0))

        # execute reduction via ffmpeg
        command = [
            ## Call containerized ffmpeg
            'docker', 'run', '--rm',
            '-v', f'{video_path.resolve()}:/input_file:ro',
            '-v', f'{resized_video_dir.resolve()}:/out',
            'linuxserver/ffmpeg:5.1.2', # 'ffmpeg'
            '-y', '-hide_banner', '-loglevel', 'warning', # '-threads ${THREADS}'
            '-progress', '-', '-nostats',
            ## Define input
            '-i', '/input_file',
            ## Define output 1 (tiny, 146 x height)
            '-vf', "scale=146:-1:force_divisible_by=2,pad='iw+mod(iw\,2)':'ih+mod(ih\,2)'",
            '-c:v', 'libx264', '-preset', 'slower', '-crf', '28', '-movflags', '+faststart',
            '-c:a', 'aac', '-b:a', '128k', # '-threads ${THREADS}'
            tiny_output,
            # Define output 2 (medium, width x 480)
            '-vf', "scale=-1:480:force_divisible_by=2,pad='iw+mod(iw\,2)':'ih+mod(ih\,2)'",
            '-c:v', 'libx264', '-preset', 'slower', '-crf', '30', '-movflags', '+faststart',
            '-c:a', 'aac', '-b:a', '128k', # '-threads ${THREADS}'
            medium_output,
        ]

        with subprocess.Popen(command, text='utf8', bufsize=1, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as ffmpeg, \
            tqdm(desc='Resizing video', total=duration_s, unit='s') as progress:
            
            # parse ffmpeg progress output, keep only current time in milliseconds to update progress bar
            for line in ffmpeg.stdout:
                if line.startswith('out_time_us'):
                    current_time_ms = float(line.rstrip().split('=')[1]) / 1_000_000
                    progress.update(current_time_ms - progress.n)

        return ret

    def detect_scenes_and_extract_frames(self, video_path, video_id, force=False):
        """ Detect scenes from a video file and extract the middle frame of every scene.

        Args:
            video_path (pathlib.Path): Path to input video.
            video_id (str): Input Video ID.
            force (bool, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id

        scene_file = selected_frames_dir / f'{video_id}-scenes.csv'
        if not force and scene_file.exists():
            print('Skipping scene detection and frame generation, using existing files:', scene_file.name)
            return 0

        input_file = video_path.relative_to(self.collection_dir)
        output_dir = selected_frames_dir.relative_to(self.collection_dir)

        command = [
            'docker-compose',
            '--project-directory', str(self.install_dir),
            '--env-file', str(self.collection_dir / 'config.env'),
            'run',
            '--rm',
            '-w', '/data',
            'scene-detection',
            '--verbosity', 'error',
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

        ret = subprocess.run(command, check=True, env={'VISIONE_ROOT': Path.cwd(), **os.environ})
        return ret

    def create_frames_thumbnails(self, video_id, force=False):
        """ Creates thumbnails for the selected frames of a video.
            This implementation uses a dockerized version of ffmpeg.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            # TODO
        """
        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        thumbnail_dir = self.collection_dir / 'thumbnails' / video_id

        thumbnail_dir.mkdir(parents=True, exist_ok=True)

        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))
        thumbnails_list = sorted(thumbnail_dir.glob('*.png'))

        if not force and [i.name for i in selected_frames_list] == [i.name for i in thumbnails_list]:
            print('Skipping thumbnail generation, using existing files ...')
            return 0
        
        n_frames = len(selected_frames_list)
        n_digits = len(selected_frames_list[0].stem.split('-')[-1])

        command = [
            'docker', 'run', '--rm',
            '-v', f'{selected_frames_dir.resolve()}:/input_dir:ro',
            '-v', f'{thumbnail_dir.resolve()}:/output_dir',
            'linuxserver/ffmpeg:5.1.2',
            '-y', '-hide_banner', '-loglevel', 'warning', # '-threads ${THREADS}'
            '-progress', '-', '-nostats',
            '-i', f'/input_dir/{video_id}-%0{n_digits}d.png',
            '-vf', 'scale=192:-1',
            f'/output_dir/{video_id}-%0{n_digits}d.png',
        ]

        with subprocess.Popen(command, text='utf8', bufsize=1, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) as ffmpeg, \
            tqdm(desc='Generating thumbs', total=n_frames, unit='s') as progress:
            
            # parse ffmpeg progress output, keep only current time in milliseconds to update progress bar
            for line in ffmpeg.stdout:
                if line.startswith('frame'):
                    current_frame = int(line.rstrip().split('=')[1])
                    progress.update(current_frame - progress.n)

    def extract_gem_features(self, video_id, force=False):
        """ Extracts GeM features from selected keyframes of a video for instance retrieval.

        Args:
            video_id (str): Input Video ID.
            force (str, optional): Whether to replace existing output or skip computation. Defaults to False.

        Returns:
            _type_: _description_
        """
        gem_dir = self.collection_dir / 'gem' / video_id
        gem_dir.mkdir(parents=True, exist_ok=True)

        gem_features_file = gem_dir / f'{video_id}-gem.hdf5'
        if not force and gem_features_file.exists():
            print('Skipping GeM extraction, using existing file:', gem_features_file.name)
            return 0

        selected_frames_dir = self.collection_dir / 'selected-frames' / video_id
        selected_frames_list = sorted(selected_frames_dir.glob('*.png'))

        input_dir = '/data' / selected_frames_dir.relative_to(self.collection_dir)
        output_file = '/data' / gem_features_file.relative_to(self.collection_dir)

        command = [
            'docker-compose',
            '--project-directory', str(self.install_dir),
            '--env-file', str(self.collection_dir / 'config.env'),
            'run',
            '--rm',
            '--no-deps',
            'features-gem',
            'python', 'extract.py',
            str(input_dir),
            '--save-every', '200',
            'hdf5',
            '--output', str(output_file),
        ]

        ret = subprocess.run(command, check=True, env={'VISIONE_ROOT': Path.cwd(), **os.environ})
        return ret
