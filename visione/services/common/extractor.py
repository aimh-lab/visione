from pathlib import Path
import itertools
import more_itertools

from visione import cli_progress
from visione.savers import GzipJsonlFile, HDF5File


class BaseExtractor(object):
    """ Base class for all extractors. """

    @classmethod
    def add_arguments(cls, parser):
        """ Add arguments to the parser. """
        parser.add_argument('--batch-size', type=int, default=3, help='batch size')
        parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
        parser.add_argument('--gpu', default=False, action='store_true', help='use the GPU if available')
        parser.add_argument('--save-every', type=int, default=100, help='save every N records')

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

    def parse_input(self):
        """ Parses the input file and returns a list of (video_id, frame_id, frame_path) tuples. """

        input_path = self.args.input_images
        if input_path.is_dir():  # input is a directory, list all images in it
            image_paths = sorted(input_path.glob("*.png"))
            ids_and_paths = [(input_path.name, p.name, p) for p in image_paths]
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
        save_every = self.args.save_every

        if self.args.output_type == 'jsonl':
            return GzipJsonlFile(output_path, flush_every=save_every)

        elif self.args.output_type == 'hdf5':
            return HDF5File(output_path, flush_every=save_every, attrs={'features_name': self.args.features_name})

    def extract(self, image_paths):
        """ Loads a batch of images and extracts features. """
        raise NotImplementedError()

    def run(self):
        ids_and_paths = self.parse_input()
        ids_and_paths = cli_progress(ids_and_paths, initial=0, total=len(ids_and_paths))

        # group images by video id
        for video_id, group in itertools.groupby(ids_and_paths, key=lambda x: x[0]):

            with self.get_saver(video_id) as saver:
                # filter out images that have already been processed
                if not self.args.force:
                    group = filter(lambda x: x[1] not in saver, group)

                # unzip ids and paths
                group = more_itertools.unzip(group)
                _, image_ids, image_paths = more_itertools.padded(group, fillvalue=(), n=3)

                # process images in batches
                batched_image_paths = more_itertools.chunked(image_paths, self.args.batch_size)
                batched_records = map(self.extract, batched_image_paths)
                records = itertools.chain.from_iterable(batched_records)

                # make records
                records = ({'_id': _id, **record} for _id, record in zip(image_ids, records))

                # save records
                saver.add_many(records, force=self.args.force)