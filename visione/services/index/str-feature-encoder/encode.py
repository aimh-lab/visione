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
from tqdm import tqdm

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


# TODO factorize across services
def load_config_file(config_file_path):
    with open(config_file_path, 'r') as f:
        return json.load(f)


def load_or_build_encoder(encoder_filename, train_features, force):

    # instantiate STR encoder if not existing
    if not encoder_filename.exists() or force:
        # get encoder params
        config = load_config_file(args.config_file)
        config = config.get('str-feature-encoder', {})

        default_index_type = 'topk-sq'
        default_index_params = dict(keep=0.25, dim_multiplier=3)

        index_type = config.get('index_type', default_index_type)
        index_params = config.get('index_params', default_index_params)

        # init the encoder
        index_string = ', '.join(f'{k}={v}' for k, v in index_params.items())
        index_string = f'{index_type}({index_string})'
        log.info(f'Building encoder: {index_string}')

        n, d = train_features.shape
        encoder = surrogate.index_factory(d, index_type, index_params)

        assert encoder.is_trained, "Training the encoder on a single video is not supported. It will be supported for bulk indexing."

        if not encoder.is_trained:  # currently not used
            # get subsample if necessary for training
            n_train = min(n, 100_000)  # FIXME: better heuristic?
            # train the encoder
            log.info('Training the encoder ...')
            encoder.train(train_features[:n_train])  # FIXME random shuffling is missing
            log.info('Trained.')

        # save encoder
        log.info(f'Saving encoder: {encoder_filename}')
        surrogate.save_index(encoder, encoder_filename)
    else:
        log.info(f'Loading encoder: {encoder_filename}')
        encoder = surrogate.load_index(encoder_filename)

    return encoder


def main(args):

    # get features matrix
    with h5py.File(args.features_input_file, 'r') as f:
        ids = f['ids'].asstr()[:]
        features = f['data'][:]

    encoder = load_or_build_encoder(args.features_encoder_file, features, args.force_encoder)

    n_images = len(ids)
    initial = 0

    # if forced, delete old file
    if args.force and args.str_output_file.exists():
        args.str_output_file.unlink()

    # open saver
    with GzipJsonlFile(args.str_output_file, flush_every=args.save_every) as saver:
        skip_mask = [_id not in saver for _id in ids]
        ids = ids[skip_mask]
        features = features[skip_mask]

        n_rem = len(ids)
        initial = n_images - n_rem
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

        records = tqdm(records, initial=initial, total=n_images)
        saver.add_many(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Surrogate Text Encoding of Feature Vectors')

    parser.add_argument('--config-file', default='/data/index-config.json', help='path to indexing configuration json file')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    parser.add_argument('--force-encoder', default=False, action='store_true', help='overwrite existing trained encoder')
    parser.add_argument('--batch-size', type=int, default=5000, help='encoder batch size')

    parser.add_argument('features_input_file', type=Path, help='path to hdf5 file with frame features')
    parser.add_argument('features_encoder_file', type=Path, help='path to the pkl file defining the feature encoder. It will be created if missing.')
    parser.add_argument('str_output_file', type=Path, help='output path of the jsonl.gz file with STR-encoded features')

    args = parser.parse_args()
    main(args)