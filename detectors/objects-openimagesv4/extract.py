import argparse
import csv
from functools import partial
import logging
import gzip
import itertools
import json
from pathlib import Path

from prefetch_generator import BackgroundGenerator
import numpy as np
from PIL import Image
import tensorflow as tf
import tensorflow_hub as hub

from tqdm import tqdm
from tqdm.contrib.logging import logging_redirect_tqdm

tqdm = partial(tqdm, dynamic_ncols=True)
log = logging.getLogger(__name__)


class ResultFile(object):
    """ Save / Load / Append results in a GZipped JSONP file. """
    def __init__(self, path):
        self.path = path
        if self.path.exists():
            with gzip.open(str(self.path), 'r') as f:
                self._ids = {json.loads(line)['id'] for line in f.read().splitlines()}
            log.info(f'Found {len(self._ids)} results')
        else:
            self._ids = set()
            
    def append(self, _id, data):
        if _id not in self._ids:
            data['id'] = _id
            line = json.dumps(data) + '\n'
            self.file.write(line)
            self._ids.add(_id)
    
    def flush(self):
        self.file.flush()
    
    def __contains__(self, _id):
        return _id in self._ids
    
    def __enter__(self):
        self.file = gzip.open(str(self.path), 'at')
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()


def load_image_pil(image_path):
    try:
        with Image.open(image_path) as image_pil:
            image_np = np.array(image_pil.convert('RGB'))               # convert PIL image to numpy

        image_np = np.expand_dims(image_np, axis=0)  # add batch dimension
        image_np = image_np.astype(np.float32)       # convert from uint8 to float32
        image_np = image_np / 255.                   # scale from [0, 255] -> [0, 1]
    except KeyboardInterrupt as e:
        raise e
    except:
        log.warn(f'{image_path}: Error loading image')
        return None

    return image_np


def apply_detector(detector, x):
    if x is None:
        return None

    try:
        h, w = x.shape[1:3]
        x = tf.convert_to_tensor(x)    # from numpy to tf.Tensor
        y = detector(x)
        y = {k: v.numpy().tolist() for k, v in y.items()}
        for i in ('detection_class_names', 'detection_class_entities'):
            y[i] = [l.decode('utf8') for l in y[i]]
        y['image_height'] = h
        y['image_width'] = w
    except KeyboardInterrupt as e:
        raise e
    except:
        log.warning(f'Error applying detector')
        return None

    return y


def grouper(iterable, n):
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


def process_to_file(args):
    if args.output is None:
        args.output = Path('.') / args.image_list.with_suffix('.jsonp.gz').name

    log.info('Opening Image List:', args.image_list)

    with open(args.image_list, 'r') as list_file, ResultFile(output) as results:
        # open image list
        image_list = csv.reader(list_file, delimiter="\t")

        # process missing only (resume)
        image_list = filter(lambda x: x[0] not in results, image_list)

        # load images
        images = itertools.starmap(lambda frame_id, path: (frame_id, load_image_pil(path)), image_list)
        images = BackgroundGenerator(images, max_prefetch=10)

        # apply detector
        data = itertools.starmap(lambda frame_id, x: (frame_id, _apply_detector(x)), images)

        # add data to gzipped file
        for i, (frame_id, y) in enumerate(tqdm(data)):
            if y is not None:
                results.append(frame_id, y)

            if i % 100 == 0:
                results.flush()

def process_to_mongo(args):
    log.info('Opening Image List:', args.image_list)
    with open(args.image_list, 'r') as list_file:
        # open image list
        image_list = csv.reader(list_file, delimiter="\t")

        # connect to mongo
        client = MongoClient(args.host, username=args.user, password=args.pass)
        collection = client[args.db][args.collection]

        # process missing only (resume)
        image_list = filter(lambda x: collection.find_one({'_id': x[0]}) is None, image_list)

        # load images
        images = itertools.starmap(lambda frame_id, path: (frame_id, load_image_pil(path)), image_list)
        images = BackgroundGenerator(images, max_prefetch=10)

        # apply detector
        dets = itertools.starmap(lambda frame_id, x: (frame_id, _apply_detector(x)), images)

        # post-process to records
        records = itertools.starmap(lambda frame_id, det: (frame_id, {
                # useful ids
                '_id': frame_id,  # automatically indexed by Mongo
                # 'video_id': video_id,
                # frame size
                'width': det['image_width'],
                'height': det['image_height'],
                # detection fields
                'object_class_labels': det['detection_class_labels'],
                'object_class_names': det['detection_class_entities'],  # fixes a swap in tensorflow model output 
                'object_class_entities': det['detection_class_names'],  # fixes a swap in tensorflow model output
                'object_scores': det['detection_scores'],
                'object_boxes_yxyx': det['detection_boxes'],
            } if det else None), dets)
        
        # insert in mongo (in batches)
        batches_of_records = grouper(records, args.batch_size)
        for batch in tqdm(batches_of_records, unit_scale=batch_size):
            try:
                collection.insert_many(batch, ordered=False)
            except BulkWriteError:
                print('Duplicate entries discarded.')


def main(args):
    log.info('Loading detector ...')
    detector = hub.KerasLayer('https://tfhub.dev/google/faster_rcnn/openimages_v4/inception_resnet_v2/1', signature='default', signature_outputs_as_dict=True)
    
    if args.output_type == 'file':
        process_fn = process_to_file
    if args.output_type == 'mongo':
        process_fn = process_to_mongo

    try:
        process_fn(args)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect Objects with TensorFlow Hub models.')

    parser.add_argument('image_list', type=Path, help='path to TSV file containing image IDS and paths (one per line)')
    subparsers = parser.add_subparsers(dest="output-type")

    mongo_parser = subparsers.add_parser('mongo')
    mongo_parser.add_argument('--host', default='mongo')
    mongo_parser.add_argument('--port', type=int, default=27017)
    mongo_parser.add_argument('--user', default='admin')
    mongo_parser.add_argument('--pass', default='visione')
    mongo_parser.add_argument('db')
    mongo_parser.add_argument('--collection', default='objects.frcnn_incep_resnetv2_openimagesv4')
    mongo_parser.add_argument('--batch-size', type=int, default=1000)


    file_parser = subparsers.add_parser('file')
    file_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (gzipped JSONP file)')

    args = parser.parse_args()
    main(args)