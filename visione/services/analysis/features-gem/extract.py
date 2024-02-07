import argparse
import logging
import os
import tempfile

from visione.extractor import BaseExtractor


loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)


class GeMExtractor(BaseExtractor):

    def __init__(self, args, ckpt_path='./Resnet-101-AP-GeM.pt'):
        super(GeMExtractor, self).__init__(args)
        self.ckpt_path = ckpt_path
        self.net = None
        self.iscuda = None

    def setup(self):
        if self.net is not None:
            return

        # lazy load libraries and models
        os.environ['DB_ROOT'] = ''
        import dirtorch.nets as nets
        from dirtorch.utils import common as ops

        gpus = [0] if self.args.gpu else [-1]

        iscuda = ops.torch_set_gpu(gpus)
        checkpoint = ops.load_checkpoint(self.ckpt_path, iscuda)

        net = nets.create_model(pretrained="", **checkpoint['model_options'])
        net = ops.switch_model_to_cuda(net, iscuda, checkpoint)
        net.load_state_dict(checkpoint['state_dict'])

        net.preprocess = checkpoint.get('preprocess', net.preprocess)
        if 'pca' in checkpoint:
            net.pca = checkpoint.get('pca')
            net.pca = net.pca['Landmarks_clean']

        self.net = net
        self.iscuda = iscuda
        self.whiten = {'whitenp': 0.25, 'whitenv': None, 'whitenm': 1.0}
        self.transforms = "Scale(1050, interpolation=Image.BICUBIC, largest=True)"

    def extract(self, image_paths):
        self.setup()  # lazy load model

        import torch
        import torch.nn.functional as F

        import dirtorch.datasets as datasets
        from dirtorch.utils import common as ops
        from dirtorch.test_dir import extract_image_features

        with tempfile.NamedTemporaryFile('w+') as tmp_list, torch.no_grad():
            # create temporary list file
            tmp_list.write('\n'.join(map(str, image_paths)) + '\n')
            tmp_list.seek(0)
            tmp_list_path = tmp_list.name

            # create dataset
            dataset_signature = f'ImageList("{tmp_list_path}")'
            dataset = datasets.create(dataset_signature)

            # extraction
            features = extract_image_features(dataset, self.transforms, self.net, iscuda=self.iscuda)

            # features = pool([features], 'gem', 3)   # pool (no-op with only one transform)
            features = F.normalize(features, p=2, dim=1)  # l2 normalization
            features = ops.tonumpy(features)  # to cpu
            features = ops.whiten_features(features, self.net.pca, **self.whiten)
            records = [{'feature_vector': f.tolist()} for f in features]
            return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract GeM features')
    GeMExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = GeMExtractor(args)
    extractor.run()