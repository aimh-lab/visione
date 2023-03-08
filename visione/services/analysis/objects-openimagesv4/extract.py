import argparse
import logging
import sys

from PIL import Image
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub

from visione.extractor import BaseExtractor

loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.DEBUG,
    stream=sys.stdout,
    format='%(asctime)s %(levelname)-8s:%(name)s:%(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True,
)
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
    except Exception as e:
        log.warning(f'Error applying detector: {e}')
        return None

    return y


class ObjectOIV4Extractor(BaseExtractor):
    """ Extracts objects from images using Open Images V4 Faster R-CNN detector. """

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--detector-url', default='https://tfhub.dev/google/faster_rcnn/openimages_v4/inception_resnet_v2/1', help='URL of the detector to use')
        super(ObjectOIV4Extractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(ObjectOIV4Extractor, self).__init__(args)
        if not args.gpu:
            tf.config.set_visible_devices([], 'GPU')

        self.detector = None

    def setup(self):
        if self.detector is None:
            log.info(f'Loading detector: {self.args.detector_url}')
            self.detector = hub.KerasLayer(self.args.detector_url, signature='default', signature_outputs_as_dict=True)
            log.info(f'Loaded detector.')

    def extract_one(self, image_path):
        self.setup()  # lazy load model
        image = load_image_pil(image_path)
        det = apply_detector(self.detector, image)
        det = {
            'object_class_labels': det['detection_class_labels'],
            'object_class_names': det['detection_class_entities'],  # fixes a swap in tensorflow model output
            'object_class_entities': det['detection_class_names'],  # fixes a swap in tensorflow model output
            'object_scores': det['detection_scores'],
            'object_boxes_yxyx': det['detection_boxes'],
            'detector': 'frcnn_incep_resnetv2_openimagesv4',
        } if det else None
        return det

    def extract(self, image_paths):
        records = map(self.extract_one, image_paths)
        records = list(records)
        return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect Objects with TensorFlow Hub models.')
    ObjectOIV4Extractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = ObjectOIV4Extractor(args)
    extractor.run()