FROM docker.io/pytorch/pytorch:1.7.1-cuda11.0-cudnn8-runtime

RUN conda install -y python=3.7 scikit-learn=0.20.2 -c pytorch

RUN pip install \
        flask-restful==0.3.9 \
        h5py==3.8.0 \
        more-itertools==9.1.0 \
        numpy==1.21.6 \
        opencv-python-headless==4.9.0.80 \
        tqdm

RUN apt update; apt install -y git unzip && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/naver/deep-image-retrieval.git /usr/src/app
WORKDIR /usr/src/app

RUN pip install gdown
RUN gdown -O Resnet-101-AP-GeM.pt 1UWJGDuHtzaQdFhSMojoYVQjmCXhIwVvy

RUN mv Resnet-101-AP-GeM.pt Resnet-101-AP-GeM.pt.zip && unzip Resnet-101-AP-GeM.pt.zip Resnet-101-AP-GeM.pt && rm Resnet-101-AP-GeM.pt.zip

COPY extract.py .
COPY service.py .

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"

CMD ["python", "-u", "service.py"]