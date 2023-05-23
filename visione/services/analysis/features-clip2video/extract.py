import argparse
import os

# from .preprocessing import preprocess_shots
from pathlib import Path
from preprocessing import preprocess_shots

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
import h5py
import sys

from config import Config
from dataset import c2v_dataloader
from model import CLIP2VideoWrapped

# This is required to consider the CLIP2Video repo like a set of packages that we can import (e.g., modules, utils)
modules_path = os.path.dirname(os.path.abspath(__file__)) + '/CLIP2Video'
sys.path.insert(0, modules_path)

from utils.utils import get_logger

def set_seed_logger(args):
    """Initialize the seed and environment variable

    Args:
        args: the hyper-parameters.

    Returns:
        args: the hyper-parameters modified by the random seed.

    """

    global logger

    # predefining random initial seeds
    random.seed(args.seed)
    os.environ['PYTHONHASHSEED'] = str(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.manual_seed(args.seed)
    torch.cuda.manual_seed_all(args.seed)  # if you are using multi-GPU.
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = True

    # get logger
    logger = get_logger(args.output_dir)

    return args

def init_device(args, local_rank):
    """Initialize device to determine CPU or GPU

     Args:
         args: the hyper-parameters
         local_rank: GPU id

     Returns:
         devices: cuda
         n_gpu: number of gpu

     """
    global logger
    device = torch.device("cuda" if args.gpu and torch.cuda.is_available() else "cpu", local_rank)
    n_gpu = torch.cuda.device_count()
    logger.info("device: {} n_gpu: {}".format(device, n_gpu))
    args.n_gpu = n_gpu

    # if args.batch_size_val % args.n_gpu != 0:
    #     raise ValueError("Invalid batch_size/batch_size_val and n_gpu parameter: {}%{} and {}%{}, should be == 0".format(
    #         args.batch_size, args.n_gpu, args.batch_size_val, args.n_gpu))

    return device, n_gpu


def init_model(args, device):
    """Initialize model.

    if location of args.init_model exists, model will be initialized from the pretrained model.
    if no model exists, the training will be initialized from CLIP's parameters.

    Args:
        args: the hyper-parameters
        devices: cuda

    Returns:
        model: the initialized model

    """

    # resume model if pre-trained model exist.
    model_file = os.path.join(args.checkpoint, "pytorch_model.bin.{}".format(args.model_num))
    if os.path.exists(model_file):
        model_state_dict = torch.load(model_file, map_location='cpu')
        if args.local_rank == 0:
            logger.info("Model loaded from %s", model_file)
    else:
        model_state_dict = None
        if args.local_rank == 0:
            logger.info("Model loaded fail %s", model_file)

    # Prepare model
    model = CLIP2VideoWrapped.from_pretrained(args.cross_model, cache_dir=None, state_dict=model_state_dict,
                                       task_config=args)
    model.to(device)

    return model


def extract_video_features(model, test_dataloader, device, n_gpu, logger):
    """run similarity in one single gpu
    Args:
        model: CLIP2Video
        test_dataloader: data loader for test
        device: device to run model
        n_gpu: GPU number
        batch_sequence_output_list: batch text embedding
        batch_visual_output_list: batch visual embedding
    Returns:
        R1: rank 1 of text-to-video retrieval

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

            records = [{'feature_vector': f.tolist()} for f in visual_features.cpu().numpy()]
            return records


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

            # set the seed
            self.conf = set_seed_logger(self.conf)

            self.conf.gpu = args.gpu

            # setting the testing device
            self.device, self.n_gpu = init_device(self.conf, self.conf.local_rank)

            # init model
            self.model = init_model(self.conf, self.device)

            # print information for debugging
            # if self.conf.local_rank == 0:
            #     logger.info("***** Running test *****")
            #     logger.info("  Num examples = %d", test_length)
            #     logger.info("  Batch size = %d", self.conf.batch_size_val)
            #     logger.info("  Num steps = %d", len(self.test_dataloader))

    def extract(self, shot_paths_and_times):
        self.setup()  # lazy load model

        # preprocess shots using ffmpeg
        shot_paths = preprocess_shots(shot_paths_and_times, out_folder=self.temp_video_path)

        # init test dataloader
        dataloader, _ = c2v_dataloader(self.conf, shot_paths)

        # extract
        features = extract_video_features(
            self.model, 
            dataloader,
            self.device, 
            self.n_gpu, 
            logger
        )

        return features


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIP2VideoExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIP2VideoExtractor(args)
    extractor.run()