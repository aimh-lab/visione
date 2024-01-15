FROM docker.io/pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime


RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN cd /usr/src && \
    git clone https://github.com/facebookresearch/dinov2 && \
    cd /usr/src/dinov2 && \
    git checkout c3c2683a13cde94d4d99f523cf4170384b00c34c && \
    pip install -r requirements.txt

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
ENV TORCH_HOME /cache/torch

COPY . .
CMD ["python", "-u", "service.py"]