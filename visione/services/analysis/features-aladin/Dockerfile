FROM docker.io/pytorch/pytorch:1.12.1-cuda11.3-cudnn8-runtime

RUN apt-get update && apt-get install -y build-essential git

#########################################################
# ----- Download and install scene graph detector ----- #
#########################################################

WORKDIR /usr/src/app/

RUN git clone https://github.com/mesnico/scene_graph_benchmark
WORKDIR /usr/src/app/scene_graph_benchmark

# Fixes for newer torch
RUN sed -i -e 's|if torch._six.PY3:|if True:|' maskrcnn_benchmark/utils/imports.py
RUN sed -i -e 's|from torch.hub import _download_url_to_file|from torch.hub import download_url_to_file|' maskrcnn_benchmark/utils/model_zoo.py

# Install dependencies (both scene graph and ALADIN)
RUN pip install h5py==3.7.0 nltk==3.8.1 joblib==1.3.2 scipy==1.7.3 \
                ninja==1.11.1.1 yacs>=0.1.8 cython==0.29.34 tqdm opencv-python-headless==4.9.0.80 numpy==1.21.2 \
                timm==0.6.13 einops==0.6.1 pycocotools cityscapesscripts==2.2.2 \
                pyyaml==6.0 requests==2.31.0 scikit-image==0.19.3 anytree==2.12.1 regex==2023.12.25 \
                Flask==2.2.5 more_itertools==9.1.0 boto3
# RUN python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
RUN python setup.py build develop

RUN apt-get install -y curl

# Download weights and labelmaps
RUN mkdir -p models/vinvl && \
    cd models/vinvl && \
    curl -LJO -H "Accept:application/octet-stream" https://github.com/aimh-lab/visione/releases/download/v0.5.1/vinvl_vg_x152c4.pth && \
    test -f vinvl_vg_x152c4.pth && \
    curl -LJO -H "Accept:application/octet-stream" https://github.com/aimh-lab/visione/releases/download/v0.5.1/VG-SGG-dicts-vgoi6-clipped.json && \
    test -f VG-SGG-dicts-vgoi6-clipped.json

###########################################
# ----- Download and install ALADIN ----- #
###########################################

WORKDIR /usr/src/app/

RUN git clone --recursive https://github.com/mesnico/ALADIN
WORKDIR /usr/src/app/ALADIN
RUN git checkout feature_extraction
RUN python setup.py build develop

# Download weights
RUN mkdir -p weights && \
    cd weights && \
    curl -LJO -H "Accept:application/octet-stream" https://github.com/aimh-lab/visione/releases/download/v0.5.1/best_model_align_and_distill.pth.tar && \
    test -f best_model_align_and_distill.pth.tar

# Download OSCAR checkpoints
RUN curl -L \
    -H "Accept:application/octet-stream" -o - https://github.com/aimh-lab/visione/releases/download/v0.5.1/checkpoint-0132780.tar.xz.arch \
    | tar -xvJf -

# FIXME: use build-args to pass UID and GID to docker build to inject the host user id during image build
RUN chmod -R a+rw /usr/src/app/

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"

WORKDIR /usr/src/app/ALADIN
COPY extract.py .
COPY service.py ./alad

CMD ["python", "alad/service.py"]
