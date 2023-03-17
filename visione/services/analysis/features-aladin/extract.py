import argparse
import os
import subprocess
import tempfile

import h5py

from visione.extractor import BaseExtractor


class AladinExtractor(BaseExtractor):

    def extract(self, image_paths):
        with tempfile.TemporaryDirectory() as temp_dir:
            # 1. write image list
            image_list_path = os.path.join(temp_dir, 'image_list.txt')
            with open(image_list_path, 'w') as image_list:
                for image_path in image_paths:
                    image_list.write(f"{image_path}\n")

            # 2. Run object detector to get visual features
            command = [
                'conda', 'run', '--no-capture-output', '-n', 'sg_benchmark',
                'python', 'extraction_service/test_sg_net.py',
                '--config-file', 'sgg_configs/vgattr/vinvl_x152c4.yaml',
                '--img_folder', '/',
                '--file_list_txt', image_list_path,
                '--from_idx', '0', '--to_idx', str(len(image_paths)),
                'TEST.IMS_PER_BATCH', '4',
                'MODEL.WEIGHT', 'models/vinvl/vinvl_vg_x152c4.pth',
                'MODEL.ROI_HEADS.NMS_FILTER', '1',
                'MODEL.ROI_HEADS.SCORE_THRESH', '0.2',
                'DATA_DIR', 'temp_tsv_folder',
                'TEST.IGNORE_BOX_REGRESSION', 'True',
                'MODEL.ATTRIBUTE_ON', 'True',
                'TEST.OUTPUT_FEATURE', 'True',
                'DATASETS.LABELMAP_FILE', 'models/vinvl/VG-SGG-dicts-vgoi6-clipped.json',
                'DATASETS.TEST', '("train.yaml", )',
            ]

            sg_benchmark_path = "/usr/src/app/scene_graph_benchmark"
            ret = subprocess.run(command, cwd=sg_benchmark_path, check=True, env={**os.environ, 'PYTHONPATH': '.'})

            # 3. Extract ALADIN features
            out_h5_file = os.path.join(temp_dir, 'out.h5')
            command = [
                'conda', 'run', '--no-capture-output', '-n', 'oscar',
                'python', 'alad/extraction/extract_visual_features.py',
                '--img_feat_file', f'{sg_benchmark_path}/output/X152C5_test/inference/vinvl_vg_x152c4/predictions.tsv',
                '--eval_model_dir', 'checkpoint-0132780',
                '--max_seq_length', '50',
                '--max_img_seq_length', '34',
                '--load_checkpoint', 'weights/best_model_align_and_distill.pth.tar',
                '--features_h5', out_h5_file,
            ]

            aladin_path = "/usr/src/app/ALADIN"
            ret = subprocess.run(command, cwd=aladin_path, check=True, env={**os.environ, 'PYTHONPATH': '.'})

            # 4. return records
            with h5py.File(out_h5_file, 'r') as f:
                image_features = f['features']
                records = [{'feature_vector': f.tolist()} for f in image_features]
                return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract ALADIN features')
    AladinExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = AladinExtractor(args)
    extractor.run()