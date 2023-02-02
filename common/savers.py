import abc
import gzip
import json
import logging
from pathlib import Path
import sys

from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
log = logging.getLogger(__name__)


class Saver(abc.ABC):

    @abc.abstractmethod
    def add(self, record):
        pass
    
    def add_many(self, records):
        for record in records:
            self.add(record)



class GzipJsonpFile(Saver):
    """ Save / Load / Append results in a GZipped JSONP file. """
    def __init__(self, path, flush_every=100):
        self.path = Path(path)
        self._ids = set()
        self._flush_every = flush_every
        self._to_be_flushed = 0

        if self.path.exists():
            with gzip.open(str(self.path), 'r') as f:
                self._ids = {json.loads(line)['_id'] for line in f.read().splitlines()}
            log.info(f'Found {len(self._ids)} results')
    
    def __enter__(self):
        self.file = gzip.open(str(self.path), 'at')
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()

    def __contains__(self, _id):
        return _id in self._ids

    def add(self, record):
        _id = record['_id']
        if _id not in self:
            self._ids.add(_id)
            self.file.write(json.dumps(record) + '\n')

            self._to_be_flushed += 1
            if self._to_be_flushed == self._flush_every:
                self.flush()
                self._to_be_flushed = 0
    
    def flush(self):
        self.file.flush()


class MongoCollection(Saver):
    def __init__(
        self,
        db_name, 
        collection_name,
        host='mongo',
        port=27017,
        username=None,
        password=None,
        batch_size=100,
    ):
        self.db_name = db_name
        self.collection_name = collection_name
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.batch_size = batch_size

        self.client = None
        self.collection = None

        self._batch = []

    def __enter__(self):
        self.client = MongoClient(self.host, port=self.port, username=self.username, password=self.password)
        self.collection = self.client[self.db_name][self.collection_name]
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.flush()
        self.collection = None
        self.client.close()
        self.client = None
    
    def __contains__(self, _id):
        assert self.collection is not None, "cannot use MongoCollection outside a 'with' statement"
        return self.collection.find_one({'_id': _id}, {'_id': True}) is not None

    def add(self, record):
        self._batch.append(record)
        if len(self._batch) == self.batch_size:
            self.flush()
    
    def flush(self):
        if self._batch:
            try:
                ops = [UpdateOne({'_id': doc['_id']}, {'$set': doc}, upsert=True) for doc in self._batch]
                self.collection.bulk_write(ops, ordered=False)
                self._batch.clear()
            except BulkWriteError as bwe:
                print(bwe.details)
