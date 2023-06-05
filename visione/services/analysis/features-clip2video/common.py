import sys
import os
import torch
import random
import numpy as np

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

    return args, logger

def init_device(args, local_rank, logger):
    """Initialize device to determine CPU or GPU

     Args:
         args: the hyper-parameters
         local_rank: GPU id

     Returns:
         devices: cuda
         n_gpu: number of gpu

     """
    device = torch.device("cuda" if args.gpu and torch.cuda.is_available() else "cpu", local_rank)
    n_gpu = torch.cuda.device_count()
    logger.info("device: {} n_gpu: {}".format(device, n_gpu))
    args.n_gpu = n_gpu

    # if args.batch_size_val % args.n_gpu != 0:
    #     raise ValueError("Invalid batch_size/batch_size_val and n_gpu parameter: {}%{} and {}%{}, should be == 0".format(
    #         args.batch_size, args.n_gpu, args.batch_size_val, args.n_gpu))

    return device, n_gpu


def init_model(args, device, logger):
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