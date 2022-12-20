import argparse
import collections
import copy
import functools
import itertools
import math
import more_itertools
import operator
from pprint import pprint
import warnings

import pandas as pd
from pymongo import MongoClient
from pymongo.errors import BulkWriteError
from pymongo.operations import UpdateOne
from tqdm import tqdm


def count_objects(record):
    return collections.Counter([o['label'] for o in record['objects']])


def add_hypersets(records, hyperset_file):
    hypersets = pd.read_csv(hyperset_file, sep=';', usecols=[0, 1], names=['set', 'hyperset'], index_col=0)
    hypersets = hypersets.squeeze("columns")  # only one column => pd.Series

    # drop empty hypersets, split hypersets by commas, strip
    hypersets = hypersets \
        .dropna() \
        .str.split(',') \
        .map(lambda x: list(map(str.strip, x)))
    
    # generate hyperset records for each object record
    def _generate_augmented_object_list(object_list):
        for record in object_list:
            yield record

            label_hypersets = hypersets.get(record['label'], [])
            for hyperset in label_hypersets:
                hyper_record = copy.deepcopy(record)
                hyper_record['label'] = hyperset
                # hyper_record['score'] = -1  # TODO this line shoud be safely deleted
                hyper_record['detector'] = 'hyperset'
                yield hyper_record
    
    # substitute 'objects' field of each document with the augmented object list
    for record in records:
        objects = record['objects']
        augmented_objects = _generate_augmented_object_list(objects)
        record['objects'] = list(augmented_objects)
        yield record


def _nms(objects, iou_threshold):
    def _area(box):
        y0, x0, y1, x1 = box
        return (y1 - y0) * (x1 - x0)

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


def non_maximum_suppression(record, iou_threshold=0.55):
    record['objects'] = _nms(record['objects'], iou_threshold=iou_threshold)
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

    tokens = map(_encode_one, objects)
    tokens = itertools.chain.from_iterable(tokens)
    tokens = list(tokens)

    surrogate = ' '.join(tokens)
    return surrogate


def _str_count_encode(objects, gray, thresholds):
    label_counts = collections.defaultdict(int)  # missing keys defaults to 0

    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']

        label_counts[label] += 1
        label_count = label_counts[label]

        frequency = ''
        if detector == 'colors':
            if label_count > 1:  # add colors only once and skip repetitions
                continue
            label_count = ''
        elif detector != 'hyperset':
            confidence = score - thresholds.get(detector, 0)
            frequency = int(10 * confidence / 2 + 2)  # TODO: why so? ask Lucia about this formula ..
            frequency = f'|{frequency}'
        
        token = f'4wc{label}{label_count}{frequency}'
        tokens.append(token)
    
    # is gray
    gray_token = 'colorkeyframe' if gray > thresholds.get('gray', 0.01) else 'graykeyframe'
    gray_token = f'4wc{gray_token}'
    tokens.append(gray_token)

    surrogate = ' '.join(tokens)
    return surrogate


def _object_info(objects):
    # do not report hyperset & colors objects
    objects = filter(lambda x: x['detector'] not in ('colors', 'hyperset'), objects)

    label_counts = collections.defaultdict(int)  # missing keys defaults to 0
    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']

        label_counts[label] += 1
        label_count = label_counts[label]

        token = f'{label}{label_count}({detector}:{score:.2f})'
        tokens.append(token)
    
    text = ' '.join(tokens)
    return text


def str_encode(record, thresholds={}):
    objects = record.get('objects', [])
    gray = record.get('gray', 1)  # color frame by default

    return {
        '_id': record['_id'],
        'object_box_str': _str_positional_box_encode(objects),
        'object_count_str': _str_count_encode(objects, gray, thresholds),
        'object_info': _object_info(objects),
    }


def generate_write_op(record):
    _id = record.pop('_id')
    return UpdateOne({'_id': _id}, {'$set': record})


def main(args):
    client = MongoClient(args.host, port=args.port, username=args.username, password=args.password)
    objects_collection = client[args.db][args.objects_collection]
    output_collection = client[args.db][args.output_collection]

    records = objects_collection.find()
    records = map(non_maximum_suppression, records)
    records1, records2 = itertools.tee(records, 2)
    object_counts = map(count_objects, records1)

    records = add_hypersets(records2, args.hypersets)
    records = map(str_encode, records)

    write_ops = map(generate_write_op, records)

    n_frames = client[args.db].command('collstats', 'frames')['count']
    write_ops = tqdm(write_ops, total=n_frames)

    counts_and_ops = zip(object_counts, write_ops)

    batches = more_itertools.batched(counts_and_ops, args.batch_size)
    batches = map(list, batches)

    object_counter = collections.Counter()
    for batch in batches:
        batch_of_counts, batch_of_ops = zip(*batch)
        object_counter = functools.reduce(operator.add, batch_of_counts, object_counter)
        batch_of_ops = list(batch_of_ops)
        try:
            output_collection.bulk_write(batch_of_ops, ordered=False)
        except BulkWriteError as bwe:
            print('Something wrong in updating docs with codes:')
            pprint(bwe.details)
    
    client[args.db]['stats'].update_one({'_id': 'stats'}, {'$set': {'object_count': object_counter}}, upsert=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Surrogate Text Encoding of Object/Color Detection')

    parser.add_argument('--host', default='mongo')
    parser.add_argument('--port', type=int, default=27017)
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', default='visione')
    parser.add_argument('db')
    parser.add_argument('--objects-collection', default='view.objects.all')
    parser.add_argument('--output-collection', default='frames')
    parser.add_argument('--hypersets', default='hypersets.csv', help='path to csv file with hypersets')
    parser.add_argument('--batch-size', type=int, default=5000)

    args = parser.parse_args()
    main(args)