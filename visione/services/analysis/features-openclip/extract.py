import argparse
import itertools
import logging
import os

import more_itertools
from PIL import Image
import torch
import open_clip

from visione.extractor import BaseExtractor


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


class ImageListDataset(torch.utils.data.Dataset):
    def __init__(self, paths, processor):
        self.paths = paths
        self.processor = processor

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        path = self.paths[idx]
        image = Image.open(path)
        image_pt = self.processor(image)
        return image_pt


class WrapIterableDataset(torch.utils.data.IterableDataset):
    def __init__(self, iterable, batch_size, processor, preload=False):
        self.iterable = iterable
        self.batch_size = batch_size
        self.processor = processor

        if preload:
            self.iterable = list(self.iterable)

    def process(self, item):
        images = [Image.open(i) for i in item]
        images_pt = self.processor(images=images, return_tensors="pt")
        return images_pt

    def __iter__(self):
        worker_info = torch.utils.data.get_worker_info()

        itr = self.iterable
        if worker_info is not None:
            itr = itertools.islice(self.iterable, worker_info.id, None, worker_info.num_workers)

        itr = more_itertools.chunked(itr, self.batch_size)
        itr = map(self.process, itr)
        yield from itr


class OpenCLIPExtractor(BaseExtractor):

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='model handle')
        parser.add_argument('--batch-size', default=1, type=int, help='batch size')
        parser.add_argument('--num-workers', default=4, type=int, help='number of workers')
        super(OpenCLIPExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(OpenCLIPExtractor, self).__init__(args)
        self.device = None
        self.model = None
        self.processor = None

    def setup(self):
        if self.model is None:
            # lazy load models
            self.device = 'cuda' if self.args.gpu and torch.cuda.is_available() else 'cpu'
            os.makedirs('/cache/open_clip', exist_ok=True)
            self.model, _, self.processor = open_clip.create_model_and_transforms(self.args.model_handle, cache_dir='/cache/open_clip')
            self.model.to(self.device)
            self.model.eval()

    def extract(self, image_paths):
        records = list(self.extract_iterable(image_paths))
        return records

    def extract_iterable(self, image_paths):
        self.setup()  # lazy load model

        # FIXME: iterable dataset has problems with h5py in multiprocessing, it only works with preload=True
        # dataset = WrapIterableDataset(image_paths, batch_size, self.processor, preload=True)
        # dataloader = torch.utils.data.DataLoader(dataset, batch_size=None, num_workers=24)

        # if we must preload, we might as well use a standard dataset
        image_paths = list(image_paths)
        dataset = ImageListDataset(image_paths, self.processor)
        dataloader = torch.utils.data.DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers)

        with torch.no_grad():
            for images_pt in dataloader:
                images_pt = images_pt.to(self.device)
                images_features = self.model.encode_image(images_pt).float()
                records = [{'feature_vector': f.tolist()} for f in images_features.cpu().numpy()]
                yield from records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from an Open CLIP model')
    OpenCLIPExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = OpenCLIPExtractor(args)
    extractor.run()