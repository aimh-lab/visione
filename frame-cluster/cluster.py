import argparse
import itertools
from functools import partial
from pprint import pprint
import warnings

import numpy as np
from pymongo import MongoClient
from pymongo.errors import BulkWriteError
from pymongo.operations import UpdateOne
from scipy.spatial.distance import pdist, squareform
from sklearn.cluster import AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.preprocessing import normalize
from tqdm import tqdm


@np.vectorize
def _ascii_encode(num, ascii_chars_lim=(33, 126)):
    """ Maps [0 ... 94^2-1] to two printable ASCII chars (codes 33-126). """
    # chars = ''.join(chr(i) for i in range (33, 127))
    
    amin, amax = ascii_chars_lim
    base = amax - amin + 1
    
    digit0 = chr(amin + (num // base))
    digit1 = chr(amin + (num % base))
    
    return digit0 + digit1


def _cluster(X):
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


def _apply_clustering(features_collection, video_info):
     # get all features of a video
    results = features_collection.find({'_id': {'$in': video_info['frames']}}, {'feature': True})

    frames_ids = []
    frames_features = []
    for doc in results:
        frames_ids.append(doc['_id'])
        frames_features.append(doc['feature'])
    
    frames_features = np.array(frames_features)
    frames_codes = _cluster(frames_features)

    return frames_ids, frames_codes


def _generate_write_ops(clustered_frames):
    for frame_id, frame_code in zip(*clustered_frames):
        yield UpdateOne({'_id': frame_id}, {'$set': {'cluster_code': frame_code}})


def _grouper(iterable, n):
    """ Iterates an iterable in batches. E.g.,
        grouper([1, 2, 3, 4, 5], 2)  -->  [(1, 2), (3, 4), (5,)]
    """
    it = iter(iterable)
    while True:
        chunk_it = itertools.islice(it, n)
        try:
            first_el = next(chunk_it)
        except StopIteration:
            return
        yield itertools.chain((first_el,), chunk_it)


def main(args):
    client = MongoClient(args.host, port=args.port, username=args.username, password=args.password)
    frames_collection = client[args.db]['frames']
    features_collection = client[args.db][args.features_collection]

    # group frames by video_id and iterate
    grouped_frames = frames_collection.aggregate([
        {'$group': {
            '_id': '$video_id',  # groupby key
            'frames': {'$push': '$_id'}  # set of frames ids
        }}
    ])

    clustering_fn = partial(_apply_clustering, features_collection)
    clustered_frames = map(clustering_fn, grouped_frames)

    write_ops = map(_generate_write_ops, clustered_frames)
    write_ops = itertools.chain.from_iterable(write_ops)

    n_frames = client[args.db].command('collstats', 'frames')['count']
    write_ops = tqdm(write_ops, total=n_frames)

    batches_of_ops = _grouper(write_ops, args.batch_size)
    batches_of_ops = map(list, batches_of_ops)

    for batch_of_ops in batches_of_ops:
        try:
            frames_collection.bulk_write(batch_of_ops, ordered=False)
        except BulkWriteError as bwe:
            print('Something wrong in updating docs with codes:')
            pprint(bwe.details)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Cluster similar frames of a video.')

    parser.add_argument('--host', default='mongo')
    parser.add_argument('--port', type=int, default=27017)
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', default='visione')
    parser.add_argument('db')
    parser.add_argument('--features-collection', default='features.gem')
    parser.add_argument('--batch-size', type=int, default=1000)

    args = parser.parse_args()
    main(args)