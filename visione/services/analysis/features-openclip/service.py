import argparse
import logging
import os

from flask import Flask, request, jsonify
import requests
import torch
from torch.nn import functional as F
import open_clip


# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)


class OpenCLIPTextEncoder():
    def __init__(self, model_handle):
        device = 'cpu'
        self.model, _, _ = open_clip.create_model_and_transforms(model_handle)
        self.tokenizer = open_clip.get_tokenizer(model_handle)

    def get_text_embedding(self, text, normalized=False):
        with torch.no_grad():
            inputs = self.tokenizer(text, context_length=256)
            text_features = self.model.encode_text(inputs)
            if normalized:
                text_features = F.normalize(text_features, dim=-1)
            text_features = text_features.numpy().squeeze()
        return text_features

@app.route('/ping', methods=['GET'])
def ping():
    return "pong"

@app.route('/get-text-feature', methods=['GET'])
def get_text_features():
    text = request.args.get("text")
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text, normalized=args.normalized)
    out = jsonify(text_feature.tolist())
    return out

@app.route('/get-image-feature', methods=['GET'])
def extract_image_feature_by_url():
    # url = request.args.get("url")
    return "Not Implemented", 501

@app.route('/get-image-feature', methods=['POST'])
def extract_image_feature_by_file():
    # file = request.files['file']
    return "Not Implemented", 501

# deprecated, kept for backward compatibility of 'core' service
@app.route('/text-to-image-search', methods=['GET'])
def text_to_image_search():
    text = request.args.get("text")
    k = request.args.get("k", type=int, default=10000)
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text, normalized=args.normalized)

    response = requests.post('http://faiss-index-manager:8080/search', json={
        'type': features_name,
        'feature_vector': text_feature.tolist(),
        'k': k,
    }).content

    return response

# deprecated, kept for backward compatibility of 'core' service
@app.route('/internal-image-search', methods=['GET'])
def internal_image_search():
    img_id = request.args.get("imgId")
    k = request.args.get("k", type=int, default=10000)

    response = requests.post('http://faiss-index-manager:8080/search', json={
        'type': features_name,
        'query_id': img_id,
        'k': k,
    }).content

    return response


if __name__ == '__main__':
    default_model_handle = os.environ['MODEL_HANDLE']
    features_name = os.environ['FEATURES_NAME']

    parser = argparse.ArgumentParser(description='Service for query feature extraction for Open CLIP models.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='8080', help="Port to use for binding")
    parser.add_argument('--model-handle', default=default_model_handle, help='hugging face handle of the Open CLIP model')
    parser.add_argument('--no-normalized', action='store_false', dest='normalized', default=True, help='Whether to normalize features or not')

    args = parser.parse_args()

    # init the query encoder
    qe = OpenCLIPTextEncoder(args.model_handle)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)