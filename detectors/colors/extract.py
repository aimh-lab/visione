import argparse
import collections
import itertools
from pathlib import Path

import numpy as np
import pandas as pd
from prefetch_generator import BackgroundGenerator
from skimage import io, measure
from tqdm import tqdm

from visione.savers import MongoCollection, GzipJsonpFile


COLORS = {
    'black' : [0.00, 0.00, 0.00],
    'blue'  : [0.00, 0.00, 1.00],
    'brown' : [0.50, 0.40, 0.25],
    'grey'  : [0.50, 0.50, 0.50],
    'green' : [0.00, 1.00, 0.00],
    'orange': [1.00, 0.80, 0.00],
    'pink'  : [1.00, 0.50, 1.00],
    'purple': [1.00, 0.00, 1.00],
    'red'   : [1.00, 0.00, 0.00],
    'white' : [1.00, 1.00, 1.00],
    'yellow': [1.00, 1.00, 0.00],
}


def read_lines(file_path):
    with open(file_path, 'r') as f:
        yield from f


def load_image(image_path):
    try:
        image_np = io.imread(image_path)
        # TODO convert to RGB if not
    except KeyboardInterrupt as e:
        raise e
    except:
        log.warn(f'{image_path}: Error loading image')
        return None

    return image_np


def extract_colors(
    image_np,
    color_map,
    nrows=7,
    ncols=7,
    dominant_threshold=0.30,
    associated_threshold=0.15,
    quotient_threshold=0.30,
    dominant_only=False,
):
    # map whole image to color index
    idx_image = (image_np // 8).astype(np.uint16)
    idx_image *= np.array([1, 32, 1024], dtype=np.uint16).reshape((1, 1, 3))
    idx_image = idx_image.sum(axis=2)
    idx_image = color_map[idx_image]

    im_h = image_np.shape[0]
    im_w = image_np.shape[1]

    tile_h = im_h // nrows
    tile_w = im_w // ncols

    tiles_colors = {}

    for r in range(nrows):
        for c in range(ncols):
            tile = idx_image[
                r * tile_h: (r + 1) * tile_h,
                c * tile_w: (c + 1) * tile_w,
            ]

            # find areas per color index
            props = measure.regionprops_table(tile, properties=('label', 'area'))
            color_areas = props['area'] / tile.size
            color_labels = props['label']

            dominant_idx = color_areas.argmax()
            dominant_color = color_labels[dominant_idx]
            dominant_area = color_areas[dominant_idx]

            tile_colors = []

            if dominant_area > dominant_threshold:
                tile_colors.append((dominant_color, dominant_area))

                if not dominant_only:
                    is_associated = (color_areas >= associated_threshold) & ((color_areas / dominant_area) >= quotient_threshold)
                    is_associated[dominant_idx] = False

                    associated_colors = color_labels[is_associated]
                    associated_areas = color_areas[is_associated]

                    tile_colors.extend(zip(associated_colors, associated_areas))

            tile_colors.sort(reverse=True, key=lambda x: x[1])
            tiles_colors[(r, c)] = tile_colors

    return tiles_colors


def merge_colors(tables, keep_duplicates=True):
    """ Merge several color tables.

    Args:
        tables (list): list of dicts of form (row, col) -> [(color_id, score), ...]
        keep_duplicates (bool, optional): _description_. Defaults to True.
    """

    def merge_cells(cells):
        n_tables = len(cells)
        cells = itertools.chain.from_iterable(cells)

        if not keep_duplicates:
            out = collections.defaultdict(float)
            for color, score in cells:
                out[color] += score / n_tables
            cells = out.items()

        out = sorted(cells, key=lambda x: x[1], reverse=True)
        return out

    keys = tables[0].keys()
    merged_table = {
        key: merge_cells([t[key] for t in tables])
        for key in keys
    }

    return merged_table


def process_images(
    images,
    nrows=7,
    ncols=7,
    dominant_threshold=0.30,
    associated_threshold=0.15,
    quotient_threshold=0.30,
    dominant_only=False,
    keep_duplicates=True,
):
    n_colors = len(COLORS)
    column_names = ['R', 'G', 'B'] + list(range(n_colors))

    def read_color_table(path):
        color_table = pd.read_csv(path, names=column_names, index_col=['R','G','B'], delim_whitespace=True)
        pixel2color_idx = color_table.idxmax(axis=1).values
        return pixel2color_idx

    josa_map = read_color_table('tables/LUT_JOSA.txt')
    w2c_map = read_color_table('tables/w2c.txt')

    common = dict(
        nrows=nrows,
        ncols=ncols,
        dominant_threshold=dominant_threshold,
        associated_threshold=associated_threshold,
        quotient_threshold=quotient_threshold,
        dominant_only=dominant_only,
    )

    for image_np in images:
        josa_colors = extract_colors(image_np, josa_map, **common)
        w2c_colors  = extract_colors(image_np, w2c_map , **common)
        color_table = merge_colors([josa_colors, w2c_colors], keep_duplicates=keep_duplicates)
        yield color_table


def table2record(color_table, label_map, nrows, ncols):
    scores = []
    boxes = []
    labels = []

    for (r, c), cell_colors in color_table.items():
        if not cell_colors:
            continue
        
        # yxyx format
        bbox = [r / nrows, c / ncols, (r + 1) / nrows, (c + 1) / ncols]

        cell_labels, cell_scores = zip(*cell_colors)
        cell_labels = [label_map[c] for c in cell_labels]

        scores.extend(cell_scores)
        labels.extend(cell_labels)
        boxes.extend([bbox] * len(cell_colors))

    return {
        'object_scores': scores,
        'object_boxes_yxyx': boxes,
        'object_class_names': labels,
    }


def main(args):

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
        saver = GzipJsonpFile(args.output, flush_every=args.save_every)

    with saver:
        # read image ids and paths
        image_list = read_lines(args.image_list)
        ids_and_paths = map(lambda x: x.rstrip().split('\t'), image_list)

        # process missing only (resume)
        if not args.force:
            ids_and_paths = filter(lambda x: x[0] not in saver, ids_and_paths)

        # prepare image paths
        image_ids, image_paths = zip(*ids_and_paths)
        image_paths = map(lambda path: args.image_root / path, image_paths)

        # load images
        images = map(io.imread, image_paths)
        images = BackgroundGenerator(images, max_prefetch=10)

        color_tables = process_images(
            images,
            nrows=args.nrows,
            ncols=args.ncols,
            dominant_threshold=args.dominant_threshold,
            associated_threshold=args.associated_threshold,
            quotient_threshold=args.quotient_threshold,
            dominant_only=args.dominant_only,
            keep_duplicates=args.keep_duplicates,
        )

        label_map = list(COLORS.keys())
        records = map(lambda x: table2record(x, label_map, args.nrows, args.ncols), color_tables)
        records = itertools.starmap(lambda _id, r: {'_id': _id, **r}, zip(image_ids, records))
        records = tqdm(records)
        saver.add_many(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract color annotations.')

    # input params
    parser.add_argument('image_list', type=Path, help='path to TSV file containing image IDS and paths (one per line)')
    parser.add_argument('--image-root', type=Path, default=Path('/data'), help='path to prepend to image paths')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')

    # extraction params
    parser.add_argument('--ncols', type=int, default=7, help='number of cell columns')
    parser.add_argument('--nrows', type=int, default=7, help='number of cell rows')
    parser.add_argument('--dominant-threshold', type=float, default=0.3, help='th_dominant')
    parser.add_argument('--associated-threshold', type=float, default=0.15, help='th_associated')
    parser.add_argument('--quotient-threshold', type=float, default=0.15, help='th_quotient_da')
    parser.add_argument('--dominant-only', default=False, action='store_true', help='whether to keep duplicate colors')
    parser.add_argument('--keep-duplicates', default=True, action='store_true', help='whether to keep duplicate colors')

    # output params
    subparsers = parser.add_subparsers(dest="output_type")

    mongo_parser = subparsers.add_parser('mongo')
    mongo_parser.add_argument('--host', default='mongo')
    mongo_parser.add_argument('--port', type=int, default=27017)
    mongo_parser.add_argument('--username', default='admin')
    mongo_parser.add_argument('--password', default='visione')
    mongo_parser.add_argument('db')
    mongo_parser.add_argument('--collection', default='features.gem')

    file_parser = subparsers.add_parser('file')
    file_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (gzipped JSONP file)')

    args = parser.parse_args()
    main(args)