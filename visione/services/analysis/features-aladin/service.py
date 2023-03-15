# import main Flask class and request object
import argparse
from flask import Flask, jsonify, request
from alad.extraction.image_retrieval import QueryEncoder
import os
import logging
import numpy as np
import requests

os.environ['CUDA_VISIBLE_DEVICES'] = ""

logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)

# create the query encoder object
args_str = '--eval_model_dir checkpoint-0132780 '+\
           '--max_seq_length 50 --max_img_seq_length 34 '+\
           '--load_checkpoint weights/best_model_align_and_distill.pth.tar'
qe = QueryEncoder(args_str)

@app.route('/get-text-feature', methods=['GET'])
def query_example():
    text = request.args.get("text")

    # first, produce the feature
    text_feature = qe.get_text_embedding(text)
    # text_feature = text_feature[np.newaxis, :]  # 1 x 1024  # TODO: is needed?

    out = jsonify(text_feature.tolist())
    return out

# deprecated, just for backward compatibility of 'core' service
@app.route('/aladin', methods=['GET'])
def extract_quant_from_text():
    text = request.args.get("text")
    logging.info(f'Received text: {text}')
    feature_vector = qe.get_text_embedding(text)
    logging.debug(f'Feature Vector: {feature_vector[:5]} ...')
    str_doc = requests.post('http://str-feature-encoder:4000/encode', json={
        'type': 'aladin',
        'feature_vector': feature_vector.tolist(),
    }).content

    str_doc = str_doc.decode('utf8')
    logging.debug(str_doc[:25] + " ...")

    return jsonify(str_doc)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Service for query feature extraction for ALADIN models.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5020', help="Port to use for binding")
    args = parser.parse_args()

    app.run(debug=False, host=args.host, port=args.port)