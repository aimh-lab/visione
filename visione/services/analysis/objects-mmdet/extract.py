import argparse
import itertools
from pathlib import Path

import mmcv
from mmdet.apis import init_detector, inference_detector
import more_itertools
import numpy as np
import torch
# from tqdm import tqdm

from visione import cli_progress
from visione.savers import GzipJsonlFile

# progress = tqdm
progress = cli_progress

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


def detect_from_image_lists(image_paths, detector, gpu):
    config_file = str(DETECTORS[detector]['config'])
    checkpoint_file = str(DETECTORS[detector]['checkpoint'])

    gpu = gpu and torch.cuda.is_available()
    device = 'cuda:0' if gpu else 'cpu'

    model = init_detector(config_file, checkpoint_file, device=device)

    for image_path in image_paths:
        image = mmcv.imread(image_path)
        image_hw = image.shape[:2]
        detection = inference_detector(model, image)
        record = detection2record(detection, detector, model.CLASSES, image_hw)
        yield record


def main(args):
    image_list = sorted(args.image_dir.glob('*.png'))
    n_images = len(image_list)

    if args.output_type == 'file':
        saver = GzipJsonlFile(args.output, flush_every=args.save_every)

    with saver:
        image_list = map(lambda x: f'{x.stem}\t{x}', image_list)
        image_list = progress(image_list, total=n_images)

        ids_and_paths = map(lambda x: x.rstrip().split('\t'), image_list)
        if not args.force:
            ids_and_paths = filter(lambda x: x[0] not in saver, ids_and_paths)

        unzipped_ids_and_paths = more_itertools.unzip(ids_and_paths)
        head, unzipped_ids_and_paths = more_itertools.spy(unzipped_ids_and_paths)
        image_ids, image_paths = unzipped_ids_and_paths if head else ((),())

        # XXX code to chunk if batched inference will be implemented in mmdet
        # chunked_image_paths = more_itertools.batched(image_paths, args.save_every)
        # chunked_records = detect_from_image_lists(chunked_image_paths, detector=args.detector, gpu=args.gpu)
        # records = itertools.chain.from_iterable(chunked_records)

        records = detect_from_image_lists(image_paths, detector=args.detector, gpu=args.gpu)

        records = ({'_id': _id, **record} for _id, record in zip(image_ids, records))
        saver.add_many(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect objects with mmdetection.')

    parser.add_argument('image_dir', type=Path, help='directory containing images to be processed')
    parser.add_argument('detector', choices=DETECTORS.keys(), help='detector to be used')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    parser.add_argument('--gpu', default=False, action='store_true', help='use a GPU')
    subparsers = parser.add_subparsers(dest="output_type")

    file_parser = subparsers.add_parser('file')
    file_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (gzipped JSONP file)')

    args = parser.parse_args()
    main(args)