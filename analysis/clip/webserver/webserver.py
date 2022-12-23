import argparse
from pathlib import Path
from flask import Flask, request, jsonify
import faiss
import more_itertools
import functools
from pymongo import MongoClient
import numpy as np
from utils import CLIPTextEncoder, FaissWrapper
import logging
import tqdm
import h5py

# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)

@app.route('/get-text-feature', methods=['GET'])
def get_text_features():
    text = request.args.get("text")
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text)
    out = jsonify(text_feature.tolist())
    return out

@app.route('/text-to-image-search', methods=['GET'])
def text_to_image_search():
    text = request.args.get("text")
    k = request.args.get("k", type=int, default=10000)
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text)
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
    feat = np.asarray(item['feature'])

    img_ids, similarities = index.search(feat, k=k)
    result_list = [{'imgId': img_id, 'score': round(float(score), 6)} for img_id, score in
                   zip(img_ids, similarities)]
    logging.debug(result_list[:10])
    out = jsonify(result_list)
    return out

def build_faiss_index(args, features_collection):
    index_path = Path('build')
    index_path.mkdir(parents=True, exist_ok=True)

    feats_file = index_path / f'clippone_features_{args.db}.h5'

    must_be_trained = args.index_type != 'Flat'

    # prepare the index and add items to it in batches
    dim = 1024
    metric = faiss.METRIC_INNER_PRODUCT
    index = faiss.index_factory(dim, args.index_type, metric)

    if args.disable_cache or not feats_file.is_file():
        logging.info('Creating index...')

        # prepare reading features from MongoDB
        feature_docs = features_collection.find({}, projection=['feature'])
        length = features_collection.count_documents({})

        # get ids and features
        ids_and_features = map(lambda x: (x['_id'], x['feature']), feature_docs)

        # create batches
        batches_of_ids_and_features = more_itertools.batched(ids_and_features, args.batch_size)

        # write features on h5 files on disk and add items to the index
        with h5py.File(feats_file, 'w') as f:
            ofeatures = f.create_dataset("features", (length, dim), dtype=np.float32)
            dt = h5py.string_dtype(encoding='utf-8')
            oids = f.create_dataset('image_names', (length, ), dtype=dt)

            batches_of_ids_and_features = zip(range(0, length + args.batch_size, args.batch_size), batches_of_ids_and_features)

            # TODO: is there the possibility to do the same thing but with generators?
            for i, idfe in tqdm.tqdm(batches_of_ids_and_features, total=length // args.batch_size + 1):
                ids, feats = zip(*idfe)

                ids = [id.encode("utf-8") for id in ids]
                ids = np.array(ids, dtype=dt)
                oids[i:i+args.batch_size] = ids

                feats = np.array(feats)
                feats = np.squeeze(feats, axis=1)
                ofeatures[i:i+args.batch_size, :] = feats
                if i == 0 and must_be_trained:
                    # train the index
                    logging.info('Training the index...')
                    index.train(feats)
                index.add(feats)
            ids = [s.decode() for s in oids[:]]
    else:
        # load the features
        with h5py.File(feats_file, 'r') as image_data:
            ids = image_data['image_names'][:]
            ids = [s.decode() for s in ids]
            features = image_data['features']
            batches_of_ids_and_features = more_itertools.batched(features, args.batch_size)
            to_numpy = functools.partial(np.array, dtype=np.float32)
            batches_of_ids_and_features = map(to_numpy, batches_of_ids_and_features)

            # add to faiss index
            for i, feats in tqdm.tqdm(enumerate(batches_of_ids_and_features), desc="Adding to Index"):
                if i == 0 and must_be_trained:
                    # train the index
                    logging.info('Training the index...')
                    index.train(feats)
                index.add(feats)

    index = FaissWrapper(index, ids)

    return index

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create a webservice for CLIP model for t2i and i2i searches.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5030', help="Port to use for binding")
    parser.add_argument('--model-handle', default='laion/CLIP-ViT-H-14-laion2B-s32B-b79K', help='hugging face handle of the CLIP model')

    parser.add_argument('--mongo-host', default='mongo')
    parser.add_argument('--mongo-port', type=int, default=27017)
    parser.add_argument('--mongo-username', default='admin')
    parser.add_argument('--mongo-password', default='visione')
    parser.add_argument('--db', default='mvk')
    parser.add_argument('--features-collection', default='features.clippone')
    parser.add_argument('--batch-size', type=int, default=50000)

    parser.add_argument('--index-type', type=str, default='Flat', help='Which type of index we use')
    parser.add_argument('--disable-cache', action='store_true', help='Disable index caching. Every time it is rebuilt from scratch')

    args = parser.parse_args()

    # connect to mongo and open the collection
    client = MongoClient(args.mongo_host, port=args.mongo_port, username=args.mongo_username, password=args.mongo_password)
    features_collection = client[args.db][args.features_collection]

    # build the index
    index = build_faiss_index(args, features_collection)

    # init the query encoder
    qe = CLIPTextEncoder(args.model_handle)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)