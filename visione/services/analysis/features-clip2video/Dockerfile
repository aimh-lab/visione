FROM docker.io/continuumio/anaconda3:2022.10

WORKDIR /usr/src/app/

# Clone repo and pin to specific version
RUN git clone https://github.com/CryhanFang/CLIP2Video && \
    cd CLIP2Video && \
    git checkout e94131800a3a1434f6d00b89b7301d741db8ba06

# Install CLIP2Video dependencies
RUN pip install -r CLIP2Video/requirements.txt

# Install other dependencies
RUN pip install gdown more_itertools av flask==2.2.3
RUN conda install -c conda-forge ffmpeg

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
