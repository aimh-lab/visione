from pathlib import Path
from pprint import pprint

from more_itertools import ichunked
import numpy as np
from prefetch_generator import background
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError
import surrogate
from tqdm import tqdm


def collect_features(collection, limit=None):
    n_documents = collection.database.command('collstats', collection.name)['count']

    total = n_documents
    cursor = collection.find({}, projection=['feature'])

    if limit:
        """
        cursor = collection.aggregate([
            {'$sample': {'size': limit}},  # sample random documents
            {'$project': {'feature': True}}  # keep only the '_id' and 'feature' fields
        ], allowDiskUse=True)
        """
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


def process_collection(db_name, collection_name, batch_size=10000, replace=True):
    client = MongoClient('bilioso.isti.cnr.it', username='vbs', password='v0ld£m0rt')
    collection = client[db_name][collection_name]

    # instantiate STR encoder
    enc_filename = Path(f'str-encoder-flat-{db_name}.{collection_name}.pkl')

    if not enc_filename.exists():
        """ IVFTopKSQ
        # get document count
        n_documents = collection.database.command('collstats', collection.name)['count']

        # estimate number of centroids
        n_partitions = round(2 * np.sqrt(n_documents))
        n_train_document = 256 * n_partitions

        # collect some features
        _, x = collect_features(collection, limit=n_train_document)
        n, d = x.shape

        enc = surrogate.IVFTopKSQ(
            d,  # input dimensionality
            n_coarse_centroids=n_partitions,  # n. of voronoi partitions
            k=0.90,  # percentage of components to keep
        )

        # train the encoder
        print('Training the encoder ...')
        enc.train(x)

        del x
        """

        """ TopKSQ """
        doc = collection.find_one({}, projection=['feature'])
        d = len(doc['feature'])

        enc = surrogate.TopKSQ(d, k=260)

        # save trained encoder
        print('Saving trained encoder:', enc_filename)
        surrogate.save_index(enc, enc_filename)
    else:
        print('Loading trained encoder:', enc_filename)
        enc = surrogate.load_index(enc_filename)

    """ INSERT INTO SAME COLLECTION
    # find docs to be updated
    query = {} if replace else {'surrogate_text': {'$exists': False}}
    cursor = collection.find(query, projection=['feature'])

    cursor = tqdm(cursor, desc='Updating STRs')
    # process in batches
    for batch in ichunked(cursor, batch_size):
        ids, features = [], []
        for doc in batch:
            ids.append( doc['_id'] )
            features.append( np.array(doc['feature'], dtype=np.float32) )
        
        x = np.stack(features)

        # encode the features
        x_enc = enc.encode(x, inverted=False)

        # generate surrogate documents (x_str is a generator of strings)
        x_str = surrogate.generate_documents(x_enc)

        # put surrogate texts back to mongo
        requests = [ UpdateOne({'_id': doc_id}, {'$set': {'surrogate_text': surrogate_text}})
                    for doc_id, surrogate_text in zip(ids, x_str) ]
        
        try:
            collection.bulk_write(requests, ordered=False)
        except BulkWriteError as bwe:
            pprint(bwe.details)
    """

    """ INSERT INTO NEW COLLECTION """
    out_collection_name = collection_name + '.str'
    out_collection = client[db_name][out_collection_name]
    out_collection_exists = out_collection_name in client[db_name].list_collection_names()
    if out_collection_exists:
        out_collection.drop()
    
    n_documents = collection.database.command('collstats', collection.name)['count']
    cursor = collection.find({}, projection=['feature'])

    """ SEQUENTIAL (SLOW)
    def generate_str_documents(cursor):
        for doc in cursor:
            x = np.array(doc['feature'], dtype=np.float32).reshape(1, -1)
            x_enc = enc.encode(x, inverted=False)
            x_str = next(iter(surrogate.generate_documents(x_enc)))
            yield {'_id': doc['_id'], 'surrogate_text': x_str}
    """

    """ BATCHED """
    # process in batches
    @background(5*batch_size)
    def generate_str_documents_batched(cursor, batch_size):
        for batch in ichunked(cursor, batch_size):
            ids, features = [], []
            for doc in batch:
                ids.append( doc['_id'] )
                features.append( np.array(doc['feature'], dtype=np.float32) )

            x = np.stack(features)
            
            # encode the features
            x_enc = enc.encode(x, inverted=False)

            # generate surrogate documents (x_str is a generator of strings)
            x_str = surrogate.generate_documents(x_enc)

            yield from ({'_id': doc_id, 'surrogate_text': surrogate_text} for doc_id, surrogate_text in zip(ids, x_str))

    str_documents = generate_str_documents_batched(cursor, batch_size)
    str_documents = tqdm(str_documents, desc='Updating STRs', total=n_documents)
    for batch in ichunked(str_documents, 3*batch_size):
        out_collection.insert_many(batch)


if __name__ == "__main__":
    # process_collection('v3c1', 'features.tern')
    # process_collection('v3c2', 'features.tern')
    process_collection('v3c', 'features.tern')