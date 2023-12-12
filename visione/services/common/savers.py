import abc
import gzip
import json
import logging
from pathlib import Path
import sys
import zlib

import h5py


logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
log = logging.getLogger(__name__)


class Saver(abc.ABC):

    @abc.abstractmethod
    def add(self, record):
        pass

    def add_many(self, records, *args, **kwargs):
        for record in records:
            self.add(record, *args, **kwargs)


class GzipJsonlFile(Saver):
    """ Save / Load / Append results in a GZipped JSONL file. """
    def __init__(self, path, flush_every=100):
        self.path = Path(path)
        self._ids = set()
        self._flush_every = flush_every
        self._to_be_flushed = 0

        if self.path.exists():
            try:
                with gzip.open(str(self.path), 'r') as f:
                    self._ids = {json.loads(line)['_id'] for line in f.read().splitlines()}
                log.info(f'Found {len(self._ids)} results')
            except (EOFError, zlib.error) as e:
                log.warning(f'{self.path} seems corrupt, removing and reprocessing.')
                self.path.unlink()

    def __enter__(self):
        self.file = gzip.open(str(self.path), 'at')
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()

    def __contains__(self, _id):
        return _id in self._ids

    def add(self, record, force=False):
        _id = record['_id']

        assert not (force and _id in self), f"Cannot force add existing record '{_id}' in jsonl.gz file."

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
    def __init__(self, path, read_only=False, flush_every=100, attrs={}):
        self.path = Path(path)
        self.read_only = read_only
        self.flush_every = flush_every
        self.attrs = attrs

        self.file = None
        self._ids = dict()
        self._to_be_flushed = 0

        self._ids_dataset = None
        self._data_dataset = None

    def __enter__(self):
        if self.read_only and not self.path.exists():
            return self

        mode = 'r' if self.read_only else 'a'
        self.file = h5py.File(str(self.path), mode)

        if 'ids' in self.file:
            self._ids_dataset = self.file['ids']
            self._data_dataset = self.file['data']
            self._ids = {_id: i for i, _id in enumerate(self._ids_dataset.asstr())}

        if not self.read_only:
            for k, v in self.attrs.items():
                self.file.attrs[k] = v

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file:
            self.file.close()

    def __contains__(self, _id):
        return _id in self._ids

    def add(self, record, force=False):
        assert not self.read_only, "Cannot add record to read-only HDF5 file."

        feature_vector = record['feature_vector']
        dim = len(feature_vector)

        if self._ids_dataset is None:
            self._ids_dataset = self.file.create_dataset('ids', (0,), maxshape=(None,), dtype=h5py.special_dtype(vlen=str))
            self._data_dataset = self.file.create_dataset('data', (0, dim), maxshape=(None, dim), dtype='float32')

        _id = record['_id']
        if _id in self:
            if not force:
                return
            index = self._ids[_id]
        else:
            index = len(self._ids)
            self._ids_dataset.resize((index + 1,))
            self._data_dataset.resize((index + 1, dim))
            self._ids[_id] = index

        self._ids_dataset[index] = _id
        self._data_dataset[index, :] = feature_vector

        self._to_be_flushed += 1
        if self._to_be_flushed == self.flush_every:
            self.flush()
            self._to_be_flushed = 0

    def flush(self):
        self.file.flush()