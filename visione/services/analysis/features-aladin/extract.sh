#!/bin/bash

#-------------- prepare some paths (do not touch unless you change installation directories) -------------- #

ROOT=/usr/src/app
SG_BENCHMARK_PATH=${ROOT}/scene_graph_benchmark
ALADIN_PATH=${ROOT}/ALADIN

#-------------- read command-line options -------------- #

FORCE=0
while getopts 'i:o:f' opt; do
  case "$opt" in
    i)
      IMG_PATH="$OPTARG"
      ;;

    o)
      OUT_H5_FILE="$OPTARG"
      ;;

    f)
      FORCE=1
      ;;
  esac
done
shift "$(($OPTIND -1))"
echo "Input: $IMG_PATH; Output: $OUT_H5_FILE"

# ------------------------ GO! ------------------------- #
IMG_LIST_FILE=$SG_BENCHMARK_PATH/image_list.txt
find $IMG_PATH -name '*.png' > $IMG_LIST_FILE

BATCH_SIZE=10000 # how many images we extract the feature of before running ALADIN and dumping to h5

TOTAL_FILES=$(wc -l < $IMG_LIST_FILE)
echo "Found ${TOTAL_FILES} images."

if [ -f "$OUT_H5_FILE" ] && [ $FORCE -eq 0 ]; then
    echo "File $OUT_H5_FILE already existing. Skipping..."
    continue
fi

#-------------- Run object detector to get visual features --------------#

cd $SG_BENCHMARK_PATH

PYTHONPATH=. conda run --no-capture-output -n sg_benchmark python extraction_service/test_sg_net.py \
--config-file sgg_configs/vgattr/vinvl_x152c4.yaml \
--img_folder $IMG_PATH \
--file_list_txt $IMG_LIST_FILE \
--from_idx 0 \
--to_idx $TOTAL_FILES \
TEST.IMS_PER_BATCH 4 \
MODEL.WEIGHT models/vinvl/vinvl_vg_x152c4.pth \
MODEL.ROI_HEADS.NMS_FILTER 1 \
MODEL.ROI_HEADS.SCORE_THRESH 0.2 \
DATA_DIR temp_tsv_folder \
TEST.IGNORE_BOX_REGRESSION True \
MODEL.ATTRIBUTE_ON True \
TEST.OUTPUT_FEATURE True \
DATASETS.LABELMAP_FILE models/vinvl/VG-SGG-dicts-vgoi6-clipped.json \
DATASETS.TEST "(\"train.yaml\", )"

#-------------- Extract ALADIN features (only if the previous extraction phase completed successfully) --------------#

if [ $? -ne 0 ]; then
    >&2 echo "Error during the run of object detection. Skipping ALADIN extraction."
    continue
fi

cd $ALADIN_PATH

#conda run --no-capture-output -n oscar python 
PYTHONPATH=. conda run --no-capture-output -n oscar python alad/extraction/extract_visual_features.py \
--img_feat_file ${SG_BENCHMARK_PATH}/output/X152C5_test/inference/vinvl_vg_x152c4/predictions.tsv \
--eval_model_dir checkpoint-0132780 \
--max_seq_length 50 \
--max_img_seq_length 34 \
--load_checkpoint weights/best_model_align_and_distill.pth.tar \
--features_h5 $OUT_H5_FILE