import argparse
import itertools
from pathlib import Path

import mmcv
from mmdet.apis import init_detector, inference_detector
import numpy as np
import torch

from visione.extractor import BaseExtractor


def detection2record(detection, detector, classes, image_hw):
    if detector == 'mask_rcnn_lvis':
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
        'vfnet_X-101-32x4d': {
            'config': CONFIG_DIR / 'vfnet' / 'vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py',
            'checkpoint': CKPT_DIR / 'vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-d300a6fc.pth',
        },
        'vfnet_X-101-64x4d': {
            'config': CONFIG_DIR / 'vfnet' / 'vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco.py',
            'checkpoint': CKPT_DIR / 'vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco_20201027pth-b5f6da5e.pth',
        },
        'mask_rcnn_lvis': {
            'config': CONFIG_DIR / 'lvis' / 'mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1.py',
            'checkpoint': CKPT_DIR / 'mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1-43d9edfe.pth',
        },
    }

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('detector', choices=DETECTORS.keys(), help='detector to be used')
        super(ObjectsMMDetExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(ObjectsMMDetExtractor, self).__init__(args)
        self.detector = args.detector
        self.model = None

    def setup(self):
        if self.model is not None:
            return

        config_file = str(DETECTORS[self.detector]['config'])
        checkpoint_file = str(DETECTORS[self.detector]['checkpoint'])
        device = 'cuda' if args.gpu and torch.cuda.is_available() else 'cpu'
        self.model = init_detector(config_file, checkpoint_file, device=device)

    @torch.no_grad()
    def extract_one(self, image_path):
        image = mmcv.imread(image_path)
        image_hw = image.shape[:2]
        detection = inference_detector(self.model, image)
        record = detection2record(detection, self.detector, self.model.CLASSES, image_hw)
        return record

    def extract(self, image_paths):
        records = map(self.extract_one, image_paths)
        records = list(records)
        return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect objects with mmdetection.')
    ObjectsMMDetExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = ObjectsMMDetExtractor(args)
    extractor.run()