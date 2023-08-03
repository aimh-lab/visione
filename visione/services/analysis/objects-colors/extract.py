import argparse
import collections
import itertools
import logging

import numpy as np
import pandas as pd
from skimage import io, measure, transform

from visione.extractor import BaseExtractor


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


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
            tile = tile + 1  # shift color indexes, as 0 is a reserved label (ignore) for regionprops
            props = measure.regionprops_table(tile, properties=('label', 'area'))
            color_areas = props['area'] / tile.size
            color_labels = props['label'] - 1  # shift color indexes back

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
        'detector': 'colors',
    }


def compute_monochromaticity(image_np, eps=1e-7):
    """ Based on https://stackoverflow.com/a/59218331/3175629 """

    image_np = transform.resize(image_np, (128, 128))  # downsample
    pixels = image_np.reshape(-1, 3)  # list of RGB pixels
    pixels -= pixels.mean(axis=0)  # center on mean pixel

    dd = np.linalg.svd(pixels, compute_uv=False)  # get variance in the 3 PCA directions
    var1 = dd[0] / (dd.sum() + eps)  # explained variance in first direction

    # if most variance is in a single direction, pixels are mostly collinear in the RGB cube
    # => monochrome image
    return {
        'monochrome': var1
    }


class ColorExtractor(BaseExtractor):

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

    LABEL_MAP = list(COLORS.keys())

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--nrows', type=int, default=7)
        parser.add_argument('--ncols', type=int, default=7)
        parser.add_argument('--dominant-threshold', type=float, default=0.30)
        parser.add_argument('--associated-threshold', type=float, default=0.15)
        parser.add_argument('--quotient-threshold', type=float, default=0.30)
        parser.add_argument('--dominant-only', action='store_true', default=False)
        parser.add_argument('--keep-duplicates', action='store_true', default=False)
        super(ColorExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(ColorExtractor, self).__init__(args)
        self._loaded = False

    def setup(self):
        if self._loaded:
            return

        n_colors = len(self.COLORS)
        column_names = ['R', 'G', 'B'] + list(range(n_colors))

        def read_color_table(path):
            color_table = pd.read_csv(path, names=column_names, index_col=['R','G','B'], delim_whitespace=True)
            pixel2color_idx = color_table.idxmax(axis=1).values
            return pixel2color_idx

        self.josa_map = read_color_table('tables/LUT_JOSA.txt')
        self.w2c_map = read_color_table('tables/w2c.txt')

        self._loaded = True

    def extract_one(self, image_path):
        image_np = load_image(image_path)
        if image_np is None:
            return None

        common = dict(
            nrows=self.args.nrows,
            ncols=self.args.ncols,
            dominant_threshold=self.args.dominant_threshold,
            associated_threshold=self.args.associated_threshold,
            quotient_threshold=self.args.quotient_threshold,
            dominant_only=self.args.dominant_only,
        )

        josa_colors = extract_colors(image_np, self.josa_map, **common)
        w2c_colors  = extract_colors(image_np, self.w2c_map , **common)
        color_table = merge_colors([josa_colors, w2c_colors], keep_duplicates=self.args.keep_duplicates)

        color_record = table2record(color_table, self.LABEL_MAP, self.args.nrows, self.args.ncols)

        monochrome_record = compute_monochromaticity(image_np)
        record = {**color_record, **monochrome_record}
        return record

    def extract(self, image_paths):
        self.setup()  # lazy loading extractor
        records = map(self.extract_one, image_paths)
        records = list(records)
        return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract color annotations.')
    ColorExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = ColorExtractor(args)
    extractor.run()