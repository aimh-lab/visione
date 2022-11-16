FROM docker.io/pytorch/pytorch:1.4-cuda10.1-cudnn7-runtime

RUN pip install \
        flask-restful \
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

COPY extract.py .
COPY common/ common/
