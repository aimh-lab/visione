FROM docker.io/pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime
RUN apt-get update && apt-get install -y git curl
RUN git clone https://github.com/facebookresearch/dinov2.git /usr/src/app
WORKDIR /usr/src/app
RUN ls 

RUN pip install -r  requirements.txt
RUN curl -O https://dl.fbaipublicfiles.com/dinov2/dinov2_vits14/dinov2_vits14_pretrain.pth

COPY extract.py .

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"