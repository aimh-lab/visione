# VISIONE: An Interactive Video Retrieval System

## Requirements
You need:
- Python >= 3.7
- a [Docker installation](https://docs.docker.com/engine/install/) with [Docker Compose](https://docs.docker.com/compose/install/) and [NVIDIA GPU support enabled](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html#docker)

You can test your installation with the following bash commands:
```bash
# these should print Docker and Compose versions
docker -v
docker compose version

# this should list your GPU(s)
docker run --gpus all --rm -it nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

The installation has been tested so far on Ubuntu 22.04 with
 - Python 3.10.6
 - Docker version: 23.0.1
 - Docker Compose version: v2.16.0
 - nvidia-container-toolkit version: 1.12.0~rc.5-1
 - GPU: 1x NVIDIA RTX 2080Ti, Driver Version: 515.86.01, CUDA Version: 11.7

## Installation
Ensure you have public key access to this repo, then run:
```bash
pip install git+ssh://git@github.com/aimh-lab/visione-rai.git
```
It might ask you to unlock the private key several times.

For a **development installation**, clone the repo and install via pip in editable mode:
```bash
pip install -e .
```

## Getting Started
```bash
# 1. Initialize a new empty collection
# This creates a new directory with the collection default configuration that can be edited.
visione init test-collection

# The following commands needs to be run in the collection directory.
cd test-collection

# 2. Import a video
# This command executes the following actions:
#  - copies/downloads the video file into the collection directory,
#  - creates reduced videos,
#  - performs scene detection with defaults parameters and extracts keyframes (one per scene), and
#  - creates keyframes thumbnails.
#
#  You need to specify a unique ID for each imported video.
#  After it is imported, a video is ready to be analyzed.
visione import --id bunny "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_2mb.mp4"

# You can try importing also another longer video by running also the following line:
visione import --id grand "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4"

# 3. Analyze video(s)
# This commands analyzes all the imported videos. You can analyze only specific videos by specifying --id <video_id>.
visione analyze

# 4. Add analyzed video(s) to the index
# This command adds the analyzed videos to the indices (Lucene & FAISS) and makes them available for search. You can index only specific videos by specifying --id <video_id>.
visione index

# 5. Start VISIONE!
# Starts all the frontend and backend services. You can access the web UI at http://localhost:8000/
visione serve
```

## Configuration

Configuration can be changed collection-wise.
Once you initialized a new collection with `visione init`, you can change the `config.yaml` inside the collection folder to customize settings.

## CLI Usage
See
```bash
visione -h
visione <cmd> -h
```
