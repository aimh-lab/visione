import argparse
import itertools
import more_itertools
import os
from pathlib import Path

import torch.nn.functional as F

os.environ['DB_ROOT'] = ''
import dirtorch.datasets as datasets
import dirtorch.nets as nets
from dirtorch.utils import common as ops
from dirtorch.test_dir import extract_image_features

from visione.savers import MongoCollection, GzipJsonpFile


def load_model(path, iscuda):
    checkpoint = ops.load_checkpoint(path, iscuda)

    net = nets.create_model(pretrained="", **checkpoint['model_options'])
    net = ops.switch_model_to_cuda(net, iscuda, checkpoint)
    net.load_state_dict(checkpoint['state_dict'])

    net.preprocess = checkpoint.get('preprocess', net.preprocess)
    if 'pca' in checkpoint:
        net.pca = checkpoint.get('pca')

    return net

def read_lines(file_path):
    with open(file_path, 'r') as f:
        yield from f

def chunk_image_list(image_list_path, tmp_list_path='/tmp/batch.txt', batch_size=1000):
    with open(image_list_path, 'r') as image_list:
        
        for batch_list in more_itertools.batched(image_list, batch_size):
            ids_and_paths = map(lambda x: x.rstrip().split('\t'), batch_list)
            ids, paths = zip(*ids_and_paths)

            with open(tmp_list_path, 'w') as tmp_txt:
                tmp_txt.write('\n'.join(paths))
            
            yield ids, tmp_list_path


def extract_from_image_lists(image_lists, root='', tmp_list_path='/tmp/batch.txt'):

    iscuda = ops.torch_set_gpu([0])
    net = load_model('./Resnet-101-AP-GeM.pt', iscuda)
    net.pca = net.pca['Landmarks_clean']
    whiten = {'whitenp': 0.25, 'whitenv': None, 'whitenm': 1.0}

    transforms = "Scale(1050, interpolation=Image.BICUBIC, largest=True)"
    dataset_signature = f'ImageList("{tmp_list_path}", root="{root}")'

    for paths in image_lists:

        with open(tmp_list_path, 'w') as tmp_txt:
            tmp_txt.write('\n'.join(paths))

        # create dataset
        dataset = datasets.create(dataset_signature)

        # extraction
        features = extract_image_features(dataset, transforms, net, iscuda=iscuda)

        # features = pool([features], 'gem', 3)   # pool (no-op with only one transform)
        features = F.normalize(features, p=2, dim=1)  # l2 normalization
        features = ops.tonumpy(features)  # to cpu
        features = ops.whiten_features(features, net.pca, **whiten)

        yield features


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
        image_list = read_lines(args.image_list)
        ids_and_paths = map(lambda x: x.rstrip().split('\t'), image_list)
        if not args.force:
            ids_and_paths = filter(lambda x: x[0] not in saver, ids_and_paths)
        image_ids, image_paths = zip(*ids_and_paths)

        # chunked image feature extraction
        chunked_image_paths = more_itertools.batched(image_paths, args.save_every)
        chunked_features = extract_from_image_lists(chunked_image_paths, root=args.image_root)
        image_features = itertools.chain.from_iterable(chunked_features)

        records = ({'_id': _id, 'feature': feature.tolist()} for _id, feature in zip(image_ids, image_features))
        saver.add_many(records)
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Detect Objects with TensorFlow Hub models.')

    parser.add_argument('image_list', type=Path, help='path to TSV file containing image IDS and paths (one per line)')
    parser.add_argument('--image-root', type=Path, default=Path('/data'), help='path to prepend to image paths')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
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