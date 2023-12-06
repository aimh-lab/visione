FROM docker.io/pytorch/pytorch:1.13.0-cuda11.6-cudnn8-runtime

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
ENV TRANSFORMERS_CACHE /cache/huggingface

COPY . .
CMD ["python", "-u", "service.py"]