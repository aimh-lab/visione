import argparse
import itertools
import os
import subprocess
import sys
from pathlib import Path

import more_itertools
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as T
from torch.utils.data import DataLoader

from common import init_device, init_model, set_seed_logger
from config import Config
from visione.extractor import BaseVideoExtractor


def load_shot(
    shot_info,
    *,
    pad_shot_to_seconds=0.0,
    fps=5,
    max_frames=100,
    sample_framerate=2,
    size=224,
    transform=None,
    ffmpeg_threads=2,
):
    video = torch.empty(1, max_frames, 3, size, size)
    video_mask = torch.zeros(1, max_frames, dtype=torch.long)

    video_id, shot_id, video_path, start_frame, start_time, end_frame, end_time = shot_info

    duration = end_time - start_time

    if duration == 0 or (end_frame - start_frame) <= 1:
        # FIXME: to handle videos having 0s duration, we expand the duration to 0.5 second. Pretty hacky.
        start_time = max(0, start_time - 0.5 / 2)
        end_time = start_time + 0.5
        duration = end_time - start_time

    if duration < pad_shot_to_seconds:
        pad = (pad_shot_to_seconds - duration) / 2
        start_time = max(0, start_time - pad)
        end_time = start_time + pad_shot_to_seconds  # FIXME: this could overshoot the end of the video
        duration = pad_shot_to_seconds

    cmd = [
        'ffmpeg',
        '-y',
        '-hide_banner',
        '-loglevel', 'fatal',
        '-threads', f'{ffmpeg_threads}',
        '-ss', f'{start_time:.2f}',
        '-i', video_path,
        '-t', f'{duration:.2f}',
        '-r', f'{fps}',
        '-q', '0',
        '-vf', f'scale=320x240',
        '-pix_fmt', 'rgb24',
        '-f', 'rawvideo',
        'pipe:',
    ]

    ffmpeg = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    video, _ = ffmpeg.communicate()
    if ffmpeg.returncode != 0:
        print("Error in processing video {}, shot {}".format(video_path, shot_id), file=sys.stderr)
        return video, video_mask, shot_id, item_id
    try:
        video = torch.frombuffer(video, dtype=torch.uint8).reshape(-1, 240, 320, 3).detach().clone()
    except:
        print("Error in processing video {}, shot {}".format(video_path, shot_id), file=sys.stderr)
        print(f"{video_id} {shot_id} {video_path} {start_frame} {start_time} {end_frame} {end_time}", file=sys.stderr)
        raise

    video = video.permute(0, 3, 1, 2)  # T x 3 x H x W
    video = video[::sample_framerate, ...]
    video = video / 255.0  # convert to [0, 1]

    if transform:
        video = transform(video)

    video_len = video.shape[0]
    if video_len > max_frames:
        idx = np.linspace(0, video_len - 1, num=max_frames, dtype=int)
        video = video[idx, ...]
        video_len = max_frames
    else:
        pad = torch.zeros(max_frames - video_len, 3, size, size)
        video = torch.cat((video, pad), dim=0)

    # video is (T, 3, H, W)
    video = video.unsqueeze(1)  # T x 1 x 3 x H x W
    video = video.unsqueeze(0)  # 1 x T x 1 x 3 x H x W
    video_mask[0, :video_len] = 1

    return video, video_mask, shot_id


class C2VDataset(torch.utils.data.Dataset):
    def __init__(self, shot_infos, **kwargs):
        self.shot_infos = shot_infos
        self.kwargs = kwargs

    def __len__(self):
        return len(self.shot_infos)

    def __getitem__(self, item_id):
        return load_shot(self.shot_infos[item_id], **self.kwargs)


class C2VIterableDataset(torch.utils.data.IterableDataset):
    def __init__(self, iterable, *, batch_size=1, **kwargs):
        self.iterable = iterable
        self.batch_size = batch_size
        self.kwargs = kwargs

    def process(self, batch):
        batch = [load_shot(item, **self.kwargs) for item in batch]
        return batch

    def __iter__(self):
        # chunk by batch size
        itr = more_itertools.chunked(self.iterable, self.batch_size)

        worker_info = torch.utils.data.get_worker_info()
        if worker_info:
            worker_id = worker_info.id
            num_workers = worker_info.num_workers

            # skip batches for other workers
            itr = itertools.islice(itr, worker_id, None, num_workers)

        itr = map(self.process, itr)
        itr = itertools.chain.from_iterable(itr)
        return itr


class CLIP2VideoExtractor(BaseVideoExtractor):

    @classmethod
    def add_arguments(cls, parser):
        # parser.add_argument('--model-handle', default=os.environ['MODEL_HANDLE'], help='hugging face handle of the CLIP model')
        super(CLIP2VideoExtractor, cls).add_arguments(parser)
        parser.add_argument('--pad-shot-to', type=float, default=0.0, help="Pad shots shorter than this duration (in seconds) before extracting features")
        parser.add_argument('--shot-fps', type=float, default=5, help="FPS to use when extracting shots from videos")
        parser.add_argument('--input-size', type=int, default=224, help="Size of the input images to the model")
        parser.add_argument('--batch-size', type=int, default=1, help="Batch size")
        parser.add_argument('--num-workers', type=int, default=0, help="Number of workers for data loading")
        parser.add_argument('--ffmpeg-threads', type=int, default=2, help="Number of threads to use for each ffmpeg worker")

    def __init__(self, args):
        super(CLIP2VideoExtractor, self).__init__(args)
        self.device = None
        self.model = None

        # obtain the hyper-parameter, set the seed and device
        self.conf = Config(checkpoint='checkpoint', clip_path='checkpoint/ViT-B-32.pt')
        self.conf, self.logger = set_seed_logger(self.conf)
        self.conf.gpu = args.gpu

        self.load_shot_args = {
            'pad_shot_to_seconds': args.pad_shot_to,
            'fps': args.shot_fps,
            'max_frames': self.conf.max_frames,
            'sample_framerate': self.conf.feature_framerate,
            'size': args.input_size,
            'transform': T.Compose([
                T.Resize(args.input_size, interpolation=Image.BICUBIC),
                T.CenterCrop(args.input_size),
                # T.ToTensor(),
                T.Normalize((0.48145466, 0.4578275, 0.40821073), (0.26862954, 0.26130258, 0.27577711)),
            ]),
            'ffmpeg_threads': args.ffmpeg_threads,
        }

    def setup(self):
        if self.model is None:
            # init device and model
            self.device, self.n_gpu = init_device(self.conf, self.conf.local_rank, self.logger)
            self.model = init_model(self.conf, self.device, self.logger)

            if hasattr(self.model, 'module'):
                self.model = self.model.module

            self.model = self.model.to(self.device)
            self.model.eval()

    def forward_batch(self, batch):
        video, video_mask, shot_ids = batch
        video, video_mask = video.to(self.device), video_mask.to(self.device)
        visual_output = self.model.get_visual_output(video, video_mask)
        video_features = self.model.get_video_features(visual_output, video_mask)
        records = [{'feature_vector': f.tolist()} for f in video_features.cpu().numpy()]
        return records

    def extract(self, shot_paths_and_times):
        self.setup()  # lazy load model

        # init test dataloader
        dataset = C2VDataset(shot_paths_and_times, **self.load_shot_args)
        dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers)

        with torch.no_grad():
            records = [self.forward_batch(batch) for batch in dataloader]
            records = list(itertools.chain.from_iterable(records))

        return records

    def extract_iterable(self, shot_paths_and_times):
        self.setup()

        shot_paths_and_times = list(shot_paths_and_times)
        dataset = C2VDataset(shot_paths_and_times, **self.load_shot_args)
        print(f"Dataset len: {len(shot_paths_and_times)}")
        dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers)

        with torch.no_grad():
            for batch in dataloader:
                records = self.forward_batch(batch)
                yield from records

    # def extract_iterable(self, shot_paths_and_times):
    #     # FIXME: not working correctly when num_workers == 0

    #     self.setup()

    #     dataset = C2VIterableDataset(shot_paths_and_times, batch_size=self.args.batch_size, **self.load_shot_args)
    #     dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers)

    #     with torch.no_grad():
    #         for batch in dataloader:
    #             records = self.forward_batch(batch)
    #             yield from records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract features from a CLIP model')
    CLIP2VideoExtractor.add_arguments(parser)
    args = parser.parse_args()
    extractor = CLIP2VideoExtractor(args)
    extractor.run()