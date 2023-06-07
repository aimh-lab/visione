import argparse
import logging
import os

from visione.extractor import BaseExtractor


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


class CLIPExtractor(BaseExtractor):

    @classmethod
    def add_arguments(cls, parser):
        parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='hugging face handle of the CLIP model')
        super(CLIPExtractor, cls).add_arguments(parser)

    def __init__(self, args):
        super(CLIPExtractor, self).__init__(args)
        self.device = None
        self.model = None
        self.processor = None

    def setup(self):
        if self.model is None:
            # lazy load libraries and models
            import torch
            from transformers import CLIPProcessor, CLIPModel

            self.device = 'cuda' if self.args.gpu and torch.cuda.is_available() else 'cpu'
            self.model = CLIPModel.from_pretrained(self.args.model_handle).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(self.args.model_handle)

    def extract(self, image_paths):
        self.setup()  # lazy load model

        from PIL import Image
        import torch

        with torch.no_grad():
            images_pil = [Image.open(i) for i in image_paths]
            image_pt = self.processor(images=images_pil, return_tensors="pt")
            image_pt = {k: v.to(self.device) for k, v in image_pt.items()}
            image_features = self.model.get_image_features(**image_pt)
            records = [{'feature_vector': f.tolist()} for f in image_features.cpu().numpy()]
            return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIPExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIPExtractor(args)
    extractor.run()