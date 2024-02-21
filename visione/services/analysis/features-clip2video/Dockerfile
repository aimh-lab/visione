FROM docker.io/pytorch/pytorch:1.13.0-cuda11.6-cudnn8-runtime

WORKDIR /usr/src/app/

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg git wget

# Clone repo and pin to specific version
RUN git clone https://github.com/CryhanFang/CLIP2Video && \
    cd CLIP2Video && \
    git checkout e94131800a3a1434f6d00b89b7301d741db8ba06

# Remove torch from original requirements.txt
RUN sed -i '/torch/d' CLIP2Video/requirements.txt
RUN pip install -r CLIP2Video/requirements.txt

# Install other dependencies
RUN pip install gdown more_itertools==10.2.0 av==11.0.0 h5py==3.10.0 flask==2.2.3 "Werkzeug>=2.2,<3.0"

# Download CLIP and CLIP2Video models
RUN mkdir -p checkpoint && \
    cd checkpoint && \
    gdown https://drive.google.com/uc?id=1bTOlOOqbZD0DOTJlCN74a2LktCurOjUg && \
    wget https://openaipublic.azureedge.net/clip/models/40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af/ViT-B-32.pt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
COPY . .

# Apply patch to run query service on CPU
RUN patch -p0 < modeling.patch

CMD ["python", "-u", "service.py"]
