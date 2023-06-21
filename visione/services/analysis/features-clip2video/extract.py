import argparse
import os

# from .preprocessing import preprocess_shots
from pathlib import Path
from preprocessing import preprocess_shots
from common import init_device, init_model, set_seed_logger

# from visione.services.common.extractor import BaseVideoExtractor
from visione.extractor import BaseVideoExtractor

# loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
# for logger in loggers:
#     logger.setLevel(logging.WARNING)

import torch
import numpy as np
import os
import random
import tqdm
import sys

from config import Config
from dataset import c2v_dataloader

def extract_video_features(model, test_dataloader, device, n_gpu, logger):
    """
    Extract video features
    """

    if hasattr(model, 'module'):
        model = model.module.to(device)
    else:
        model = model.to(device)

    # if multi_sentence_ == True: compute the similarity with multi-sentences retrieval
    multi_sentence_ = False

    cut_off_points_, sentence_num_, video_num_ = [], -1, -1
    if hasattr(test_dataloader.dataset, 'multi_sentence_per_video') \
            and test_dataloader.dataset.multi_sentence_per_video:
        multi_sentence_ = True
        cut_off_points_ = test_dataloader.dataset.cut_off_points # used to tag the label when calculate the metric
        sentence_num_ = test_dataloader.dataset.sentence_num # used to cut the sentence representation
        video_num_ = test_dataloader.dataset.video_num # used to cut the video representation
        cut_off_points_ = [itm - 1 for itm in cut_off_points_]

    if multi_sentence_:
        logger.warning("Eval under the multi-sentence per video clip setting.")
        logger.warning("sentence num: {}, video num: {}".format(sentence_num_, video_num_))

    model.eval()

    with torch.no_grad():
        for bid, batch in enumerate(tqdm.tqdm(test_dataloader)):
            assert bid == 0 # if everything is ok, we only perform 1 dataloader iteration (batch_size == num videos to process)
            batch = tuple(t.to(device) if isinstance(t, torch.Tensor) else t for t in batch)
            video, video_mask, shot_ids, batch_id = batch

            batch_id, shot_ids = batch_id.tolist(), list(shot_ids)

            visual_output = model.get_visual_output(video, video_mask)
            visual_features = model.get_video_features(visual_output, video_mask)

            feats = visual_features.cpu()
            return feats


class CLIP2VideoExtractor(BaseVideoExtractor):

    @classmethod
    def add_arguments(cls, parser):
        # parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='hugging face handle of the CLIP model')
        super(CLIP2VideoExtractor, cls).add_arguments(parser)
        parser.add_argument('--temp_video_path', type=Path, default=Path("/data/temp-videos-for-video-extraction/"), help="Where to store pre-processed videos for features extraction")

    def __init__(self, args):
        super(CLIP2VideoExtractor, self).__init__(args)
        self.device = None
        self.model = None
        self.processor = None
        self.temp_video_path = args.temp_video_path

    def setup(self):
        if self.model is None:
            # obtain the hyper-parameter

            # create directory for temp videos
            self.temp_video_path.mkdir(exist_ok=True, parents=True)

            self.conf = Config(
                video_path=self.temp_video_path,
                checkpoint='checkpoint', # 'visione/services/analysis/features-clip2video/checkpoint',
                clip_path='checkpoint/ViT-B-32.pt' # 'visione/services/analysis/features-clip2video/checkpoint/ViT-B-32.pt'
            )

            # self.conf = Config(
            #     video_path=self.temp_video_path,
            #     checkpoint='visione/services/analysis/features-clip2video/checkpoint',
            #     clip_path='visione/services/analysis/features-clip2video/checkpoint/ViT-B-32.pt'
            # )

            # set the seed
            self.conf, self.logger = set_seed_logger(self.conf)

            self.conf.gpu = args.gpu

            # setting the testing device
            self.device, self.n_gpu = init_device(self.conf, self.conf.local_rank, self.logger)

            # init model
            self.model = init_model(self.conf, self.device, self.logger)

            # print information for debugging
            # if self.conf.local_rank == 0:
            #     logger.info("***** Running test *****")
            #     logger.info("  Num examples = %d", test_length)
            #     logger.info("  Batch size = %d", self.conf.batch_size_val)
            #     logger.info("  Num steps = %d", len(self.test_dataloader))

    def extract(self, shot_paths_and_times):
        self.setup()  # lazy load model

        # preprocess shots using ffmpeg and return their paths
        shot_paths, errors = preprocess_shots(shot_paths_and_times, out_folder=self.temp_video_path)

        # only process videos for which error is False
        valid_shot_paths = [shot_path for shot_path, error in zip(shot_paths, errors) if not error]
        valid_idxs = [idx for idx, error in enumerate(errors) if not error]

        # init test dataloader
        dataloader, _ = c2v_dataloader(self.conf, valid_shot_paths)

        # extract
        features = extract_video_features(
            self.model, 
            dataloader,
            self.device, 
            self.n_gpu, 
            self.logger
        )

        # FIXME: maybe there is a better way, but as of now features of corrupted videos are set to all zeros
        all_features = torch.zeros((len(shot_paths), features.shape[1]))
        # put valid features in the right place in all_features depending on valid_idxs
        all_features[valid_idxs] = features
        
        records = [{'feature_vector': f.tolist()} for f in all_features.cpu().numpy()]
        return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIP2VideoExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIP2VideoExtractor(args)
    extractor.run()