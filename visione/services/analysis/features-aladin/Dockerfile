FROM docker.io/continuumio/anaconda3:2022.10

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

RUN conda create --name sg_benchmark python=3.7 -y && \
    conda install -n sg_benchmark pytorch==1.12.1 torchvision==0.13.1 cudatoolkit=11.6 -c pytorch -c conda-forge && \
    conda install -n sg_benchmark ipython h5py nltk joblib jupyter pandas scipy && \
    conda run --no-capture-output -n sg_benchmark pip install ninja yacs>=0.1.8 cython==0.29.34 matplotlib tqdm opencv-python-headless numpy>=1.19.5 && \
    conda install -n sg_benchmark -c conda-forge timm einops && \
    conda install -n sg_benchmark -c conda-forge pycocotools && \
    conda run --no-capture-output -n sg_benchmark python -m pip install cityscapesscripts && \
    conda run --no-capture-output -n sg_benchmark python setup.py build develop

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
RUN conda create --name oscar python=3.7 && \
    conda install -n oscar pytorch==1.12.1 torchvision==0.13.1 cudatoolkit=11.6 -c pytorch -c conda-forge && \
    conda run --no-capture-output -n oscar pip install -r requirements.txt && \
    conda run --no-capture-output -n oscar pip install Flask && \
    conda run --no-capture-output -n oscar python setup.py build develop

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

RUN pip install more_itertools
ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"

WORKDIR /usr/src/app/ALADIN
COPY extract.py .
COPY service.py ./alad

CMD ["conda", "run", "--no-capture-output", "-n", "oscar", "python", "alad/service.py"]
