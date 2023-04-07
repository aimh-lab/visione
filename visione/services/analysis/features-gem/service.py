import argparse
import logging
import os
import urllib.request
import tempfile

from flask import Flask, request, jsonify
import requests
import torch
import torch.nn.functional as F

os.environ['DB_ROOT'] = ''
import dirtorch.datasets as datasets
import dirtorch.nets as nets
from dirtorch.utils import common as ops
from dirtorch.test_dir import extract_image_features

# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)


class GeMExtractor(object):
    def __init__(self, gpu=True):
        gpus = [0] if gpu else [-1]

        iscuda = ops.torch_set_gpu(gpus)
        checkpoint = ops.load_checkpoint('./Resnet-101-AP-GeM.pt', iscuda)

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

    def extract_from_url(self, image_url):
        image_path, _ = urllib.request.urlretrieve(image_url)
        features = self.extract_from_path(image_path)
        urllib.request.urlcleanup()
        return features

    def extract_from_path(self, image_path):
        with tempfile.NamedTemporaryFile('w+') as tmp_list:
            # create temporary list file
            tmp_list.write(image_path + '\n')
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
            return features


@app.route('/extract', methods=['GET'])
def extract_from_url():
    url = request.args.get("url")
    logging.info(f'Received URL: {url}')
    feature = extractor.extract_from_url(url).squeeze()
    out = jsonify(feature.tolist())
    return out


@app.route('/extract', methods=['POST'])
def extract_from_image():
    uploaded_file = request.files['image']

    with tempfile.NamedTemporaryFile() as tmp_image_path:
        uploaded_file.save(tmp_image_path)
        features = extractor.extract_from_path(tmp_image_path)
        return jsonify(features.tolist())

# deprecated, just for backward compatibility of 'core' service
@app.route('/gem', methods=['GET'])
def extract_quant_from_url():
    url = request.args.get("url")
    logging.info(f'Received URL: {url}')
    feature_vector = extractor.extract_from_url(url).squeeze()
    logging.debug(f'Feature Vector: {feature_vector[:5]} ...')
    str_doc = requests.post('http://str-feature-encoder:4000/encode', json={
        'type': 'gem',
        'feature_vector': feature_vector.tolist(),
    }).content

    str_doc = str_doc.decode('utf8')
    logging.debug(str_doc[:25] + " ...")

    return jsonify(str_doc)

# deprecated, just for backward compatibility of 'core' service
@app.route('/quant', methods=['POST'])
def extract_quant_from_image():
    uploaded_file = request.files['image']

    with tempfile.NamedTemporaryFile() as tmp_image_path:
        uploaded_file.save(tmp_image_path)
        feature_vector = extractor.extract_from_path(tmp_image_path)

        str_doc = requests.post('http://str-feature-encoder:4000/encode', json={
            'type': 'gem',
            'feature_vector': feature_vector.tolist(),
        }).content

        str_doc = str_doc.decode('utf8')

        return jsonify(str_doc)


if __name__ == '__main__':
    default_gpu = torch.cuda.is_available() and torch.cuda.device_count() > 0
    parser = argparse.ArgumentParser(description='Create a webservice for CLIP model for t2i and i2i searches.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5090', help="Port to use for binding")
    parser.add_argument('--gpu', action='store_true', default=default_gpu, help='Whether to use GPU')

    args = parser.parse_args()

    # initialize feature extractor
    extractor = GeMExtractor(gpu=args.gpu)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)