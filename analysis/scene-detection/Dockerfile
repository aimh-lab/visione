FROM python:3.7

RUN apt update && apt install -y mkvtoolnix && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir av moviepy scenedetect[opencv-headless]

ENTRYPOINT [ "scenedetect" ]