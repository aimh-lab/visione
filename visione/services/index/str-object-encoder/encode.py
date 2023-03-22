import argparse
import collections
import copy
from functools import reduce
import gzip
import itertools
import json
import math
import operator
from pathlib import Path
import subprocess

import pandas as pd

from visione import load_config, CliProgress
from visione.savers import GzipJsonlFile


def count_objects(record):
    return collections.Counter(o['label'] for o in record['objects'])


def load_hypersets(hyperset_file):
    hypersets = pd.read_csv(hyperset_file, sep=';', usecols=[0, 1], names=['set', 'hyperset'], index_col=0)
    hypersets = hypersets.squeeze("columns")  # only one column => pd.Series

    # drop empty hypersets, split hypersets by commas, strip
    hypersets = hypersets \
        .dropna() \
        .str.split(',') \
        .map(lambda x: list(map(str.strip, x)))

    return hypersets


def process_single_detector_record(record, config):
    detector = record['detector']

    labels = record['object_class_names']
    scores = record['object_scores']
    boxes  = record['object_boxes_yxyx']

    # parallel arrays to list of object records
    objects = ({'label': l, 'score': s, 'box_yxyx': b} for l, s, b in zip(labels, scores, boxes))

    # filter by score
    threshold = config.get('threshold', {}).get(detector, 0)
    objects = filter(lambda x: x['score'] >= threshold, objects)

    # filter by normalized area
    def _get_area(y0, x0, y1, x1):
        return (y1 - y0) * (x1 - x0)
    min_area = config.get('min_area', 0)
    objects = filter(lambda x: _get_area(*x['box_yxyx']) >= min_area, objects)

    # exclude labels (pre label mapping)
    exclude_labels = config.get('exclude_labels', {}).get(detector, [])
    objects = filter(lambda x: x['label'] not in exclude_labels, objects)

    # add detector and detector_label fields, uniform labels
    objects = map(lambda x: {
        **x,
        'detector': detector,
        'detector_label': x['label'],
        'label': x['label'].lower().replace(' ', '_'),  # overwrites original 'label' key
    }, objects)

    # applies label mapping
    mapping = config.get('label_map', {}).get(detector, {})
    objects = map(lambda x: {**x, 'label': mapping.get(x['label'], x['label'])}, objects)

    # exclude labels (post label mapping)
    exclude_labels = config.get('exclude_labels', {}).get('all', [])
    objects = filter(lambda x: x['label'] not in exclude_labels, objects)

    # materialize object list
    record['objects'] = list(objects)
    return record


def process_objects_file(jsonlgz_path, config):
    with gzip.open(jsonlgz_path, 'rt') as records:
        records = map(str.rstrip, records)
        records = map(json.loads, records)
        records = map(lambda x: process_single_detector_record(x, config), records)
        yield from records


def merge_records(records):
    assert len({r['_id'] for r in records}) == 1, "Records' ids do not match. Are the input records in the same order?"

    objects = [r.pop('objects', []) for r in records]
    merged_objects = list(reduce(operator.add, objects))

    merged_record = dict(collections.ChainMap(*records))
    merged_record['objects'] = merged_objects
    return merged_record


def add_hypersets(record, hypersets):

    # generate hyperset records for each object record
    def _generate_augmented_object_list(object_list):
        for record in object_list:
            yield record

            if record['detector'] == 'colors':
                continue

            label_hypersets = hypersets.get(record['label'], [])
            for hyperset in label_hypersets:
                hyper_record = copy.deepcopy(record)
                hyper_record['label'] = hyperset
                hyper_record['is_hyperset'] = True
                yield hyper_record

    # substitute 'objects' field of each document with the augmented object list
    objects = record['objects']
    augmented_objects = _generate_augmented_object_list(objects)
    record['objects'] = list(augmented_objects)
    return record

def _area(box):
    y0, x0, y1, x1 = box
    return max(0, y1 - y0) * max(0, x1 - x0)

def _iou(boxA, boxB):
    y0a, x0a, y1a, x1a = boxA
    y0b, x0b, y1b, x1b = boxB

    intY0 = max(y0a, y0b)
    intX0 = max(x0a, x0b)
    intY1 = min(y1a, y1b)
    intX1 = min(x1a, x1b)

    intArea = max(0, intY1 - intY0) * max(0, intX1 - intX0)
    unionArea = _area(boxA) + _area(boxB) - intArea
    return intArea / unionArea

def _nms(objects, iou_threshold):
    # sort by increasing scores
    objects = sorted(objects, key=lambda x: x['score'])
    n_objects = len(objects)

    kept = []
    for i in range(n_objects):
        boxA = objects[i]['box_yxyx']
        is_maximum = True
        for j in range(i+1, n_objects):
            boxB = objects[j]['box_yxyx']
            if _iou(boxA, boxB) > iou_threshold:
                is_maximum = False
                break

        if is_maximum:
            kept.append(objects[i])

    return kept


def non_maximum_suppression(record, iou_threshold=0.50):
    colors  = [o for o in record['objects'] if o['detector'] == 'colors']
    objects = [o for o in record['objects'] if o['detector'] != 'colors']

    key = lambda x: (x['detector'], x['label'])
    objects.sort(key=key)
    objects = itertools.chain.from_iterable(
        _nms(group, iou_threshold=iou_threshold)
        for _, group in itertools.groupby(objects, key=key)
    )
    objects = list(objects)
    record['objects'] = objects + colors

    return record


def _str_positional_box_encode(objects, nrows=7, ncols=7, rtol=0.1):

    def _encode_one(object_record):
        y0, x0, y1, x1 = object_record['box_yxyx']
        label = object_record['label']

        xtol = rtol / ncols
        ytol = rtol / nrows

        start_col = math.floor((max(0, x0) + xtol) * ncols)
        start_row = math.floor((max(0, y0) + ytol) * nrows)
        end_col   = math.floor((min(1, x1) - xtol) * ncols)
        end_row   = math.floor((min(1, y1) - ytol) * nrows)

        surrogate_text = []
        for row in range(start_row, end_row + 1):
            for col in range(start_col, end_col + 1):
                col = chr(ord('a') + col)
                surrogate_text.append(f'{row}{col}{label}')

        return surrogate_text

    # ignore hypersets in box encoding tokens
    objects = filter(lambda x: not x.get('is_hyperset', False), objects)
    tokens = map(_encode_one, objects)
    tokens = itertools.chain.from_iterable(tokens)
    tokens = list(tokens)
    tokens.sort()  # this helps when debugging

    surrogate = ' '.join(tokens)
    return surrogate


def _str_count_encode(objects, monochrome, thresholds):
    label_counts = collections.Counter()

    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']

        is_hyperset = object_record.get('is_hyperset', False)

        # count objects separately for each detector
        count_key = (label, detector)
        label_counts[count_key] += 1
        label_count = label_counts[count_key]

        frequency = ''
        if detector == 'colors':
            if label_count > 1:  # add colors only once and skip repetitions
                continue
            label_count = ''
        elif not is_hyperset:
            confidence = score - thresholds.get(detector, 0)
            frequency = int(10 * confidence / 2 + 2)  # heuristic to boost non-hyperset records
            frequency = f'|{frequency}'

        token = f'4wc{label}{label_count}{frequency}'
        tokens.append(token)

    # is monochrome
    monochrome_token = 'colorkeyframe' if monochrome > thresholds.get('monochrome', 0.01) else 'graykeyframe'
    monochrome_token = f'4wc{monochrome_token}'
    tokens.append(monochrome_token)

    tokens.sort()  # this helps when debugging
    surrogate = ' '.join(tokens)
    return surrogate


def build_object_info(objects):
    # do not report hyperset & colors objects
    objects = filter(lambda x: not x.get('is_hyperset', False), objects)
    objects = filter(lambda x: x['detector'] != 'colors', objects)

    detector_nicknames = {
        'mask_rcnn_lvis': 'MASK',
        'vfnet_X-101-64x4d': 'VFN64',
        'frcnn_incep_resnetv2_openimagesv4': 'FRCNN',
    }

    label_counts = collections.Counter()
    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']
        detector = detector_nicknames.get(detector, detector)

        count_key = (label, detector)
        label_counts[count_key] += 1
        label_count = label_counts[count_key]

        token = f'{label}{label_count}({detector}:{score:.2f})'
        tokens.append(token)

    tokens.sort()  # this helps when debugging
    text = ' '.join(tokens)
    return text


def str_encode(record, thresholds={}):
    objects = record.get('objects', [])
    monochrome = record.get('monochrome', 0)  # color frame by default

    return {
        '_id': record['_id'],
        'object_box_str': _str_positional_box_encode(objects),
        'object_count_str': _str_count_encode(objects, monochrome, thresholds),
    }


def process_merged_record(record, config, hypersets):
    objects = record.get('objects', [])

    # build debugging info for objects
    object_info = build_object_info(objects)

    # add hypersets
    record = add_hypersets(record, hypersets)

    # perform non-maximum suppression on boxes
    record = non_maximum_suppression(record)

    # build debugging info for objects (again after nms)
    objects_after_nms = record.get('objects', [])
    object_info_after_nms = build_object_info(objects_after_nms)

    # compute object count stats for tuning/inspection
    object_counts = count_objects(record)

    # build STR encoding
    thresholds = config.get('threshold', {})
    record = str_encode(record, thresholds=thresholds)

    record['object_info_before_nms'] = object_info
    record['object_info'] = object_info_after_nms

    return object_counts, record


def process_video_id(
    objects_input_files,
    str_output_file,
    count_output_file,
    config,
    hypersets,
    force,
    save_every,
    progress,
    video_id=None,
):

    # TODO ugly hack.. should be done in a better way
    n_frames = int(subprocess.check_output([f'zcat "{str_output_file}" | wc -l'] , shell=True))
    progress.total += n_frames + (progress.total < 0)
    progress.print()

    if not force and str_output_file.exists() and count_output_file.exists():
        print(f'Skipping STR object encoding, using existing file:', str_output_file.name, count_output_file.name)
        progress.initial += n_frames
        progress.print()
        return
    
    assert all(i.exists() for i in objects_input_files), f"Analysis files missing for '{video_id}'. Have you run 'analyze' on it?"

    # apply per-detector processing (score/area/label filtering, label mapping)
    records_per_detector = map(lambda x: process_objects_file(x, config), objects_input_files)

    # merge records of different detectors for the same frames
    merged_records = map(merge_records, zip(*records_per_detector))

    # apply general processing (hypersets, nms, counting, str-encoding)
    counts_and_records = map(lambda x: process_merged_record(x, config, hypersets), merged_records)

    # if forced, delete old file
    if force and str_output_file.exists():
        str_output_file.unlink()

    n_frames = None  # TODO
    object_counter = collections.Counter()
    with GzipJsonlFile(str_output_file, flush_every=save_every) as saver:
        for count, record in progress(counts_and_records):
            saver.add(record)
            object_counter += count

    with open(count_output_file, 'w') as f:
        json.dump(object_counter, f)


def main(args):
    # load config
    config = load_config(args.config_file)['index']['objects']
    hypersets = load_hypersets(args.hypersets)

    video_ids = None
    if args.video_ids_list_path:
        with args.video_ids_list_path.open() as f:
            video_ids = list(map(str.strip, f))
    
    if args.video_ids:
        video_ids = args.video_ids

    progress = CliProgress()

    common_args = (config, hypersets, args.force, args.save_every, progress)
    
    if not video_ids:  # process only given files, do not use video_id in file names
        process_video_id(args.objects_input_templates, args.str_output_template, args.count_output_template, *common_args)
        return
    
    for video_id in video_ids:  # process all files with given video_id
        object_input_files = [Path(str(t).format(video_id=video_id)) for t in args.objects_input_templates]
        str_output_file = Path(str(args.str_output_template).format(video_id=video_id))
        count_output_file = Path(str(args.count_output_template).format(video_id=video_id))

        process_video_id(object_input_files, str_output_file, count_output_file, *common_args, video_id=video_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Surrogate Text Encoding of Object/Color Detection')

    parser.add_argument('--config-file', default='/data/config.yaml', help='path to yaml configuration file')
    parser.add_argument('--hypersets', default='/data/hypersets.csv', help='path to csv file with hypersets')
    parser.add_argument('--save-every', type=int, default=5000)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')

    parser.add_argument('--video-ids-list-path', type=Path, help='path to file with list of video ids to process')
    parser.add_argument('--video-ids', nargs='+', help='list of video ids to process')

    parser.add_argument('str_output_template', type=Path, help='output path of the jsonl.gz file with STR-encoded objects. {video_id} will be replaced with the video id')
    parser.add_argument('count_output_template', type=Path, help='output path of the json file with objects count. {video_id} will be replaced with the video id.')
    parser.add_argument('objects_input_templates', nargs='+', type=Path, help='path to jsonl.gz file(s) with detected objects; {video_id} will be replaced with the video id. We assume records have the same order in all files!')

    args = parser.parse_args()
    main(args)