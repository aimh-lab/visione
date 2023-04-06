FROM docker.io/continuumio/anaconda3:2022.10

RUN apt-get update && apt-get install -y build-essential

#########################################################
# ----- Download and install scene graph detector ----- #
#########################################################

WORKDIR /usr/src/app/

RUN git clone https://github.com/mesnico/scene_graph_benchmark
WORKDIR /usr/src/app/scene_graph_benchmark
RUN conda env create -f environment.yml && \
    conda run --no-capture-output -n sg_benchmark python setup.py build develop

# Download weights and labelmaps
RUN mkdir -p models/vinvl && \
    wget -P models/vinvl https://penzhanwu2.blob.core.windows.net/sgg/sgg_benchmark/vinvl_model_zoo/vinvl_vg_x152c4.pth && \
    wget -P models/vinvl https://penzhanwu2.blob.core.windows.net/sgg/sgg_benchmark/vinvl_model_zoo/VG-SGG-dicts-vgoi6-clipped.json

###########################################
# ----- Download and install ALADIN ----- #
###########################################

WORKDIR /usr/src/app/

RUN git clone --recursive https://github.com/mesnico/ALADIN
WORKDIR /usr/src/app/ALADIN
RUN git checkout feature_extraction
RUN conda create --name oscar python=3.7 && \
    conda install -n oscar pytorch==1.2.0 torchvision==0.4.0 cudatoolkit=10.0 -c pytorch && \
    conda run --no-capture-output -n oscar pip install -r requirements.txt && \
    conda run --no-capture-output -n oscar pip install Flask && \
    conda run --no-capture-output -n oscar python setup.py build develop

# Download weights
RUN conda run pip install gdown
RUN mkdir -p weights && \
    cd weights && \
    gdown https://drive.google.com/uc?id=1PQvzOyuzDPgs9NO8rWkzzKFVE8ENnH93

# Download OSCAR checkpoints
RUN wget https://azcopyvnext.azureedge.net/release20230123/azcopy_linux_amd64_10.17.0.tar.gz && \
    tar -xvf azcopy_linux_amd64_10.17.0.tar.gz && \
    mv azcopy_linux_amd64_10.17.0/azcopy .
RUN ./azcopy copy 'https://biglmdiag.blob.core.windows.net/vinvl/model_ckpts/coco_ir/base/checkpoint-0132780/' . --recursive

# FIXME: use build-args to pass UID and GID to docker build to inject the host user id during image build
RUN chmod -R a+rw /usr/src/app/

RUN pip install more_itertools
ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"

WORKDIR /usr/src/app/ALADIN
COPY extract.py .
COPY service.py ./alad

CMD ["conda", "run", "--no-capture-output", "-n", "oscar", "python", "alad/service.py"]
