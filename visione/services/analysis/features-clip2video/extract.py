import argparse
import logging
import os

# from .preprocessing import preprocess_shots
import importlib
preprocessing = importlib.import_module("visione.services.analysis.features-clip2video.preprocessing")
from preprocessing import preprocess_shots

from visione.services.common.extractor import BaseVideoExtractor
# from visione.extractor import BaseExtractor

loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


class CLIP2VideoExtractor(BaseVideoExtractor):

    @classmethod
    def add_arguments(cls, parser):
        # parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='hugging face handle of the CLIP model')
        super(CLIP2VideoExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(CLIP2VideoExtractor, self).__init__(args)
        self.device = None
        self.model = None
        self.processor = None

    def setup(self):
        # TODO
        return None

        # if self.model is None:
        #     # lazy load libraries and models
        #     import torch
        #     from transformers import CLIPProcessor, CLIPModel

        #     self.device = 'cuda' if args.gpu and torch.cuda.is_available() else 'cpu'
        #     self.model = CLIPModel.from_pretrained(args.model_handle).to(self.device)
        #     self.processor = CLIPProcessor.from_pretrained(args.model_handle)

    def extract(self, shot_paths_and_times):
        self.setup()  # lazy load model

        preprocess_shots(shot_paths_and_times)

        print([list(x) for x in shot_paths_and_times])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIP2VideoExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIP2VideoExtractor(args)
    extractor.run()