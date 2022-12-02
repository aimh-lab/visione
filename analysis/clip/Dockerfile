FROM docker.io/pytorch/pytorch:1.13.0-cuda11.6-cudnn8-runtime

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"