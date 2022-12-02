FROM docker.io/tensorflow/tensorflow:2.7.0-gpu

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN pip install -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"