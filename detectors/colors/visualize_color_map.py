import argparse
import collections
import json

import numpy as np
from skimage import io

from extract import COLORS


def main(args):
    with open(args.color_map, 'r') as f:
        color_map = json.load(f)
    
    hwhw = np.tile((args.height, args.width), 2).reshape(1, 4)

    scores = np.array(color_map['object_scores'     ])
    labels = np.array(color_map['object_class_names'])
    boxes  = np.array(color_map['object_boxes_yxyx' ])
    boxes  = np.round(boxes * hwhw).astype(int)

    colors_per_box = collections.defaultdict(list)
    output = np.zeros((args.height, args.width, 4))

    for box, label, score in zip(boxes, labels, scores):
        colors_per_box[tuple(box)].append((label, score))
    
    for box, colors in colors_per_box.items():
        y0, x0, y1, x1 = box
        n = 1. / len(colors)
        for i, (label, score) in enumerate(colors):
            yi0 = int(y0 + i*n* (y1 - y0))
            yi1 = int(y0 + (i+1)*n* (y1 - y0))
            output[yi0:yi1, x0:x1, :3] = COLORS[label]
            output[yi0:yi1, x0:x1, 3] = score

    io.imsave(args.output, output)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Visualize color annotations.')
    parser.add_argument('color_map', help='json file of the color map')
    parser.add_argument('output', help='output color map image file')
    parser.add_argument('--width', type=int, default=512, help='width of the output visualization')
    parser.add_argument('--height', type=int, default=512, help='height of the output visualization')
    args = parser.parse_args()
    main(args)

