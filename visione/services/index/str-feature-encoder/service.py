import argparse
import logging
import os

from flask import Flask, request
import numpy as np
import surrogate

# setup logging
logging.basicConfig(level=logging.DEBUG)

# create the Flask app
app = Flask(__name__)

loaded_encoders = {}


def load_encoder(feature_type):
    if feature_type in loaded_encoders:
        return loaded_encoders[feature_type]

    encoder = None
    encoder_path = f'/data/str-features-encoder-{feature_type}.pkl'
    if os.path.exists(encoder_path):
        encoder = surrogate.load_index(encoder_path)
        loaded_encoders[feature_type] = encoder

    return encoder


@app.route('/encode', methods=['POST'])
def features():
    data = request.get_json()

    if 'type' not in data:
        return "Missing 'type' key in request.", 400  # BAD_REQUEST
    if 'feature_vector' not in data:
        return "Missing 'feature_vector' key in request.", 400  # BAD_REQUEST

    feature_type = data['type']
    feature_vector = data['feature_vector']
    feature_vector = np.atleast_2d(feature_vector)

    encoder = load_encoder(feature_type)
    if encoder is None:
        return f"No encoder found for '{feature_type}' features.", 400  # BAD_REQUEST

    tf = encoder.encode(feature_vector, inverted=False, query=True)
    str_doc = surrogate.generate_documents(tf, compact=True, delimiter='^')
    str_doc = next(iter(str_doc))

    return str_doc


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create a webservice for CLIP model for t2i and i2i searches.')

    parser.add_argument('--host', default='0.0.0.0', help="IP address to use for binding")
    parser.add_argument('--port', default='8080', help="Port to use for binding")
    args = parser.parse_args()

    # run the flask app
    app.run(debug=False, host=args.host, port=args.port)