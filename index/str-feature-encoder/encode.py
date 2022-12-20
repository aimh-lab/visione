import argparse
import functools
import itertools
from pathlib import Path
from pprint import pprint

import more_itertools
import numpy as np
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError
import surrogate
from tqdm import tqdm


def collect_features(collection, limit=None):
    n_documents = collection.database.command('collstats', collection.name)['count']

    total = n_documents
    cursor = collection.find({}, projection=['feature'])

    if limit:
        samples_idx = np.random.choice(n_documents, limit, replace=False)
        samples_idx = np.sort(samples_idx).tolist()

        def gen_samples(cursor, samples_idx):
            for i, doc in enumerate(cursor):
                if i == samples_idx[0]:
                    yield doc
                    samples_idx.pop(0)
                    if len(samples_idx) == 0:
                        break

        cursor = gen_samples(cursor, samples_idx)
        total = limit

    ids, features = [], []
    for doc in tqdm(cursor, desc='Collecting Features', total=total):
        ids.append( doc['_id'] )
        features.append( np.array(doc['feature'], dtype=np.float32) )
    
    features = np.stack(features)
    return ids, features


def load_or_train_encoder(collection):
    db_name = collection.database.name
    collection_name = collection.name

    # instantiate STR encoder
    encoder_filename = Path(f'str-encoder-{db_name}.{collection_name}.pkl')

    if not encoder_filename.exists():
        # init the encoder
        d = len(collection.find_one({}, projection=['feature'])['feature'])
        encoder = surrogate.TopKSQ(
            d,  # input dimensionality
            keep=260,  # dimensions to keep
            rotation_matrix=42,  # seed for random rot
        )

        needs_train = False
        if needs_train:
            # get subsample if necessary for training
            n_documents = collection.database.command('collstats', collection_name)['count']  # get document count
            n_train_document = min(n_documents, 100_000)  # FIXME: better heuristic?
            _, x = collect_features(collection, limit=n_train_document)
            n, d = x.shape
        
            # train the encoder
            print('Training the encoder ...')
            encoder.train(x)
            del x

        # save trained encoder
        print('Saving trained encoder:', encoder_filename)
        surrogate.save_index(encoder, encoder_filename)
    else:
        print('Loading trained encoder:', encoder_filename)
        encoder = surrogate.load_index(encoder_filename)
    
    return encoder


def main(args):
    client = MongoClient(args.host, port=args.port, username=args.username, password=args.password)
    features_collection = client[args.db][args.features_collection]
    output_collection = client[args.db]['frames']
    output_field = args.output_field or f"{args.features_collection.replace('.','_')}_str"

    encoder = load_or_train_encoder(features_collection)

    feature_docs = features_collection.find({}, projection=['feature'])

    # filter only non-processed
    if not args.force:
        def needs_processing(x):
            return output_collection.find_one({'_id': x['_id'], output_field: { '$exists': False }}, {'_id': True}) is None

        feature_docs = filter(needs_processing, feature_docs)
    
    feature_docs = tqdm(feature_docs)

    # separate ids and features
    ids_and_features = map(lambda x: (x['_id'], x['feature']), feature_docs)
    ids, features = more_itertools.unzip(ids_and_features)

    # create batches of features as numpy arrays
    batches_of_features = more_itertools.batched(features, args.batch_size)
    to_numpy = functools.partial(np.array, dtype=np.float32)
    batches_of_features = map(to_numpy, batches_of_features)

    # encode and generate surrogate documents in batches
    str_encode = functools.partial(encoder.encode, inverted=False)
    batches_of_encoded_features = map(str_encode, batches_of_features)
    batches_of_str_encodings = map(surrogate.generate_documents, batches_of_encoded_features)
    str_encodings = itertools.chain.from_iterable(batches_of_str_encodings)

    # generate write ops
    write_ops = (
        UpdateOne({'_id': doc_id}, {'$set': {output_field: surrogate_text}})
        for doc_id, surrogate_text in zip(ids, str_encodings)
    )

    # progress bar
    n_documents = features_collection.database.command('collstats', features_collection.name)['count']
    write_ops = tqdm(write_ops, desc='Updating STRs', total=n_documents)

    batches_of_ops = more_itertools.batched(write_ops, args.batch_size)
    batches_of_ops = map(list, batches_of_ops)
    
    for batch_of_ops in batches_of_ops:
        try:
            output_collection.bulk_write(batch_of_ops, ordered=False)
        except BulkWriteError as bwe:
            print('Something wrong in updating docs:')
            pprint(bwe.details)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Surrogate Text Encoding of Feature Vectors')

    parser.add_argument('--host', default='mongo')
    parser.add_argument('--port', type=int, default=27017)
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', default='visione')
    parser.add_argument('db')
    parser.add_argument('features_collection')
    parser.add_argument('--output-field', default=None)
    parser.add_argument('--batch-size', type=int, default=5000)
    parser.add_argument('--force', default=False, action='store_true')

    args = parser.parse_args()
    main(args)