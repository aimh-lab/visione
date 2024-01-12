import argparse
import sys
import logging
import os

from flask import Flask, request, jsonify
import requests
import torch
from common import init_device, init_model, set_seed_logger
from config import Config

# This is required to consider the CLIP2Video repo like a set of packages that we can import (e.g., modules, utils)
modules_path = os.path.dirname(os.path.abspath(__file__)) + '/CLIP2Video'
sys.path.insert(0, modules_path)

# disable GPU
os.environ['CUDA_VISIBLE_DEVICES'] = ""

from modules.tokenization_clip import SimpleTokenizer as ClipTokenizer

# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)


class CLIP2VideoTextEncoder:
    def __init__(self, args):
        args, self.logger = set_seed_logger(args)
        device, n_gpu = init_device(args, args.local_rank, self.logger)
        self.device = device

        # setting tokenizer
        self.tokenizer = ClipTokenizer()

        # start and end token
        self.SPECIAL_TOKEN = {"CLS_TOKEN": "<|startoftext|>", "SEP_TOKEN": "<|endoftext|>",
                              "MASK_TOKEN": "[MASK]", "UNK_TOKEN": "[UNK]", "PAD_TOKEN": "[PAD]"}

        self.max_words = args.max_words

        # init model
        self.model = init_model(args, device, self.logger)

    def encode_text(self, caption):
        """get tokenized word feature

        Args:
            caption: caption

        Returns:
            pairs_text: tokenized text
            pairs_mask: mask of tokenized text
            pairs_segment: type of tokenized text

        """

        # tokenize word
        words = self.tokenizer.tokenize(caption)

        # add cls token
        words = [self.SPECIAL_TOKEN["CLS_TOKEN"]] + words
        total_length_with_CLS = self.max_words - 1
        if len(words) > total_length_with_CLS:
            words = words[:total_length_with_CLS]

        # add end token
        words = words + [self.SPECIAL_TOKEN["SEP_TOKEN"]]

        # convert token to id according to the vocab
        input_ids = self.tokenizer.convert_tokens_to_ids(words)

        # add zeros for feature of the same length
        input_mask = [1] * len(input_ids)
        segment_ids = [0] * len(input_ids)
        while len(input_ids) < self.max_words:
            input_ids.append(0)
            input_mask.append(0)
            segment_ids.append(0)

        # ensure the length of feature to be equal with max words
        assert len(input_ids) == self.max_words
        assert len(input_mask) == self.max_words
        assert len(segment_ids) == self.max_words
        pairs_text = torch.LongTensor(input_ids)
        pairs_mask = torch.LongTensor(input_mask)
        pairs_segment = torch.LongTensor(segment_ids)

        return pairs_text, pairs_mask, pairs_segment

    def get_text_embedding(self, caption):
        input_ids, input_mask, segment_ids = self.encode_text(caption)

        input_ids, segment_ids, input_mask = input_ids.unsqueeze(0), segment_ids.unsqueeze(0), input_mask.unsqueeze(0)  # emulate bs = 1
        input_ids, segment_ids, input_mask = input_ids.to(self.device), segment_ids.to(self.device), input_mask.to(self.device)
        with torch.no_grad():
            sequence_output = self.model.get_sequence_output(input_ids, segment_ids, input_mask)

            text_feature = self.model.get_text_features(sequence_output, input_mask)
            text_feature = text_feature.squeeze(0).cpu().numpy()
        return text_feature

@app.route('/ping', methods=['GET'])
def ping():
    return "pong"

@app.route('/get-text-feature', methods=['GET'])
def get_text_features():
    text = request.args.get("text")
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text)
    out = jsonify(text_feature.tolist())
    return out

@app.route('/get-image-feature', methods=['GET', 'POST'])
def extract_image_feature():
    return "Not Implemented", 501

# deprecated, kept for backward compatibility of 'core' service
@app.route('/text-to-image-search', methods=['GET'])
def text_to_image_search():
    text = request.args.get("text")
    k = request.args.get("k", type=int, default=10000)
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text)

    response = requests.post('http://faiss-index-manager:8080/search', json={
        'type': 'clip2video',
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
        'type': 'clip2video',
        'query_id': img_id,
        'k': k,
    }).content

    return response


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Service for query feature extraction for CLIP models.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='8080', help="Port to use for binding")

    args = parser.parse_args()

    # init the query encoder
    config = Config(
        video_path=None,
        checkpoint='checkpoint', # 'visione/services/analysis/features-clip2video/checkpoint',
        clip_path='checkpoint/ViT-B-32.pt' # 'visione/services/analysis/features-clip2video/checkpoint/ViT-B-32.pt'
    )
    config.gpu = False

    # config = Config(
    #     video_path=None,
    #     checkpoint='visione/services/analysis/features-clip2video/checkpoint',
    #     clip_path='visione/services/analysis/features-clip2video/checkpoint/ViT-B-32.pt'
    # )

    qe = CLIP2VideoTextEncoder(config)

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)