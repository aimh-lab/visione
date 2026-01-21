# <img src="https://github.com/aimh-lab/visione/assets/7997320/3a205e82-3e8e-41e6-bcbd-6c552209c32f" alt="VISIONE" height="32" valign="-10%"> -  An Interactive Video Retrieval System

> :sparkles: Check out our demo at [https://visione.isti.cnr.it](https://visione.isti.cnr.it)! :sparkles:

> :movie_camera: Check out our [video teaser](https://www.youtube.com/watch?v=aXGfBaNTQVQ)! :movie_camera:

<video src="https://github.com/aimh-lab/visione/assets/7997320/127cced3-63b0-421c-819a-67b1cdcff742"></video>


## Features
- :dizzy: **Interactive** video search via Web UI
- :speech_balloon: **Multilingual** text-to-video retrieval (search by text)
- :framed_picture: **Visual** similarity search (search by image)
- :clock1: **Temporal** queries (first this, then that)
- :mag_right: **Objects** and **color** presence, count, and positional queries (search by object)
- :video_camera: Video and keyframe **browsing** (with video playback)
- :rocket: **Dockerized** and **GPU-enabled** video analysis


## Citation
We kindly ask you to refer to the following paper in publications mentioning or employing VISIONE
```
@inproceedings{amato2024visione,
  title={VISIONE 5.0: Enhanced User Interface and AI Models for VBS2024},
  author={Amato, Giuseppe and Bolettieri, Paolo and Carrara, Fabio and Falchi, Fabrizio
          and Gennaro, Claudio and Messina, Nicola and Vadicamo, Lucia and Vairo, Claudio},
  booktitle={International Conference on Multimedia Modeling},
  pages={332--339},
  year={2024},
  organization={Springer}
}
```
## Requirements
You need:
- Python >= 3.7
- pip >= 21.3
- a [Docker installation](https://docs.docker.com/engine/install/) with [Docker Compose](https://docs.docker.com/compose/install/) and [NVIDIA GPU support enabled](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html#docker)

You can test your installation with the following bash commands:
```bash
# these should print Docker and Compose versions
docker -v
docker compose version

# this should list your GPU(s)
docker run --gpus all --rm -it nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

The installation has been tested so far with:
 - Ubuntu 22.04
 - Python 3.10.6
 - Docker version: 23.0.1
 - Docker Compose version: v2.16.0
 - nvidia-container-toolkit version: 1.12.0~rc.5-1
 - GPU: 1x NVIDIA RTX 2080Ti, Driver Version: 515.86.01, CUDA Version: 11.7


## Installation (from source)
```bash
pip install git+https://github.com/aimh-lab/visione.git
```
This should install the `visione` executable. Be sure the folder where pip installs binaries is in your `PATH` environment variable.


## Getting Started
To start VISIONE, five main steps, described in the following sections, must be followed in sequence:
1)	Initialize the collection (`visione init [options]`)
2)	Import videos (`visione import [options]`)
3)	Analyze videos (`visione analyze [options]`)
4)	Index the analyzed videos (`visione index [options]`)
5)	Start the VISIONE system (`visione serve [options]`)

### 1. Initialize a new empty collection
The `visione init` command creates a new directory with a default configuration.
All subsequent commands should be run from within the collection directory.
```bash
visione init test-collection
cd test-collection
```
Please check and eventually change the default configuration by editing the file [`config.yaml`](visione/skel/config.yaml) file, e.g., to select the analyses to perform on the videos and how to index them.
Once you are done, you can import videos to the collection.

> **Note**: The first time you run other subcommands other than `init`, it will take a while to download and build the necessary Docker images. Subsequent runs will be faster.

### 2. Import videos

You can import videos in the collection with the `visione import` command providing a local path or URL.
You can specify a unique ID for each imported video with the `--id` flag; if not provided, the video filename without extension is used as the ID.

For example, these commands import two sample videos from the web:
```bash
visione import --id bunny "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_2mb.mp4"

# a longer video
visione import --id grand "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4"
```

The `import` subcommand executes the following actions:
 - copies/downloads the video file into `videos/<video_id>.<ext>` in the collection directory,
 - creates reduced videos in `reduced-videos/`,
 - performs scene detection and extracts keyframes (one per scene) in `selected-frames/`, and
 - creates keyframes thumbnails in `thumbnails/`.

You can skip any of the importing steps by manually putting the needed files in the appropriate folders and run `visione import` with flags, e.g., `--no-copy`, `--no-thumbs`, etc.
For example, you can manually place/mount video files in the `videos/` collection folder and import them by providing their path in the `videos/` folder and the `--no-copy` flag:
```bash
# for importing a single file
visione import --id bunny --no-copy videos/bunny.mp4 
visione import --id grand --no-copy videos/grand.mov

# for bulk import of all the videos in the test-collection/videos folder
visione import --no-copy --bulk
```

Similarly, you can provide pre-detected scenes and pre-extracted keyframes in the `selected-frames/` folder and import them with the `--no-scenes` and `--no-frames` flags.

See `visione import -h` for more options.

After videos are imported, they are ready to be analyzed.

### 3. Analyze videos
The `visione analyze` command runs analyses on the imported videos.
Without additional arguments, it performs all analyses specified in the configuration file [`config.yaml`](visione/skel/config.yaml) on all the imported videos.
```bash
visione analyze
```
> :warning: **Note**: Analysis may take a long time depending on the number and length of the videos and the selected analyses.

You can analyze only specific videos by specifying `--id <video_id>`.
```bash
visione analyze --id bunny
```

To select the analyses to perform, please refer to the documentation in the [`config.yaml`](visione/skel/config.yaml) file.


### 4. Add analyzed videos to the index
The `visione index` command adds the analyzed videos to the indices (Lucene & FAISS) and makes them available for search. By default, this subcommand indexes all the analyzed videos.
```bash
visione index
```
You can index specific videos only by specifying --id <video_id>.
```bash
visione index --id bunny
```

### 5. Start VISIONE!
Once the videos are indexed, you can start the VISIONE web UI with the `visione serve` command. This is a wrapper around `docker compose up` that starts all the frontend and backend services needed to perform interactive searches.
```bash
visione serve
```
By default, you can access the web UI at http://localhost:8000/.
You can change the bind address and port in the [`config.yaml`](visione/skel/config.yaml) file.


## Useful Tips

### CLI Usage
For more information on how to use the CLI, you can run
```bash
visione -h
visione <cmd> -h
```
to get help on the available commands and their options.

### Troubleshooting
VISIONE is still in development and may not work as expected in all cases.
Every subcommand has a `--verbose` flag that prints more detailed information about the execution, e.g.:
```bash
visione --verbose import ...
visione --verbose analyze ...
```
This can be useful to understand what is happening under the hood.
If you encounter any issues during the installation or usage of VISIONE, please open an issue on the GitHub repository.

### Development
For a **development installation**, clone the repo and install via pip in editable mode:
```bash
pip install -e .
```
Then, set `develop_mode: true` in the `config.yaml` inside the collection directory.
This will mount the local VISIONE source code inside the Docker containers, so you can modify the code used by services without rebuilding the images.
 - For changes to the frontend code, you can simply refresh the web page to apply the changes.
   - `visione/services/web-ui`
 - For Python services, you can simply restart the services to apply the changes. This includes changes to:
   - `visione/cli`
   - `visione/services/analysis`
   - `visione/services/common`
   - `visione/services/index` (except for `lucene-index-manager`)
   - `visione/services/router`
 - For Java services, you need to rebuild the services to apply the changes. This includes changes to:
   - `visione/services/core`
   - `visione/services/index/lucene-index-manager`

Changes to the configuration file often require rebuilding and/or restarting the services. You can do this with the `visione compose` subcommand, which provides a wrapper around `docker compose`:
```bash
# completely stop, rebuild, and restart all services:
visione compose down  # stop all services
visione compose build  # rebuild all services
visione serve  # start all services (`serve` is a wrapper around `docker compose up` that injects the correct environment variables and configuration)

# or, to restart a single service, e.g.:
visione compose restart features-clip2video router  # restart the clip2video and router services
visione compose build core  # rebuild only the core service
visione compose up -d core  # restart the core service with the newly built image
```

## Need Help or Have Feedback? 
We encourage you to [open a discussion](https://github.com/aimh-lab/visione/discussions) to request assistance with using this project, make suggestions, or report any issues. 
