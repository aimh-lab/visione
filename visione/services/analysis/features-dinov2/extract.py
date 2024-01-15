import argparse
import logging
import os

import numpy as np
from PIL import Image
import torch
from torchvision import transforms

from visione.extractor import BaseExtractor


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


def load_image(image_path, *, transform=None):
    image = Image.open(image_path)
    if transform is not None:
        image = transform(image)
    return image


class ImageListDataset(torch.utils.data.Dataset):
    def __init__(self, image_paths):
        self.image_paths = image_paths
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ])

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        return load_image(self.image_paths[idx], transform=self.transform)



class DinoV2Extractor(BaseExtractor):

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--model', default='dinov2_vits14', choices=('dinov2_vits14', 'dinov2_vitb14', 'dinov2_vitl14', 'dinov2_vitg14'), help='Model to use')
        parser.add_argument('--batch-size', default=1, type=int, help='batch size')
        parser.add_argument('--num-workers', default=4, type=int, help='number of workers')
        super(DinoV2Extractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(DinoV2Extractor, self).__init__(args)
        self.device = None
        self.model = None

    def setup(self):
        if self.model is None:
            self.device = 'cuda' if self.args.gpu and torch.cuda.is_available() else 'cpu'
            self.model = torch.hub.load('facebookresearch/dinov2', self.args.model).to(self.device)
            self.model.eval()

    def extract(self, image_paths):
        self.setup()

        dataset = ImageListDataset(image_paths)
        dataloader = torch.utils.data.DataLoader(
            dataset,
            shuffle=False,
            batch_size=self.args.batch_size,
            num_workers=self.args.num_workers,
            pin_memory=True
        )

        features = []
        with torch.no_grad():
            for x in dataloader:
                x = x.to(self.device, non_blocking=True)
                fv = self.model(x).cpu().numpy()
                features.append(fv)
        features = np.concatenate(features, axis=0)
        records = [{'feature_vector': f.tolist()} for f in features]
        return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a DINOv2 model')
    DinoV2Extractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = DinoV2Extractor(args)
    extractor.run()