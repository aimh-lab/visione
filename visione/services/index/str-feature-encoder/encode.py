import argparse
import functools
import itertools
import json
import logging
from pathlib import Path
import sys

import h5py
import more_itertools
import surrogate

from visione import load_config, CliProgress, cli_progress
from visione.savers import GzipJsonlFile


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.DEBUG,
    stream=sys.stdout,
    format='%(asctime)s %(levelname)-8s:%(name)s:%(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)


def get_features(features_input_template, video_ids):
    features_input_template = str(features_input_template)

    # peek features name
    features_h5 = features_input_template.format(video_id=video_ids[0])
    with h5py.File(features_h5, 'r') as f:
        features_name = f.attrs['features_name']
        features_dim = f['data'].shape[1]
    
    # generate training set
    def _gen():
        for video_id in video_ids:
            features_h5 = features_input_template.format(video_id=video_id)
            with h5py.File(features_h5, 'r') as f:
                yield from f['data']

    train_features = _gen()
    return features_dim, features_name, train_features


def load_or_build_encoder(encoder_filename, encoder_config, dim, features, n_train, force):

    # instantiate STR encoder if not existing
    if not encoder_filename.exists() or force:
        # get encoder params

        default_index_type = 'topk-sq'
        default_index_params = dict(keep=0.25, dim_multiplier=3)

        index_type = encoder_config.get('index_type', default_index_type)
        index_params = encoder_config.get('index_params', default_index_params)

        # init the encoder
        index_string = ', '.join(f'{k}={v}' for k, v in index_params.items())
        index_string = f'{index_type}({index_string})'
        log.info(f'Building encoder: {index_string}')

        encoder = surrogate.index_factory(dim, index_type, index_params)

        assert encoder.is_trained, "Training the encoder on a single video is not supported. It will be supported for bulk indexing."

        if not encoder.is_trained:  # currently not used
            # get subsample if necessary for training
            train_features = itertools.islice(features, 0, n_train)
            # train the encoder
            log.info('Training the encoder ...')
            encoder.train(train_features)  # FIXME random shuffling is missing
            log.info('Trained.')

        # save encoder
        log.info(f'Saving encoder: {encoder_filename}')
        surrogate.save_index(encoder, encoder_filename)
    else:
        log.info(f'Loading encoder: {encoder_filename}')
        encoder = surrogate.load_index(encoder_filename)

    return encoder


def process_video_id(features_input_file, str_output_file, encoder, force, save_every):

    with h5py.File(features_input_file, 'r') as f:
        if str_output_file.exists():
            if force:  # if forced, delete old file
                str_output_file.unlink()
            else:
                print(f'Skipping STR features encoding, using existing file:', str_output_file.name)
                return

        # get ids and features matrix
        ids = f['ids'].asstr()[:]
        features = f['data'][:]

    # open saver
    str_output_file.parent.mkdir(parents=True, exist_ok=True)
    with GzipJsonlFile(str_output_file, flush_every=save_every) as saver:
        skip_mask = [_id not in saver for _id in ids]
        ids = ids[skip_mask]
        features = features[skip_mask]

        n_rem = len(ids)
        bs = args.batch_size

        # create batches of features
        batches_of_features = (features[i:i + bs] for i in range(0, n_rem, bs))

        # encode and generate surrogate documents in batches
        str_encode = functools.partial(encoder.encode, inverted=False)
        batches_of_encoded_features = map(str_encode, batches_of_features)
        batches_of_str_encodings = map(surrogate.generate_documents, batches_of_encoded_features)
        str_encodings = itertools.chain.from_iterable(batches_of_str_encodings)

        # generate records
        records = ({'_id': _id, 'feature_str': surrogate_text} for _id, surrogate_text in zip(ids, str_encodings))
        saver.add_many(records)


def main(args):

    video_ids = None
    if args.video_ids_list_path:
        with args.video_ids_list_path.open() as f:
            video_ids = list(map(str.strip, f))
    
    if args.video_ids:
        video_ids = args.video_ids
    
    # peek features names and training set
    features_dim, features_name, features = get_features(args.features_input_template, video_ids)
    
    # get encoder config
    encoder_config = load_config(args.config_file)['index']['features'][features_name]
    encoder = load_or_build_encoder(args.features_encoder_file, encoder_config, features_dim, features, args.train_size, args.force_encoder)

    for video_id in cli_progress(video_ids, total=len(video_ids)):
        features_input_file = Path(str(args.features_input_template).format(video_id=video_id))
        str_output_file = Path(str(args.str_output_template).format(video_id=video_id))
        process_video_id(features_input_file, str_output_file, encoder, args.force, args.save_every)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Surrogate Text Encoding of Feature Vectors')

    parser.add_argument('--config-file', default='/data/config.yaml', help='path to yaml configuration file')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    parser.add_argument('--force-encoder', default=False, action='store_true', help='overwrite existing trained encoder')
    parser.add_argument('--batch-size', type=int, default=5000, help='encoder batch size')
    parser.add_argument('--train-size', type=int, default=10_000, help='encoder train set size')

    parser.add_argument('--video-ids-list-path', type=Path, help='path to file with list of video ids to process')
    parser.add_argument('--video-ids', nargs='+', help='list of video ids to process')

    parser.add_argument('features_input_template', type=Path, help='path to hdf5 file with frame features. {video_id} will be replaced by the video id.')
    parser.add_argument('features_encoder_file', type=Path, help='path to the pkl file defining the feature encoder. It will be created if missing.')
    parser.add_argument('str_output_template', type=Path, help='output path of the jsonl.gz file with STR-encoded features. {video_id} will be replaced by the video id.')

    args = parser.parse_args()
    main(args)