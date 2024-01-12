import argparse
import logging
import os
from pathlib import Path

import faiss
from flask import Flask, request, jsonify
import numpy as np

from visione import load_config


# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)

loaded_indices = {}


class FaissWrapper():
    def __init__(self, index, ids) -> None:
        self.index = index
        self.ids = list(ids) if not isinstance(ids, list) else ids
        self.id_map = {_id: i for i, _id in enumerate(ids)}

    def search(self, feat, k=10):
        D, I = self.index.search(feat, k)
        I = I[0]
        D = D[0]

        # filter out non-retrieved results
        valid = I >= 0
        I = I[valid]
        D = D[valid]

        img_ids = [self.ids[i] for i in I]
        return img_ids, D

    def get_internal_feature(self, img_id):
        faiss_internal_id = self.id_map[img_id]
        feat = self.index.reconstruct(faiss_internal_id)
        feat = np.atleast_2d(feat)
        return feat


def load_index(feature_type):
    if feature_type in loaded_indices:
        return loaded_indices[feature_type]

    index_wrapper = None
    index_path = f'/data/faiss-index_{feature_type}.faiss'
    idmap_path = f'/data/faiss-idmap_{feature_type}.txt'
    if os.path.exists(index_path) and os.path.exists(idmap_path):
        # read faiss index
        index = faiss.read_index(index_path, faiss.IO_FLAG_MMAP)
        # read idmap
        with open(idmap_path, 'r') as lines:
            ids = list(map(str.rstrip, lines))

        index_wrapper = FaissWrapper(index, ids)
        loaded_indices[feature_type] = index_wrapper

    return index_wrapper


@app.route('/search', methods=['POST'])
def search():
    data = request.get_json()

    if 'type' not in data:
        return "Missing 'type' key in request.", 400  # BAD_REQUEST
    if 'feature_vector' not in data and 'query_id' not in data:
        return "At least one among 'feature_vector' and 'query_id' keys must be present in the request.", 400  # BAD_REQUEST

    feature_type = data['type']
    index = load_index(feature_type)
    if index is None:
        return f"No index found for '{feature_type}' features.", 400  # BAD_REQUEST

    feature_vector = data.get('feature_vector', None)
    if 'query_id' in data:
        # FIXME for IVF indices, we need to add a DirectMap (see https://github.com/facebookresearch/faiss/blob/a17a631dc326b3b394f4e9fb63d0a7af475534dc/tests/test_index.py#L585)
        # FIXME for non-Flat indice, reconstruction is lossy (may be good enough still)
        feature_vector = index.get_internal_feature(data['query_id'])
    feature_vector = np.atleast_2d(feature_vector)

    k = data.get('k', 100)
    img_ids, similarities = index.search(feature_vector, k=k)
    result_list = [{'imgId': img_id, 'score': round(float(score), 6)} for img_id, score in zip(img_ids, similarities)]
    logging.debug(result_list[:10])

    return jsonify(result_list)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Query a FAISS index.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='8080', help="Port to use for binding")
    parser.add_argument('--lazy-load', action='store_true', default=False, help="Whether to load indices lazily (at first request)")
    args = parser.parse_args()

    if not args.lazy_load:
        config = load_config('/data/config.yaml')

        enabled_features = config.get('analysis', []).get('features', [])
        features_types = config.get('index', []).get('features', [])
        features_types = [k for k, v in features_types.items() if v.get('index_engine', '') == 'faiss' and k in enabled_features]

        for features_type in features_types:
            logging.info(f'Loading: {features_type}')
            load_index(features_type)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)