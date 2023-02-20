import argparse
import functools
import logging
import os
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

    # FIXME for IVF indices, we need to add a DirectMap (see https://github.com/facebookresearch/faiss/blob/a17a631dc326b3b394f4e9fb63d0a7af475534dc/tests/test_index.py#L585)
    # FIXME for non-Flat indice, reconstruction is lossy (may be good enough still)
    feat = index.get_internal_feature(img_id)
    if args.normalized:
        faiss.normalize_L2(feat)

    img_ids, similarities = index.search(feat, k=k)
    result_list = [{'imgId': img_id, 'score': round(float(score), 6)} for img_id, score in
                   zip(img_ids, similarities)]
    logging.debug(result_list[:10])
    out = jsonify(result_list)
    return out


def load_faiss_index(args):
    logging.info('Loading index ...')

    index = faiss.read_index(str(args.index_file))
    with open(args.idmap_file, 'r') as lines:
        ids = tuple(map(str.rstrip, lines))

    index = FaissWrapper(index, ids)
    logging.info('Index loaded from disk.')

    return index


if __name__ == '__main__':
    default_model_handle = os.environ['MODEL_HANDLE']
    features_name = os.environ['FEATURES_NAME']

    default_index_file = Path(f'/data/faiss-index_{features_name}.faiss')
    default_idmap_file = Path(f'/data/faiss-idmap_{features_name}.txt')

    parser = argparse.ArgumentParser(description='Create a webservice for CLIP model for t2i and i2i searches.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5030', help="Port to use for binding")
    parser.add_argument('--model-handle', default=default_model_handle, help='hugging face handle of the CLIP model')
    parser.add_argument('--no-normalized', action='store_false', dest='normalized', default=True, help='Wether to normalize features or not')

    parser.add_argument('--index-file', type=Path, default=default_index_file, help='where the faiss index will be saved on disk')
    parser.add_argument('--idmap-file', type=Path, default=default_idmap_file, help='path to id mapping for the faiss index')

    args = parser.parse_args()

    # build the index
    index = load_faiss_index(args)

    # init the query encoder
    qe = CLIPTextEncoder(args.model_handle)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)