import argparse
import collections
import copy
import functools
import itertools
import math
import more_itertools
import multiprocessing
import operator
from pprint import pprint
import warnings

import pandas as pd
from pymongo import MongoClient
from pymongo.errors import BulkWriteError
from pymongo.operations import UpdateOne
from tqdm import tqdm


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


def add_hypersets(record, hypersets):

    # generate hyperset records for each object record
    def _generate_augmented_object_list(object_list):
        for record in object_list:
            yield record

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
    colors  = [o for o in record['objects'] if o['detector'] == 'colors']
    objects = [o for o in record['objects'] if o['detector'] != 'colors']

    objects.sort(key=lambda x: x['label'])
    objects = itertools.chain.from_iterable(
        _nms(group, iou_threshold=iou_threshold)
        for _, group in itertools.groupby(objects, key=lambda x: x['label'])
    )
    objects = list(objects)
    record['objects'] = objects + colors

    return record


def _str_positional_box_encode(objects, nrows=7, ncols=7, rtol=0.1):

    def _encode_one(object_record):
        # TODO aggiungere un controllo: se l'oggetto proviede da object_record['detector']=hyperset
        #  non va aggiunta la bbox nel filed txt
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
    tokens.sort()  # this helps when debugging

    surrogate = ' '.join(tokens)
    return surrogate


def _str_count_encode(objects, gray, thresholds):
    label_counts = collections.defaultdict(int)  # missing keys defaults to 0

    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']

        is_hyperset = object_record.get('is_hyperset', False)



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

    # is gray
    gray_token = 'colorkeyframe' if gray > thresholds.get('gray', 0.01) else 'graykeyframe'
    gray_token = f'4wc{gray_token}'
    tokens.append(gray_token)

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

    label_counts = collections.defaultdict(int)  # missing keys defaults to 0
    tokens = []
    for object_record in objects:
        label    = object_record['label'   ]
        score    = object_record['score'   ]
        detector = object_record['detector']

        # do not include colors in the object info string
        if detector == 'colors':
            continue

        detector = detector_nicknames.get(detector, detector)

        # TODO usare anche il detector nella key usata in label count per distinguere le varie reti (esempio nei commenti)
        #label_detector=label+"_"+detector
        #label_counts[label_detector] += 1
        #label_count = label_counts[label_detector]
        label_counts[label] += 1 #TODO
        label_count = label_counts[label] #TODO

        token = f'{label}{label_count}({detector}:{score:.2f})'
        tokens.append(token)

    tokens.sort()  # this helps when debugging
    text = ' '.join(tokens)
    return text


def str_encode(record, thresholds={}):
    objects = record.get('objects', [])
    gray = record.get('gray', 1)  # color frame by default

    return {
        '_id': record['_id'],
        'object_box_str': _str_positional_box_encode(objects),
        'object_count_str': _str_count_encode(objects, gray, thresholds),
    }


def generate_write_op(record):
    _id = record.pop('_id')
    return UpdateOne({'_id': _id}, {'$set': record})


def process_record(record, hypersets, object_thresholds):
    # TODO qui prima di fare object info, nms o qualsiasi altra cosa farei un filtraggio che facevamo lo scorso anno:
    # TODO step  1) eliminare tutti i record per cui (confidence < object_threshold )
    # TODO step  2) eliminare tutti i record per cui l'area della bounding box sia molto piccola,
    # lo scorso anno controllavamo se (normalizedAreaBB<0.0001),
    # dove normalizedAreaBB=max(0,(y1 - y0)) * max(0,(x1 - x0))
    # nota che mettevamo il max (cosa che non ho visto nella tua area) perchè qualche rete ci aveva
    # dato dei valori anomali fuori range, non mi ricordo quale rete, non ho fatto un controllo
    # se abbiamo problemi simili quest'anno

    object_info = build_object_info(record.get('objects', [])) #step 3

    #TODO step 4: metterei  qui gli hyperset (record = add_hypersets(record, hypersets)) prima di fare la nms
    # però dopo per poter fare un conteggio degli oggetti potrebbe essere necessario aggiungere
    # la info da quale rete proviene ciascun hyperset

    record = non_maximum_suppression(record) # step 5

    #TODO step 5: creare il field txt (prima di hyperset o altro)
    #Secondo me una soluzione potrebbe essere  mettere la funzione add_hypersets solo dentro la funzione
    # _str_count_encode richiamata in str_encode. Però bisogna fare attenzione a come i creano i contatori
    # degli oggetti  che secondo me vanno divisi per rete se possiamo ritrovarci con un conteggio sbagliato
    object_counts = count_objects(record) #step 6 #TODO non ho ancora chiaro dove verrà usato da controllare

    record = add_hypersets(record, hypersets) #TODO questo lo toglierei da qui come scritto prima

    record = str_encode(record, thresholds=object_thresholds) #step 6 (commenti nella funzione)

    record['object_info'] = object_info

    write_op = generate_write_op(record)
    return object_counts, write_op


class PicklableFunc:
    def __init__(self, func, *args, **kwargs):
        self.func = func
        self.args = args
        self.kwargs = kwargs

    def __call__(self, x):
        return self.func(x, *self.args, **self.kwargs)


def main(args):
    client = MongoClient(args.host, port=args.port, username=args.username, password=args.password)
    objects_collection = client[args.db][args.objects_collection]
    output_collection = client[args.db][args.output_collection]

    n_frames = client[args.db].command('collstats', 'frames')['count']
    config = client[args.db]['config'].find_one({'_id': 'config'})
    object_thresholds = config['objects']['threshold']
    hypersets = load_hypersets(args.hypersets)

    records = objects_collection.find()

    with multiprocessing.Pool() as pool:
        func = PicklableFunc(process_record, hypersets, object_thresholds)
        counts_and_ops = pool.imap_unordered(func, records)
        counts_and_ops = tqdm(counts_and_ops, total=n_frames)

        batches = more_itertools.batched(counts_and_ops, args.batch_size)
        batches = map(list, batches)

        object_counter = collections.Counter()
        for batch in batches:
            batch_of_counts, batch_of_ops = more_itertools.unzip(batch)
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