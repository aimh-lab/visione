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
args_str = '--eval_model_dir checkpoint-0132780 --max_seq_length 50 --max_img_seq_length 34 --load_checkpoint weights/best_model_align_and_distill.pth.tar'
qe = QueryEncoder(args_str)

@app.route('/get-text-feature', methods=['GET'])
def query_example():
    text = request.args.get("text")

    # first, produce the feature
    text_feature = qe.get_text_embedding(text)
    text_feature = text_feature[np.newaxis, :]  # 1 x 1024  # TODO: is needed?

    out = jsonify(text_feature.tolist())
    return out

# deprecated, kept for backward compatibility of 'core' service
@app.route('/text-to-image-search', methods=['GET'])
def text_to_image_search():
    text = request.args.get("text")
    k = request.args.get("k", type=int, default=10000)
    logging.info('Received text: {}'.format(text))
    text_feature = qe.get_text_embedding(text)

    response = requests.post('http://faiss-index-manager:4010/search', json={
        'type': 'aladin',
        'feature_vector': text_feature.tolist(),
        'k': k,
    }).content
    
    return response

# deprecated, kept for backward compatibility of 'core' service
@app.route('/internal-image-search', methods=['GET'])
def internal_image_search():
    img_id = request.args.get("imgId")
    k = request.args.get("k", type=int, default=10000)

    response = requests.post('http://faiss-index-manager:4010/search', json={
        'type': 'aladin',
        'query_id': img_id,
        'k': k,
    }).content

    return response

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Service for query feature extraction for ALADIN models.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='5020', help="Port to use for binding")
    args = parser.parse_args()

    app.run(debug=False, host=args.host, port=args.port)