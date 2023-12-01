FROM docker.io/pytorch/pytorch:1.13.0-cuda11.6-cudnn8-runtime

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN apt-get update && apt-get install -y git wget
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
ENV TRANSFORMERS_CACHE /cache/huggingface

# clone CLIPViP repo
RUN git clone https://github.com/mesnico/clip-vip_video_search
RUN mv clip-vip_video_search/clipvip .

# download weights
RUN wget "https://hdvila.blob.core.windows.net/dataset/pretrain_clipvip_base_16.pt?sp=r&st=2023-03-16T05:02:05Z&se=2026-07-31T13:02:05Z&spr=https&sv=2021-12-02&sr=b&sig=XNd7fZSsUhW7eesL3hTfYUMiAvCCN3Bys2TadXlWzFU%3D" -k -O "pretrain_clipvip_base_16.pt"

COPY . .
CMD ["python", "-u", "service.py"]