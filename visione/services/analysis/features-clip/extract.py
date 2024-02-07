import argparse
import itertools
import logging
import os

import more_itertools
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel

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
        image_pt = self.processor(images=[image], return_tensors="pt")
        return image_pt

    @staticmethod
    def collate_fn(batch):
        return {k: torch.concat([item[k] for item in batch]) for k in batch[0].keys()}


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


class CLIPExtractor(BaseExtractor):

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='hugging face handle of the CLIP model')
        parser.add_argument('--batch-size', default=1, type=int, help='batch size')
        parser.add_argument('--num-workers', default=4, type=int, help='number of workers')
        super(CLIPExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(CLIPExtractor, self).__init__(args)
        self.device = None
        self.model = None
        self.processor = None

    def setup(self):
        if self.model is None:
            # lazy load models
            self.device = 'cuda' if self.args.gpu and torch.cuda.is_available() else 'cpu'
            self.model = CLIPModel.from_pretrained(self.args.model_handle).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(self.args.model_handle)

    def extract(self, image_paths):
        batch_size = len(image_paths)
        records = list(self.extract_iterable(image_paths, batch_size))
        return records

    def extract_iterable(self, image_paths):
        self.setup()  # lazy load model

        # FIXME: iterable dataset has problems with h5py in multiprocessing, it only works with preload=True
        # dataset = WrapIterableDataset(image_paths, batch_size, self.processor, preload=True)
        # dataloader = torch.utils.data.DataLoader(dataset, batch_size=None, num_workers=24)

        # if we must preload, we might as well use a standard dataset
        image_paths = list(image_paths)
        dataset = ImageListDataset(image_paths, self.processor)
        dataloader = torch.utils.data.DataLoader(
            dataset,
            batch_size=self.args.batch_size,
            num_workers=self.args.num_workers,
            collate_fn=ImageListDataset.collate_fn
        )

        with torch.no_grad():
            for images_pt in dataloader:
                images_pt = {k: v.to(self.device) for k, v in images_pt.items()}
                images_features = self.model.get_image_features(**images_pt)
                records = [{'feature_vector': f.tolist()} for f in images_features.cpu().numpy()]
                yield from records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIPExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIPExtractor(args)
    extractor.run()