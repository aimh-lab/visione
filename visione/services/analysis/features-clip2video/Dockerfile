FROM docker.io/continuumio/anaconda3:2022.10

WORKDIR /usr/src/app/

RUN git clone --recursive https://github.com/CryhanFang/CLIP2Video

# Install CLIP2Video dependencies
RUN pip install -r CLIP2Video/requirements.txt

# Install other dependencies
RUN pip install gdown more_itertools av

# Download CLIP and CLIP2Video models
RUN mkdir -p checkpoint && \
    cd checkpoint && \
    gdown https://drive.google.com/uc?id=1bTOlOOqbZD0DOTJlCN74a2LktCurOjUg && \
    wget https://openaipublic.azureedge.net/clip/models/40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af/ViT-B-32.pt

COPY . .

CMD ["conda", "run", "--no-capture-output", "-n", "oscar", "python", "alad/service.py"]
