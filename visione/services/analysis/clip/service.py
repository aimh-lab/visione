import argparse
import functools
import logging
from pathlib import Path

import faiss
from flask import Flask, request, jsonify
import h5py
import more_itertools
import numpy as np
from tqdm import tqdm

from utils import CLIPTextEncoder, FaissWrapper


# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)

@app.route('/get-text-feature', methods=['GET'])
def get_text_features():
    text = request.args.get("text")
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text, normalized=args.normalized)
    out = jsonify(text_feature.tolist())
    return out

@app.route('/text-to-image-search', methods=['GET'])
def text_to_image_search():
    text = request.args.get("text")
    k = request.args.get("k", type=int, default=10000)
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text, normalized=args.normalized)
    img_ids, similarities = index.search(text_feature, k=k)
    result_list = [{'imgId': img_id, 'score': round(float(score), 6)} for img_id, score in zip(img_ids, similarities)]
    logging.debug(result_list[:10])
    out = jsonify(result_list)
    return out

@app.route('/internal-image-search', methods=['GET'])
def internal_image_search():
    img_id = request.args.get("imgId")
    k = request.args.get("k", type=int, default=10000)

    # connect to mongo and get feature corresponding to img_id
    item = features_collection.find_one({'_id': img_id}, {'feature': True})
    feat = np.asarray(item['feature'], dtype=np.float32)
    if args.normalized:
        faiss.normalize_L2(feat)

    img_ids, similarities = index.search(feat, k=k)
    result_list = [{'imgId': img_id, 'score': round(float(score), 6)} for img_id, score in
                   zip(img_ids, similarities)]
    logging.debug(result_list[:10])
    out = jsonify(result_list)
    return out


def load_features(hdf5_files, progress=False):
    pbar = tqdm(total=0, disable=not progress)

    for hdf5_file in hdf5_files:
        with h5py.File(hdf5_file, 'r') as h5file:
            ids = h5file['ids'].asstr()[:]
            features = h5file['data'][:]

            pbar.total += len(features)
            for item in zip(ids, features):
                pbar.update()
                yield item


def build_faiss_index(args):
    # index_path = Path('build')
    # index_path.mkdir(parents=True, exist_ok=True)

    # feats_file = index_path / f'clippone_features_{args.db}.h5'

    if not args.force and args.index_file.exists() and args.idmap_file.exists():
        logging.info('Loading index ...')
        index = faiss.read_index(str(args.index_file))
        with open(args.idmap_file, 'r') as lines:
            ids = tuple(map(str.rstrip, lines))
        logging.info('Index loaded from disk.')
        index = FaissWrapper(index, ids)
        return index

    features_files = args.features_dir.glob('*/*.hdf5')
    features_files = sorted(features_files)
    ids_and_features = load_features(features_files, progress=True)

    # peek features to get dimensionality (unpacking is a bit wild..)
    ((_, sample_feature),), ids_and_features = more_itertools.spy(ids_and_features)
    dim = sample_feature.shape[0]

    # create index
    logging.info(f'Creating index: {args.index_type} dim={dim} ...')
    metric = faiss.METRIC_INNER_PRODUCT
    index = faiss.index_factory(dim, args.index_type, metric)

    # add elements to index in batches
    ids = []
    batches_of_ids_and_features = more_itertools.batched(ids_and_features, args.batch_size)
    with open(args.idmap_file, 'w') as idmap_file:
        for batch_of_ids_and_features in batches_of_ids_and_features:
            batch_of_ids, batch_of_features = zip(*batch_of_ids_and_features)
            batch_of_features = np.stack(batch_of_features)
            
            ids += batch_of_ids
            idmap_file.write('\n'.join(batch_of_ids))
            idmap_file.write('\n')

            if not index.is_trained:
                logging.info('Training index ...')
                index.train(batch_of_features)
                logging.info('Index trained.')
            
            index.add(batch_of_features)
    logging.info('Index created.')

    logging.info('Saving index ...')
    faiss.write_index(index, str(args.index_file))
    logging.info('Index saved.')

    index = FaissWrapper(index, ids)
    return index


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create a webservice for CLIP model for t2i and i2i searches.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5030', help="Port to use for binding")
    parser.add_argument('--model-handle', default='laion/CLIP-ViT-H-14-laion2B-s32B-b79K', help='hugging face handle of the CLIP model')
    parser.add_argument('--no-normalized', action='store_false', dest='normalized', default=True, help='Wether to normalize features or not')

    parser.add_argument('--index-type', type=str, default='Flat', help='Which type of index we use')
    parser.add_argument('--force', action='store_true', help='Disable index caching and force index creation.')
    parser.add_argument('--batch-size', type=int, default=50_000, help='index this amount of features at a time. If index needs training, it will be trained on the first batch of features')

    parser.add_argument('--features-dir', type=Path, help='path to analysis directory containing features h5df files')
    parser.add_argument('--index_file', type=Path, help='where the faiss index will be saved on disk')
    parser.add_argument('--idmap_file', type=Path, help='path to id mapping for the faiss index')

    args = parser.parse_args()

    normalized_handle = args.model_handle.replace('/', '-')
    args.features_dir = args.features_dir or Path(f'/data/clip-{normalized_handle}')
    args.index_file = args.index_file or Path(f'/data/faiss-index-{normalized_handle}.faiss')
    args.idmap_file = args.idmap_file or Path(f'/data/faiss-idmap-{normalized_handle}.txt')

    assert args.features_dir.exists() or (args.index_file.exists() and args.idmap_file.exists()), "No features or trained index found, cannot create or load an index."

    # build the index
    index = build_faiss_index(args)

    # init the query encoder
    qe = CLIPTextEncoder(args.model_handle)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)