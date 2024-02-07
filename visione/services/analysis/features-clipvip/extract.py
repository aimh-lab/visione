import argparse
import itertools
import av
import gc
import logging
import math

import more_itertools
from easydict import EasyDict as edict
import numpy as np
import torch
import torchvision.transforms as T
from torch.utils.data import DataLoader
from transformers.models.clip.configuration_clip import CLIPConfig, CLIPTextConfig, CLIPVisionConfig
from transformers import CLIPProcessor, CLIPTokenizerFast, AutoProcessor
from clipvip.CLIP_VIP import CLIPModel, clip_loss

from visione.extractor import BaseVideoExtractor

loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
for logger in loggers:
    logger.setLevel(logging.WARNING)

logging.basicConfig(fname='/data/clipvip.log', level=logging.INFO)


def read_video_pyav(container, indices, start_time, how_many_frames):
    frames = []
    start_time_tb = int(start_time * av.time_base)
    container.seek(start_time_tb, any_frame=True)

    for i, frame in enumerate(container.decode(video=0)):
        if i > how_many_frames:
            break
        if i in indices:
            frames.append(frame)
    return np.stack([x.to_ndarray(format="rgb24") for x in frames])

def sample_frame_indices(clip_len, how_many_frames):
    start_idx = 0
    end_idx = how_many_frames
    indices = np.linspace(start_idx, end_idx, num=clip_len)
    indices = np.clip(indices, start_idx, end_idx - 1).astype(np.int64)
    return indices


def load_shot(
    shot_info,
    pad_shot_to_seconds,
    **kwargs
):
    clip_len = 12
    video_id, shot_id, video_path, start_frame, start_time, end_frame, end_time = shot_info

    duration = end_time - start_time
    if duration < pad_shot_to_seconds:
        pad = (pad_shot_to_seconds - duration) / 2
        start_time = max(0, start_time - pad)
        end_time = start_time + pad_shot_to_seconds  # FIXME: this could overshoot the end of the video
        duration = pad_shot_to_seconds

    with av.open(video_path.as_posix(), metadata_errors="ignore") as container:
        video_stream = container.streams.video[0]

        if video_stream.duration is not None:
            # FIXME: the stream seems empty if start time is too close to the end of the video
            video_duration = float(video_stream.duration * video_stream.time_base)
            if video_duration - start_time < 3:
                logging.warning(f"Shot {shot_id} has less than 3 seconds of video left, using last 3 seconds")
                start_time = video_duration - 3

        fps = video_stream.average_rate or video_stream.guessed_rate or 25
        how_many_frames = math.ceil(duration * fps)
        if how_many_frames == 0:
            # should never happen, but just in case
            logging.warning(f"Shot {shot_id} has duration 0, using 1 frame")
            how_many_frames = 1
        indices = sample_frame_indices(clip_len, how_many_frames)
        try:
            video = read_video_pyav(container, indices, start_time, how_many_frames)
        except Exception as e:
            logging.error(f"Failed video decoding for {video_path} {start_time}-{end_time}: {e}")
            video = np.zeros((len(indices), video_stream.height, video_stream.width, 3), dtype=np.uint8)

    gc.collect()    # FIXME: this avoids a memory leak in pyav, but probably there's a better way

    return video


class C2VDataset(torch.utils.data.Dataset):
    def __init__(self, shot_infos, **kwargs):
        self.shot_infos = shot_infos
        self.kwargs = kwargs

    def __len__(self):
        return len(self.shot_infos)

    def __getitem__(self, item_id):
        return load_shot(self.shot_infos[item_id], **self.kwargs)


class VideoCollate():
    def __init__(self, processor):
        self.processor = processor

    def __call__(self, batch):
        batch = [list(b) for b in batch]
        batch = self.processor(videos=batch, return_tensors="pt").pixel_values
        return batch


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
        parser.add_argument('--input-size', type=int, default=224, help="Size of the input images to the model")
        parser.add_argument('--batch-size', type=int, default=1, help="Batch size")
        parser.add_argument('--num-workers', type=int, default=0, help="Number of workers for data loading")

    def __init__(self, args):
        super(CLIP2VideoExtractor, self).__init__(args)
        self.device = None
        self.model = None

    def setup(self):
        if self.model is None:
            # init device and model
            self.device = 'cuda' if self.args.gpu and torch.cuda.is_available() else 'cpu'

            extraCfg = edict({
                "type": "ViP",
                "temporal_size": 12,
                "if_use_temporal_embed": 1,
                "logit_scale_init_value": 4.60,
                "add_cls_num": 3
            })

            clipconfig = CLIPConfig.from_pretrained("openai/clip-vit-base-patch16")
            clipconfig.vision_additional_config = extraCfg

            checkpoint = torch.load("pretrain_clipvip_base_16.pt")
            cleanDict = { key.replace("clipmodel.", "") : value for key, value in checkpoint.items() }
            self.model = CLIPModel(config=clipconfig)
            self.model.load_state_dict(cleanDict)

            self.model = self.model.to(self.device)
            self.model.eval()

            self.processor = AutoProcessor.from_pretrained("microsoft/xclip-base-patch16")

    def forward_batch(self, video):
        video = video.to(self.device)
        inputs = {"if_norm": True, "pixel_values": video}
        video_features = self.model.get_image_features(**inputs)
        records = [{'feature_vector': f.tolist()} for f in video_features.cpu().numpy()]
        return records

    def extract(self, shot_paths_and_times):
        self.setup()  # lazy load model

        # init test dataloader
        collate_fn = VideoCollate(self.processor)
        dataset = C2VDataset(shot_paths_and_times, self.args.pad_shot_to)
        dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers, collate_fn=collate_fn)

        with torch.no_grad():
            records = [self.forward_batch(batch) for batch in dataloader]
            records = list(itertools.chain.from_iterable(records))

        return records

    def extract_iterable(self, shot_paths_and_times):
        self.setup()

        collate_fn = VideoCollate(self.processor)
        shot_paths_and_times = list(shot_paths_and_times)
        dataset = C2VDataset(shot_paths_and_times, **{'pad_shot_to_seconds': self.args.pad_shot_to})
        dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers, collate_fn=collate_fn)

        with torch.no_grad():
            for batch in dataloader:
                records = self.forward_batch(batch)
                yield from records

    # def extract_iterable(self, shot_paths_and_times):
    #     # FIXME: not working correctly when num_workers == 0

    #     self.setup()

    #     collate_fn = VideoCollate(self.processor)
    #     dataset = C2VIterableDataset(shot_paths_and_times, batch_size=self.args.batch_size, **{'pad_shot_to_seconds': self.args.pad_shot_to})
    #     dataloader = DataLoader(dataset, batch_size=self.args.batch_size, num_workers=self.args.num_workers, collate_fn=collate_fn)

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