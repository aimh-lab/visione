import argparse
import itertools
import multiprocessing
import os
from pathlib import Path

import mmcv
from mmdet.apis import init_detector, inference_detector
import numpy as np
import torch

from visione.extractor import BaseExtractor


def buffered_imap(func, iterable, buffer_size):
    # Create a multiprocessing.Queue to act as a buffer
    queue = multiprocessing.Queue(maxsize=buffer_size)

    def worker(queue):
        for item in iterable:
            result = func(item)
            queue.put(result)

        # Put the sentinel value to signal the end of processing
        queue.put(None)

    # Start the worker process
    worker_process = multiprocessing.Process(target=worker, args=(queue,))
    worker_process.start()

    while True:
        result = queue.get()
        if result is None:
            break
        yield result

    worker_process.join()


def detection2record(detection, detector, classes, image_hw):
    if detector == 'mrcnn-lvis':
        boxes_and_scores = detection[0]
    elif detector.startswith('vfnet'):
        boxes_and_scores = detection

    n_instances_per_class = map(len, boxes_and_scores)
    labels = [[c]*n for c, n in zip(classes, n_instances_per_class)]
    labels = list(itertools.chain.from_iterable(labels))

    boxes_and_scores = np.concatenate(boxes_and_scores, axis=0)
    # normalize coordinates and clip them in [0,1]
    boxes = boxes_and_scores[:, :4] / np.tile(image_hw, 2)
    boxes = np.clip(boxes, 0, 1)
    scores = boxes_and_scores[:, 4]

    return {
        'object_scores': scores.tolist(),
        'object_boxes_yxyx': boxes.tolist(),
        'object_class_names': labels,
        'detector': detector,
    }


class ObjectsMMDetExtractor(BaseExtractor):
    """ Extractor for objects with mmdetection. """

    CONFIG_DIR = Path('/usr/src/mmdetection/configs')
    CKPT_DIR = Path('/usr/src/mmdetection/checkpoints')

    DETECTORS = {
        'vfnet32-coco': {
            'config': CONFIG_DIR / 'vfnet' / 'vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py',
            'checkpoint': CKPT_DIR / 'vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-d300a6fc.pth',
        },
        'vfnet64-coco': {
            'config': CONFIG_DIR / 'vfnet' / 'vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py',
            'checkpoint': CKPT_DIR / 'vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-b5f6da5e.pth',
        },
        'mrcnn-lvis': {
            'config': CONFIG_DIR / 'lvis' / 'mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1.py',
            'checkpoint': CKPT_DIR / 'mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1-43d9edfe.pth',
        },
    }

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--detector', default=os.environ['DETECTOR_NAME'], choices=cls.DETECTORS.keys(), help='detector to be used')
        super(ObjectsMMDetExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(ObjectsMMDetExtractor, self).__init__(args)
        self.detector = args.detector
        self.model = None

    def setup(self):
        if self.model is not None:
            return

        # lazy load models
        config_file = str(self.DETECTORS[self.detector]['config'])
        checkpoint_file = str(self.DETECTORS[self.detector]['checkpoint'])
        device = 'cuda' if args.gpu and torch.cuda.is_available() else 'cpu'
        self.model = init_detector(config_file, checkpoint_file, device=device)

    def extract_one(self, image_path):
        self.setup()

        with torch.no_grad():
            image = mmcv.imread(image_path)
            image_hw = image.shape[:2]
            detection = inference_detector(self.model, image)
            record = detection2record(detection, self.detector, self.model.CLASSES, image_hw)
            return record

    def extract(self, image_paths):
        records = map(self.extract_one, image_paths)
        records = list(records)
        return records

    def extract_iterable(self, image_paths, batch_size=2):
        self.setup()

        with torch.no_grad():
            for image in buffered_imap(mmcv.imread, image_paths, buffer_size=2):
                image_hw = image.shape[:2]
                detection = inference_detector(self.model, image)
                record = detection2record(detection, self.detector, self.model.CLASSES, image_hw)
                yield record


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect objects with mmdetection.')
    ObjectsMMDetExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = ObjectsMMDetExtractor(args)
    extractor.run()