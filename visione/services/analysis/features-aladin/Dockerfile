FROM docker.io/condaforge/mambaforge:22.11.1-4

RUN apt-get update && apt-get install -y build-essential

#########################################################
# ----- Download and install scene graph detector ----- #
#########################################################

WORKDIR /usr/src/app/

RUN git clone https://github.com/mesnico/scene_graph_benchmark
WORKDIR /usr/src/app/scene_graph_benchmark

# fixes for newer torch
RUN sed -i -e 's|if torch._six.PY3:|if True:|' maskrcnn_benchmark/utils/imports.py
RUN sed -i -e 's|from torch.hub import _download_url_to_file|from torch.hub import download_url_to_file|' maskrcnn_benchmark/utils/model_zoo.py

RUN mamba create --name sg_benchmark python=3.7 -y && \
    mamba install -y -n sg_benchmark pytorch==1.12.1 torchvision==0.13.1 cudatoolkit=11.6 -c pytorch && \
    mamba install -y -n sg_benchmark h5py==3.7.0 nltk==3.8.1 joblib==1.3.2 scipy==1.7.3 && \
    mamba run --no-capture-output -n sg_benchmark pip install ninja==1.11.1.1 yacs>=0.1.8 cython==0.29.34 tqdm opencv-python-headless==4.9.0.80 numpy>=1.19.5 && \
    mamba install -y -n sg_benchmark timm==0.6.13 einops==0.6.1 && \
    mamba install -y -n sg_benchmark pycocotools==2.0.4 && \
    mamba run --no-capture-output -n sg_benchmark pip install cityscapesscripts==2.2.2 && \
    mamba run --no-capture-output -n sg_benchmark python setup.py build develop

RUN apt-get install -y curl

# Download weights and labelmaps
RUN --mount=type=secret,id=asset_token,required \
    mkdir -p models/vinvl && \
    cd models/vinvl && \
    curl -LJO -H "Authorization: token $(cat /run/secrets/asset_token | tr -d '\n')" -H "Accept:application/octet-stream" https://api.github.com/repos/aimh-lab/visione/releases/assets/112022853 && \
    test -f vinvl_vg_x152c4.pth && \
    curl -LJO -H "Authorization: token $(cat /run/secrets/asset_token | tr -d '\n')" -H "Accept:application/octet-stream" https://api.github.com/repos/aimh-lab/visione/releases/assets/112022837 && \
    test -f VG-SGG-dicts-vgoi6-clipped.json

###########################################
# ----- Download and install ALADIN ----- #
###########################################

WORKDIR /usr/src/app/

RUN git clone --recursive https://github.com/mesnico/ALADIN
WORKDIR /usr/src/app/ALADIN
RUN git checkout feature_extraction
RUN mamba create --name oscar python=3.8 && \
    mamba install -y -n oscar pytorch==1.12.1 torchvision==0.13.1 cudatoolkit=11.6 -c pytorch && \
    mamba run --no-capture-output -n oscar pip install -r requirements.txt && \
    mamba run --no-capture-output -n oscar pip install Flask==3.0.2 more_itertools==10.2.0 && \
    mamba run --no-capture-output -n oscar python setup.py build develop

# Download weights
RUN --mount=type=secret,id=asset_token,required \
    mkdir -p weights && \
    cd weights && \
    curl -LJO -H "Authorization: token $(cat /run/secrets/asset_token | tr -d '\n')" -H "Accept:application/octet-stream" https://api.github.com/repos/aimh-lab/visione/releases/assets/112022681 && \
    test -f best_model_align_and_distill.pth.tar

# Download OSCAR checkpoints
RUN --mount=type=secret,id=asset_token,required \
    curl -L \
    -H "Authorization: token $(cat /run/secrets/asset_token | tr -d '\n')" \
    -H "Accept:application/octet-stream" -o - https://api.github.com/repos/aimh-lab/visione/releases/assets/112024381 \
    | tar -xvJf -

# FIXME: use build-args to pass UID and GID to docker build to inject the host user id during image build
RUN chmod -R a+rw /usr/src/app/

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"

WORKDIR /usr/src/app/ALADIN
COPY extract.py .
COPY service.py ./alad

ENTRYPOINT ["mamba", "run", "--no-capture-output", "-n", "oscar"]
CMD ["mamba", "run", "--no-capture-output", "-n", "oscar", "python", "alad/service.py"]
