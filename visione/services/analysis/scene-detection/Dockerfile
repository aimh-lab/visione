FROM python:3.7

RUN apt update && apt install -y mkvtoolnix && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    av==10.0.0 \
    moviepy==1.0.3 \
    pandas==1.3.5 \
    scenedetect[opencv-headless]==0.6.2

ADD . /usr/src/app

CMD ["scenedetect"]