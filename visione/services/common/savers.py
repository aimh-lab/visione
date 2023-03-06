import abc
import gzip
import json
import logging
from pathlib import Path
import sys

import h5py


logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
log = logging.getLogger(__name__)


class Saver(abc.ABC):

    @abc.abstractmethod
    def add(self, record):
        pass

    def add_many(self, records):
        for record in records:
            self.add(record)



class GzipJsonlFile(Saver):
    """ Save / Load / Append results in a GZipped JSONL file. """
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


class HDF5File(Saver):
    """ Save / Load / Append results in a HDF5 file. """
    def __init__(self, path, shape=None, flush_every=100, attrs={}):
        self.path = Path(path)
        self.shape = shape
        self.flush_every = flush_every
        self.attrs = attrs

        self._ids = dict()
        self._to_be_flushed = 0

        self._ids_dataset = None
        self._data_dataset = None

        if self.path.exists():
            with h5py.File(str(self.path), 'r') as f:
                self._ids = {_id: i for i, _id in enumerate(f['ids'].asstr())}
            log.info(f'Found {len(self._ids)} results')

    def __enter__(self):
        self.file = h5py.File(str(self.path), 'a')
        self._ids_dataset = self.file.require_dataset('ids', shape=self.shape[:1], dtype=h5py.string_dtype(encoding='utf-8'))
        self._data_dataset = self.file.require_dataset('data', shape=self.shape, dtype='float32')
        for k, v in self.attrs.items():
            self._data_dataset.attrs[k] = v

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()

    def __contains__(self, _id):
        return _id in self._ids

    def add(self, record):
        _id = record['_id']
        if _id in self:
            return

        new_index = len(self._ids)
        self._ids[_id] = new_index
        self._ids_dataset[new_index] = _id
        self._data_dataset[new_index, :] = record['feature']

        self._to_be_flushed += 1
        if self._to_be_flushed == self.flush_every:
            self.flush()
            self._to_be_flushed = 0

    def flush(self):
        self.file.flush()