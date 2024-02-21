FROM docker.io/pytorch/pytorch:1.13.0-cuda11.6-cudnn8-runtime

RUN apt-get update && \
    apt-get install -y build-essential wget git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -U openmim==0.3.7 && \
    mim install mmcv-full==1.7.1

RUN git clone https://github.com/open-mmlab/mmdetection.git /usr/src/mmdetection && \
    cd /usr/src/mmdetection && \
    git reset --hard e9cae2d0787cd5c2fc6165a6061f92fa09e48fb1 && \
    pip install -v -e .

# substitute cv2 with the headless version
RUN pip uninstall -y opencv-python && \
    pip install --no-cache-dir opencv-python-headless==4.9.0.80

# setuptool and yapf need a downgrade for mim commands to work
RUN pip install --upgrade setuptools==59.8.0 yapf==0.40.1

WORKDIR /usr/src/mmdetection/checkpoints

# download models
# VFNet
RUN mim download mmdet --config vfnet_x101_32x4d_fpn_mdconv_c3-c5_mstrain_2x_coco --dest . && \
    mim download mmdet --config vfnet_x101_64x4d_fpn_mdconv_c3-c5_mstrain_2x_coco --dest .
# MaskRCNN LVIS
RUN wget https://download.openmmlab.com/mmdetection/v2.0/lvis/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1-43d9edfe.pth

# app requirements
RUN pip install \
        h5py==3.10.0 \
        more_itertools==10.2.0

WORKDIR /usr/src/app/

COPY extract.py .

ENV PYTHONPATH "${PYTHONPATH}:/usr/src/"
ENV MPLCONFIGDIR /tmp

#  MaskRCNN LVIS
# RUN wget https://raw.githubusercontent.com/open-mmlab/mmdetection/master/configs/lvis/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1.py && \
#     wget https://download.openmmlab.com/mmdetection/v2.0/lvis/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1/mask_rcnn_x101_64x4d_fpn_sample1e-3_mstrain_1x_lvis_v1-43d9edfe.pth
