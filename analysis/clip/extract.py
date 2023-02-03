import argparse
import logging
import more_itertools
from pathlib import Path

from PIL import Image
from prefetch_generator import BackgroundGenerator
import torch
from transformers import CLIPProcessor, CLIPModel
from tqdm import tqdm

from visione.savers import MongoCollection, GzipJsonpFile, HDF5File


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


def main(args):
    image_list = sorted(args.image_dir.glob('*.png'))
    n_images = len(image_list)
    initial = 0

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
    elif args.output_type == 'hdf5':
        saver = HDF5File(args.output, shape=(n_images, args.dimensionality), flush_every=args.save_every)

    device = 'cuda' if args.gpu and torch.cuda.is_available() else 'cpu'
    model = CLIPModel.from_pretrained(args.model_handle).to(device)
    processor = CLIPProcessor.from_pretrained(args.model_handle)

    with saver:
        image_list = map(lambda x: f'{x.stem}\t{x}', image_list)

        ids_and_paths = map(lambda x: x.rstrip().split('\t'), image_list)
        if not args.force:
            ids_and_paths = filter(lambda x: x[0] not in saver, ids_and_paths)
            ids_and_paths = list(ids_and_paths)
            initial = n_images - len(ids_and_paths)

        unzipped_ids_and_paths = more_itertools.unzip(ids_and_paths)
        head, unzipped_ids_and_paths = more_itertools.spy(unzipped_ids_and_paths)
        image_ids, image_paths = unzipped_ids_and_paths if head else ((),())

        images_pil = map(Image.open, image_paths)
        images_pt = map(lambda image_pil: processor(images=image_pil, return_tensors="pt"), images_pil)
        # images_pt = BackgroundGenerator(images_pt, max_prefetch=10)
        images_pt = map(lambda x: {k: v.to(device) for k, v in x.items()}, images_pt)
        image_features = map(lambda x: model.get_image_features(**x), images_pt)

        records = ({'_id': _id, 'feature': feature.tolist()} for _id, feature in zip(image_ids, image_features))
        records = tqdm(records, initial=initial, total=n_images)
        saver.add_many(records)
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')

    parser.add_argument('image_dir', type=Path, help='directory containing images to be processed')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--force', default=False, action='store_true', help='overwrite existing data')
    parser.add_argument('--model-handle', default='laion/CLIP-ViT-H-14-laion2B-s32B-b79K', help='hugging face handle of the CLIP model')
    parser.add_argument('--gpu', default=False, action='store_true', help='use a GPU')

    subparsers = parser.add_subparsers(dest="output_type")

    mongo_parser = subparsers.add_parser('mongo')
    mongo_parser.add_argument('--host', default='mongo')
    mongo_parser.add_argument('--port', type=int, default=27017)
    mongo_parser.add_argument('--username', default='admin')
    mongo_parser.add_argument('--password', default='visione')
    mongo_parser.add_argument('db')
    mongo_parser.add_argument('--collection', default='features.clip')

    file_parser = subparsers.add_parser('file')
    file_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (gzipped JSONP file)')

    hdf5_parser = subparsers.add_parser('hdf5')
    hdf5_parser.add_argument('-o', '--output', type=Path, default=None, help='path to result file (hdf5 file)')
    hdf5_parser.add_argument('-d', '--dimensionality', type=int, default=768, help='number of dimensions of features')

    args = parser.parse_args()
    main(args)