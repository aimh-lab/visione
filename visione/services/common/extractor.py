import csv
from pathlib import Path
import itertools
import more_itertools
import re

# from visione import CliProgress
# from visione.savers import GzipJsonlFile, HDF5File
from . import CliProgress
from .savers import GzipJsonlFile, HDF5File


class BaseExtractor(object):
    """ Base class for all extractors. """

    @classmethod
    def add_arguments(cls, parser):
        """ Add arguments to the parser. """
        parser.add_argument('--batch-size', type=int, help='batch size')
        parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
        parser.add_argument('--gpu', default=False, action='store_true', help='use the GPU if available')
        parser.add_argument('--save-every', type=int, default=5000, help='save every N records')

        parser.add_argument('input_images', type=Path, help='images to be processed.'
            'Can be a directory or a file with a list of images.'
            'Each line of the list must be in the format: [[<video_id>\\t]<image_id>\\t]<image_path>\n'
            'If <video_id> is specified, contiguos images with the same <video_id> will be grouped together in the output files.'
            'If <image_id> is not specified, an incremental number will be used instead.')

        subparsers = parser.add_subparsers(dest='output_type')

        file_parser = subparsers.add_parser('jsonl', help='save results to gzipped JSONL files')
        file_parser.add_argument('-o', '--output', type=Path, help='output path template, where "{video_id}" will be replaced by the video id.')

        hdf5_parser = subparsers.add_parser('hdf5', help='save results to HDF5 files')
        hdf5_parser.add_argument('-n', '--features-name', default='generic', help='identifier of feature type')
        hdf5_parser.add_argument('-o', '--output', type=Path, help='output path template, where "{video_id}" will be replaced by the video id.')

    def __init__(self, args):
        """ Initialize the extractor. """
        super(BaseExtractor, self).__init__()
        self.args = args
        self.args.batch_size = self.args.batch_size or self.args.save_every

    def parse_input(self):
        """ Parses the input file and returns a list of (video_id, frame_id, frame_path) tuples. """

        input_path = self.args.input_images
        if input_path.is_dir():  # input is a directory, list all images in it
            image_paths = sorted(input_path.glob("*.png"))
            ids_and_paths = [(input_path.name, p.stem, p) for p in image_paths]
        else:  # input is a file, parse it
            with input_path.open() as image_list:
                reader = csv.reader(image_list, delimiter='\t')

                # peek at the first line to determine the number of columns
                peek, reader = itertools.tee(reader)
                num_cols = len(next(peek))
                del peek

                # parse the rest of the file
                if num_cols == 2:
                    parse_row = lambda row: ('', row[0], Path(row[1]))
                elif num_cols == 3:
                    parse_row = lambda row: (row[0], row[1], Path(row[2]))

                ids_and_paths = [parse_row(row) for row in reader]

        return ids_and_paths

    def get_saver(self, video_id):
        """ Returns a saver for the given video id. """
        output_path = str(self.args.output).format(video_id=video_id)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        save_every = self.args.save_every

        if self.args.output_type == 'jsonl':
            return GzipJsonlFile(output_path, flush_every=save_every)

        elif self.args.output_type == 'hdf5':
            return HDF5File(output_path, flush_every=save_every, attrs={'features_name': self.args.features_name})

    def extract(self, image_paths):
        """ Loads a batch of images and extracts features. """
        raise NotImplementedError()

    def extract_iterable(self, image_paths, batch_size=1):
        """ Consumes an iterable and returns an iterable of records.
            This method contains a fallback implementation using chunked processing,
            but subclasses can implement optimized solutions here.
        """
        batched_image_paths = more_itertools.chunked(image_paths, batch_size)
        batched_records = map(self.extract, batched_image_paths)
        records = itertools.chain.from_iterable(batched_records)
        return records

    def skip_existing(self, ids_and_paths, progress=None):
        """ Skips images that have already been processed. """
        for video_id, group in itertools.groupby(ids_and_paths, key=lambda x: x[0]):
            with self.get_saver(video_id) as saver:
                to_be_processed = []
                for video_id, image_id, image_path in group:
                    if image_id not in saver:
                        to_be_processed.append((video_id, image_id, image_path))
                    elif progress:
                        progress.initial += 1
            # ensure saver is closed before yielding from group
            yield from to_be_processed

    def run(self):
        ids_and_paths = self.parse_input()
        n_images = len(ids_and_paths)

        progress = CliProgress(initial=0, total=n_images)

        if not self.args.force:
            ids_and_paths = self.skip_existing(ids_and_paths, progress)

        # unzip ids and paths
        ids_and_paths = more_itertools.unzip(ids_and_paths)
        video_ids, image_ids, image_paths = more_itertools.padded(ids_and_paths, fillvalue=(), n=3)

        # process images in batches
        records = self.extract_iterable(image_paths, self.args.batch_size)
        ids_and_records = zip(video_ids, image_ids, records)
        ids_and_records = progress(ids_and_records)

        # group images by video id
        for video_id, group in itertools.groupby(ids_and_records, key=lambda x: x[0]):
            with self.get_saver(video_id) as saver:
                # make records
                records = ({'_id': _id, **record} for _, _id, record in group)

                # save records
                saver.add_many(records, force=self.args.force)


class BaseVideoExtractor(object):
    """ Base class for all video extractors. """

    @classmethod
    def add_arguments(cls, parser):
        """ Add arguments to the parser. """
        parser.add_argument('--batch-size', type=int, help='batch size')
        parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
        parser.add_argument('--gpu', default=False, action='store_true', help='use the GPU if available')
        parser.add_argument('--save-every', type=int, default=5000, help='save every N records')

        parser.add_argument('input_shots', type=Path, help='file containing the detected scenes.'
            'It is a file containing scenes information, in the format '
            '[Scene Number,Start Frame,Start Timecode,Start Time (seconds),End Frame,End Timecode,End Time (seconds),Length (frames),Length (timecode),Length (seconds)]'
            )

        subparsers = parser.add_subparsers(dest='output_type')

        file_parser = subparsers.add_parser('jsonl', help='save results to gzipped JSONL files')
        file_parser.add_argument('-o', '--output', type=Path, help='output path template, where "{video_id}" will be replaced by the video id.')

        hdf5_parser = subparsers.add_parser('hdf5', help='save results to HDF5 files')
        hdf5_parser.add_argument('-n', '--features-name', default='generic', help='identifier of feature type')
        hdf5_parser.add_argument('-o', '--output', type=Path, help='output path template, where "{video_id}" will be replaced by the video id.')

    def __init__(self, args):
        """ Initialize the extractor. """
        super(BaseVideoExtractor, self).__init__()
        self.args = args
        self.args.batch_size = self.args.batch_size or self.args.save_every

    def parse_input(self):
        """ Parses the input file and returns a list of
        (video_id, shot_id, video_path, start_frame, start_time, end_frame, end_time) tuples. """
        input_shots = self.args.input_shots

        if input_shots.is_dir():
            # inputs_shots is the directory of a single video
            video_id = input_shots.stem
            frame_paths = sorted(input_shots.glob("*.png"))
            frame_ids = [f.stem for f in frame_paths]
            shot_frames = list(zip(itertools.repeat(video_id), frame_ids, frame_paths))

        else:
            # input_shots is a tsv file containing (video_id, frame_id, frame_path)
            with input_shots.open() as image_list:
                shot_frames = list(csv.reader(image_list, delimiter='\t'))

        shot_paths_and_times = []

        # for each video, read the scenes.csv to get the time information
        for video_id, group in itertools.groupby(shot_frames, key=lambda x: x[0]):

            # get scenes file and video path from the frame path
            frame_ids, frame_paths = zip(*((fid, Path(fpath)) for _, fid, fpath in group))
            scenes_file = frame_paths[0].parent / f'{video_id}-scenes.csv'

            # find the video file (it can have any extension)
            # video_path = group[0][2].parents[2] / 'videos' / f'{video_id}.mp4'
            escaped_video_id = re.escape(video_id)
            candidates = (scenes_file.parents[2] / 'videos').glob(f'{video_id}.*')
            # candidates = list(candidates)
            # print(video_id, group[0][2], candidates)
            video_path = [c for c in candidates if re.match(rf'{escaped_video_id}\.[0-9a-zA-Z]+', c.name)][0]

            # read the scenes.csv file
            with scenes_file.open() as scenes:
                scenes_reader = csv.DictReader(scenes)
                frame_id_to_timeinfo_dict = {
                    int(row['Scene Number']): (
                        int(row['Start Frame']), 
                        float(row['Start Time (seconds)']),
                        int(row['End Frame']),
                        float(row['End Time (seconds)'])
                    ) for row in scenes_reader}

            for frame_id, frame_path in zip(frame_ids, frame_paths):
                scene_id = int(re.split('-|_', frame_path.stem)[-1])
                if scene_id not in frame_id_to_timeinfo_dict:
                    print(f'WARNING: scene {scene_id} not found in {scenes_file}')
                    
                timeinfo = frame_id_to_timeinfo_dict[scene_id]
                row = (video_id, frame_id, video_path, *timeinfo)
                shot_paths_and_times.append(row)

        return shot_paths_and_times

    def get_saver(self, video_id):
        """ Returns a saver for the given video id. """
        output_path = str(self.args.output).format(video_id=video_id)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        save_every = self.args.save_every

        if self.args.output_type == 'jsonl':
            return GzipJsonlFile(output_path, flush_every=save_every)

        elif self.args.output_type == 'hdf5':
            return HDF5File(output_path, flush_every=save_every, attrs={'features_name': self.args.features_name})

    def extract(self, shot_info):
        """ Loads a batch of shots and extracts features. """
        raise NotImplementedError()
    
    def extract_iterable(self, shot_infos, batch_size=1):
        """ Consumes an iterable and returns an iterable of records.
            This method contains a fallback implementation using chunked processing,
            but subclasses can implement optimized solutions here.
        """
        batched_shot_infos = more_itertools.chunked(shot_infos, batch_size)
        batched_records = map(self.extract, batched_shot_infos)
        records = itertools.chain.from_iterable(batched_records)
        return records

    def skip_existing(self, shot_paths_and_times, progress=None):
        """ Skips shots that have already been processed. """
        to_be_processed = []
        for video_id, group in itertools.groupby(shot_paths_and_times, key=lambda x: x[0]):
            with self.get_saver(video_id) as saver:
                for video_id, shot_id, image_path, *other in group:
                    if shot_id not in saver:
                        to_be_processed.append((video_id, shot_id, image_path, *other))
                    elif progress:
                        progress.initial += 1

        return to_be_processed

    def run(self):
        shot_paths_and_times = self.parse_input()
        n_shots = len(shot_paths_and_times)

        progress = CliProgress(initial=0, total=n_shots)

        if not self.args.force:
            shot_paths_and_times = self.skip_existing(shot_paths_and_times, progress)
            if len(shot_paths_and_times) == 0:
                return None

        # process images in batches
        records = self.extract_iterable(shot_paths_and_times, self.args.batch_size)

        # unzip ids and paths
        shot_paths_and_times_unzipped = more_itertools.unzip(shot_paths_and_times)
        video_ids, image_ids, image_paths, *_ = shot_paths_and_times_unzipped

        shot_ids_and_records = zip(video_ids, image_ids, records)
        shot_ids_and_records = progress(shot_ids_and_records)

        # group images by video id
        for video_id, group in itertools.groupby(shot_ids_and_records, key=lambda x: x[0]):
            with self.get_saver(video_id) as saver:
                # make records
                records = ({'_id': _id, **record} for _, _id, record in group)

                # save records
                saver.add_many(records, force=self.args.force)
