import argparse
import logging
from pathlib import Path
import sys
import warnings

import h5py
import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.cluster import AgglomerativeClustering

from visione import cli_progress as progress
from visione.savers import GzipJsonlFile


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.DEBUG,
    stream=sys.stdout,
    format='%(asctime)s %(levelname)-8s:%(name)s:%(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True,
)
log = logging.getLogger(__name__)


@np.vectorize
def _ascii_encode(num, ascii_chars_lim=(33, 126)):
    """ Maps [0 ... 94^2-1] to two printable ASCII chars (codes 33-126). """
    # chars = ''.join(chr(i) for i in range (33, 127))

    amin, amax = ascii_chars_lim
    base = amax - amin + 1

    digit0 = chr(amin + (num // base))
    digit1 = chr(amin + (num % base))

    return digit0 + digit1


def cluster(X):
    num_samples = X.shape[0]

    # TODO better handling of edge case with only one sample
    if num_samples == 1:
        return ['!!']

    if num_samples > 94*94:
        warnings.warn(f'Exceeded max num clusters representable ({94*94 - 1}), codes might be wrong!')

    labels = []
    dX = squareform(pdist(X, 'euclidean'))
    thrs = np.arange(0.35, 1.50, 0.05)

    for thr in thrs:
        assignments = AgglomerativeClustering(
            affinity='precomputed',
            linkage='single',
            n_clusters=None,
            distance_threshold=thr,
        ).fit_predict(dX)

        labels.append(assignments)

        if len(np.unique(assignments)) == 1:
            break

    labels = np.column_stack(labels)
    codes = _ascii_encode(labels)
    codes = [''.join(c) for c in codes]

    return codes


def main(args):

    with h5py.File(args.features_file, 'r') as f:
        frames_ids = f['ids'].asstr()[:]
        frames_features = f['data'][:]

    frames_codes = cluster(frames_features)

    records = [{'_id': _id, 'cluster_code': code} for _id, code in zip(frames_ids, frames_codes)]
    records = progress(records)

    if args.force and args.output_codes_file.exists():
        args.output_codes_file.unlink()

    with GzipJsonlFile(args.output_codes_file) as saver:
        saver.add_many(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Cluster similar frames of a video.')

    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    parser.add_argument('features_file', type=Path, help='path to hdf5 file containing features of frames to cluster')
    parser.add_argument('output_codes_file', type=Path, help='path to output jsonl.gz file that will contain cluster codes of frames')

    args = parser.parse_args()
    main(args)