FROM docker.io/pytorch/pytorch:1.4-cuda10.1-cudnn7-runtime

RUN pip install \
        flask-restful \
        h5py \
        matplotlib \
        more-itertools \
        numpy \
        opencv-python \
        pymongo \
        scikit-learn==0.20.2 \
        tornado \
        tqdm

RUN git clone https://github.com/naver/deep-image-retrieval.git /usr/src/app
WORKDIR /usr/src/app

RUN pip install gdown
RUN gdown -O Resnet-101-AP-GeM.pt 1UWJGDuHtzaQdFhSMojoYVQjmCXhIwVvy

RUN apt update && apt install -y unzip && rm -rf /var/lib/apt/lists/*
RUN mv Resnet-101-AP-GeM.pt Resnet-101-AP-GeM.pt.zip && unzip Resnet-101-AP-GeM.pt.zip Resnet-101-AP-GeM.pt && rm Resnet-101-AP-GeM.pt.zip

COPY extract.py .

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"