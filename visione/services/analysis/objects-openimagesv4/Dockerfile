FROM docker.io/tensorflow/tensorflow:2.7.0-gpu

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
ENV TF_CPP_MIN_LOG_LEVEL 2
ENV TFHUB_CACHE_DIR=/cache/tfhub_modules