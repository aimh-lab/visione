import os
import subprocess
from multiprocessing import Pool
import csv
import tqdm
import sys
import json
from pathlib import Path

def extract_frames(video_name, start_time, end_time, out_file, fps=5):
    # dur = end_time - start_time
    if os.path.isfile(out_file) and os.path.getsize(out_file) != 0:
        return 0
        # os.system('rm -rf ' + out_file)
    dur = end_time - start_time
    cmd = 'ffmpeg -y -v 0 -ss %.02f -i %s -t %.02f -r %d -q 0 -vf scale=320x240 -preset faster %s' % (start_time, video_name, dur, fps, out_file)

    ffmpeg = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, shell=True)
    out, err = ffmpeg.communicate()
    retcode = ffmpeg.returncode
    if retcode != 0:
        print("Error in processing video {}".format(video_name), file=sys.stderr)
    return retcode

def process(line):
    # print(line)
    mp4_name, start_time, end_time, out_folder = line
    ret = extract_frames(mp4_name.as_posix(), start_time, end_time, out_folder.as_posix())
    return ret

def preprocess_shots(shot_infos, min_duration=0.0, num_threads=5, out_folder=Path("video_feat_extraction"), parallel=True):
    """
    Preprocesses the shot metadata and performs ffmpeg processing.
    It includes merging together the shots if they are too short, if needed.

    shot_info: tuple containing video_id, shot_id, video_path, start_frame, start_time, end_frame, end_time
    min_duration: used for merging shots if duration is less than this amount
    """

    # FIXME: if min_duration > 0 (merging enabled), we first need to aggregate the tuples by video_id
    # Otherwise, there's the risk that shots from different videos are merged together
    if min_duration > 0.0:
        raise NotImplementedError()

    out_folder.mkdir(exist_ok=True)

    lines = []
    skip = False
    for video_id, shot_id, video_path, start_frame, start_time, end_frame, end_time in shot_infos:
        # merge contiguous shots if the minimum time length (min_duration) is not reached
        start_time = start_time if not skip else start_time
        shot_id_visione = shot_id if not skip else shot_id_visione
        end_time = end_time
        if end_time - start_time < min_duration:
            skip = True
            continue
        else:
            skip = False
        # out_video_ext = '.mp4' # os.path.splitext(mp4_file)[1]
        out_file = out_folder / f'{shot_id_visione}.mp4' # out_folder / '{}_{}.mp4'.format(video_id, shot_id_visione) # os.path.join(out_folder, '{}_{}.mp4'.format(video_id, shot_id_visione))
        lines.append((video_path, start_time, end_time, out_file))

    if parallel:
        # starting parallel ffmpeg processing, multi-threaded
        with Pool(processes=num_threads) as p:
            ret_values = p.imap(process, lines)
            ret_values = tqdm.tqdm(ret_values, total=len(lines))
            ret_values = list(ret_values)
    else:
        for line in tqdm.tqdm(lines):
            process(line)

    errors = [r != 0 for r in ret_values]
    shot_paths = [l[3] for l in lines]

    return shot_paths, errors