import os

from PIL import Image
from torch.utils.data import DataLoader, Dataset
import numpy as np
import torchvision
import torch
from torchvision.transforms import Compose, Resize, CenterCrop, ToTensor, Normalize


def c2v_dataloader(args):
    """return dataloader for testing 1k-A protocol
    Args:
        args: hyper-parameters
        tokenizer: tokenizer
    Returns:
        dataloader: dataloader
        len(msrvtt_test_set): length
    """

    n_px = 224

    transform = Compose([
        Resize(n_px, interpolation=Image.BICUBIC),
        CenterCrop(n_px),
        # ToTensor(),
        Normalize((0.48145466, 0.4578275, 0.40821073), (0.26862954, 0.26130258, 0.27577711)),
    ])

    vbs_dataset = Clip2VideoDataset(
        video_path=args.video_path,
        max_frames=args.max_frames,
        sample_framerate=args.feature_framerate,
        size=n_px,
        transform=transform
    )

    dataloader = DataLoader(
        vbs_dataset,
        batch_size=args.batch_size_val,
        num_workers=args.num_thread_reader,
        shuffle=False,
        drop_last=False,
    )
    return dataloader, len(vbs_dataset)


class Clip2VideoDataset(Dataset):
    """MSRVTT dataset loader for single sentence

    Attributes:
        csv_path:  video id of sub set
        features_path: frame directory
        tokenizer: tokenize the word
        max_words: the max number of word
        feature_framerate: frame rate for sampling video
        max_frames: the max number of frame
        image_resolution: resolution of images

    """
    def __init__(
            self,
            video_path,
            transform=None,
            max_frames=100,
            sample_framerate=2,
            size=224
    ):
        file_list_path = os.path.join(video_path, 'shot_list.txt')
        with open(file_list_path, 'r') as f:
            self.data = f.read().splitlines()
        if not os.path.isfile(os.path.join(video_path, self.data[0])):
            raise ValueError('Probably the shot list contains wrong paths! For example: {}'.format(self.data[0]))
        self.video_path = video_path
        self.max_frames = max_frames
        self.sample_framerate = sample_framerate
        self.transform = transform
        self.size = size

    def __len__(self):
        """length of data loader

        Returns:
            length: length of data loader
        """

        length = len(self.data)
        return length

    def __getitem__(self, item_id):
        """get sampled frames

        Args:
            item_id: id of video

        Returns:
            video: sampled frame
            video_mask: mask of video
        """

        video_mask = torch.zeros(1, self.max_frames).long()

        # 1 x L x 1 x 3 x H x W
        video = torch.zeros(1, self.max_frames, 1, 3, self.size, self.size)

        # video_path
        shot_relative_path = self.data[item_id]
        shot_path = os.path.join(self.video_path, shot_relative_path)

        # get the shot id from the shot path
        shot_id = os.path.split(shot_relative_path)[1]
        shot_id = os.path.splitext(shot_id)[0]

        # get sampling frames
        loaded_video, _, _ = torchvision.io.read_video(shot_path, pts_unit='sec')
        if loaded_video.nelement() == 0:
            print('0 size! Possible corruption!')
        # raw_video_data = []
        # for i, frame in enumerate(video_reader):
        #     f = self.transform(frame)
        #     raw_video_data.append(f)
        #     if i > self.max_frames:
        #         break
        # raw_video_data = torch.stack(raw_video_data, dim=0)
        loaded_video = loaded_video.permute(0, 3, 1, 2) # T x 3 x H x W
        raw_video_data = loaded_video[::self.sample_framerate, ...]
        raw_video_data = raw_video_data[:self.max_frames, ...]
        raw_video_data = raw_video_data / 255.0 # convert to [0, 1]
        raw_video_data = self.transform(raw_video_data)

        # raw_video_data = self.frameExtractor.get_video_data(video_path, self.max_frames)
        # raw_video_data = raw_video_data['video']

        # L x 1 x 3 x H x W
        if len(raw_video_data.shape) > 3:
            raw_video_data_clip = raw_video_data
            # L x T x 3 x H x W
            # raw_video_slice = self.frameExtractor.process_raw_data(raw_video_data_clip)
            tensor_size = raw_video_data_clip.size()
            raw_video_slice = raw_video_data_clip.view(-1, 1, tensor_size[-3], tensor_size[-2], tensor_size[-1])

            # max_frames x 1 x 3 x H x W
            if self.max_frames < raw_video_slice.shape[0]:
                    sample_indx = np.linspace(0, raw_video_slice.shape[0] - 1, num=self.max_frames, dtype=int)
                    video_slice = raw_video_slice[sample_indx, ...]
            else:
                video_slice = raw_video_slice

            # set max length, and save video mask and frames
            slice_len = video_slice.shape[0]
            video_mask[0, :slice_len] = torch.LongTensor([1] * slice_len)
            video[0, :slice_len, ...] = video_slice

        else:
            print("get raw video error, skip it.")

        return video, video_mask, shot_id, item_id


# test
import argparse
if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument('--video_path', type=str,
                        default='/home/messina/datino/VBS/V3C_dataset/V3C1/full_shots_for_video_retrieval', help='')
    parser.add_argument('--max_frames', type=int,
                        default=100, help='')
    parser.add_argument('--num_thread_reader', type=int, default=1, help='')
    parser.add_argument('--feature_framerate', type=int, default=2, help='frame rate for uniformly sampling the video')
    parser.add_argument('--batch_size_val', type=int, default=64, help='batch size eval')

    args = parser.parse_args()

    dataloader, leng = c2v_dataloader(args)
    print('Dataset len: {}'.format(leng))
    for d in dataloader:
        print(d)