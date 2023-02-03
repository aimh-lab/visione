import argparse
from functools import partial
import logging
import itertools
import more_itertools
from pathlib import Path
import sys

from PIL import Image
from prefetch_generator import BackgroundGenerator
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
from tqdm import tqdm

from visione.savers import MongoCollection, GzipJsonlFile


tqdm = partial(tqdm, dynamic_ncols=True)
loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
log = logging.getLogger(__name__)


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


def main(args):
    image_list = sorted(args.image_dir.glob('*.png'))
    n_images = len(image_list)
    initial = 0

    if args.output_type == 'mongo':
        saver = MongoCollection(
            args.db,
            args.collection,
            host=args.host,
            port=args.port,
            username=args.username,
            password=args.password,
            batch_size=args.save_every,
        )
    elif args.output_type == 'file':
        saver = GzipJsonlFile(args.output, flush_every=args.save_every)

    detector_url = 'https://tfhub.dev/google/faster_rcnn/openimages_v4/inception_resnet_v2/1'
    log.info(f'Loading detector: {detector_url}')
    detector = hub.KerasLayer(detector_url, signature='default', signature_outputs_as_dict=True)
    
    with saver:
        # read image ids and paths
        image_list = map(lambda x: f'{x.stem}\t{x}', image_list)
        ids_and_paths = map(lambda x: x.rstrip().split('\t'), image_list)

        # process missing only (resume)
        if not args.force:
            ids_and_paths = filter(lambda x: x[0] not in saver, ids_and_paths)
            ids_and_paths = list(ids_and_paths)
            initial = n_images - len(ids_and_paths)

        # prepare image paths
        unzipped_ids_and_paths = more_itertools.unzip(ids_and_paths)
        head, unzipped_ids_and_paths = more_itertools.spy(unzipped_ids_and_paths)
        image_ids, image_paths = unzipped_ids_and_paths if head else ((),())

        # load images
        images = map(load_image_pil, image_paths)
        # images = BackgroundGenerator(images, max_prefetch=10)

        # apply detector
        dets = map(lambda x: apply_detector(detector, x), images)
        ids_and_dets = zip(image_ids, dets)

        # post-process to records
        records = itertools.starmap(lambda frame_id, det: {
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
                'detector': 'frcnn_incep_resnetv2_openimagesv4',
            } if det else None, ids_and_dets)
        
        records = filter(lambda x: x is not None, records)
        records = tqdm(records, initial=initial, total=n_images)
        saver.add_many(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect Objects with TensorFlow Hub models.')

    parser.add_argument('image_dir', type=Path, help='directory containing images to be processed')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    subparsers = parser.add_subparsers(dest="output_type")

    mongo_parser = subparsers.add_parser('mongo')
    mongo_parser.add_argument('--host', default='mongo')
    mongo_parser.add_argument('--port', type=int, default=27017)
    mongo_parser.add_argument('--username', default='admin')
    mongo_parser.add_argument('--password', default='visione')
    mongo_parser.add_argument('db')
    mongo_parser.add_argument('--collection', default='objects.frcnn_incep_resnetv2_openimagesv4')

    file_parser = subparsers.add_parser('file')
    file_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (gzipped JSONP file)')

    args = parser.parse_args()
    main(args)