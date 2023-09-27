import argparse
import itertools
import more_itertools
import os
from pathlib import Path
import torch
import dinov2.data.transforms as T
from torchvision import datasets


os.environ['DB_ROOT'] = ''

from visione.savers import MongoCollection, GzipJsonpFile


def load_model(path, iscuda):
    # temporary: loading model from torch hub
    model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vitg14')
    if iscuda:
        model = model.to('cuda:0')
    # Set to eval mode
    model.eval()
    return model

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
    #TODO load model from filesystem
    model = load_model('./Resnet-101-AP-GeM.pt', iscuda)
    transforms = T.make_classification_eval_transform()


    for paths in image_lists:
        with open(tmp_list_path, 'w') as tmp_txt:
            tmp_txt.write('\n'.join(paths))

        #TODO load dataset
        dataset = datasets.ImageFolder(tmp_list_path, transform=transforms)
        dataloader = torch.utils.data.DataLoader(dataset, batch_size=1, shuffle=False, num_workers=1)
        features = model(dataloader)
        yield features

        '''

        #Temporary? single img extraction
        for img_path in paths:
            img = Image.open(img_path)
            #check if img has just one channel
            if img.mode == 'L':
                img = Image.open(img_path).convert('RGB')
            img = transforms(img)[:3].unsqueeze(0)
            if iscuda:
                img = img.to('cuda')

            with torch.no_grad():
                features = model(img)
            
            if iscuda:
                features = features.cpu()

        yield features.numpy()
'''


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
        image_ids, image_paths = more_itertools.unzip(ids_and_paths)

        # chunked image feature extraction
        chunked_image_paths = more_itertools.batched(image_paths, args.save_every)
        chunked_features = extract_from_image_lists(chunked_image_paths, root=args.image_root)
        image_features = itertools.chain.from_iterable(chunked_features)

        records = ({'_id': _id, 'feature': feature.tolist()} for _id, feature in zip(image_ids, image_features))
        saver.add_many(records)
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract DINOv2 features.')

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