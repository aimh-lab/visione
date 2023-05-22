import sys
import os
import torch

# This is required to consider the CLIP2Video repo like a set of packages that we can import (e.g., modules, utils)
modules_path = os.path.dirname(os.path.abspath(__file__)) + '/CLIP2Video'
sys.path.insert(0, modules_path)
from modules.modeling import CLIP2Video

class CLIP2VideoWrapped(CLIP2Video):

    def get_text_features(self, sequence_output, attention_mask, shaped=False):
        """get the similarity for global and local representation during inference
         Args:
             sequence_output: embedding
             visual_output: embedding
             attention_mask: caption mask
             video_mask: video mask
             shaped: whether to shape the dimension
         Returns:
             text_out:output embedding [1,512]
             video_out: output embedding [1,512]
         """
        if shaped is False:
            attention_mask = attention_mask.view(-1, attention_mask.shape[-1])

        if self.center_type == 'TAB':
            sequence_output, sequence_hidden_output = sequence_output

        sequence_output = sequence_output.contiguous()

        # obtain the normalized sequence embedding
        sequence_output = sequence_output.squeeze(1)
        sequence_output = sequence_output / sequence_output.norm(dim=-1, keepdim=True)

        return sequence_output

    def get_video_features(self, visual_output, video_mask, shaped=False):
        """get the similarity for global and local representation during inference
         Args:
             visual_output: embedding
             video_mask: video mask
             shaped: whether to shape the dimension
         Returns:
             video_out: output embedding [1,512]
         """
        if shaped is False:
            video_mask = video_mask.view(-1, video_mask.shape[-1])

        # if self.center_type == 'TAB':
        #     sequence_output, sequence_hidden_output = sequence_output

        if self.sim_type == 'seqTransf' and self.temporal_type == 'TDB':
            # adopting temporal transformer with TDB block
            # retrieve_logits = self._similarity_TDB(sequence_output, visual_output, attention_mask, video_mask)

            visual_output = visual_output.contiguous()

            # obtain the basic embedding
            visual_output_original = visual_output  # batch_size * 12 * 512

            # difference-enhanced token obtained by TDB
            visual_output, frame_position_embeddings, type_embedding, temporal_video_mask = self.temporal_difference_block(
                visual_output, video_mask)

            # obtain the output of transformer
            visual_output = visual_output + frame_position_embeddings + type_embedding  # batch_size * 12 * 512
            extended_video_mask = (1.0 - temporal_video_mask.unsqueeze(1)) * -1000000.0  # batch_size * 1* 12
            extended_video_mask = extended_video_mask.expand(-1, temporal_video_mask.size(1),
                                                             -1)  # batch_size * 12 * 12
            visual_output = visual_output.permute(1, 0, 2)  # NLD -> LND # 12 * batch_size * 512
            visual_output = self.transformerClip(visual_output, extended_video_mask)  # 12 * batch_size * 512
            visual_output = visual_output.permute(1, 0, 2)  # LND -> NLD # batch_size * 12 * 512

            # select the output of frame token for final video representation
            frame_position_id = torch.arange(start=0, end=visual_output.size()[1], step=2, dtype=torch.long,
                                             device=visual_output.device)
            visual_output = visual_output[:, frame_position_id, :]
            visual_output = visual_output + visual_output_original
            visual_output = visual_output / visual_output.norm(dim=-1, keepdim=True)

            # mean pooling for video representation
            video_mask_un = video_mask.to(dtype=torch.float).unsqueeze(-1)  # batch_size * 12 * 1
            visual_output = visual_output * video_mask_un
            video_mask_un_sum = torch.sum(video_mask_un, dim=1, dtype=torch.float)
            video_mask_un_sum[video_mask_un_sum == 0.] = 1.
            visual_output = torch.sum(visual_output, dim=1) / video_mask_un_sum

            # obtain the normalized video embedding
            visual_output = visual_output / visual_output.norm(dim=-1, keepdim=True)

        else:
            raise NotImplementedError
            # adopting mean pooling or use temporal transformer to aggregate the video representation
            assert self.sim_type in ["meanP", "seqTransf"]
            retrieve_logits = self._similarity(sequence_output, visual_output, attention_mask, video_mask,
                                               sim_type=self.sim_type)

        return visual_output