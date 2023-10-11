import argparse
from pathlib import Path

import numpy as np
import pandas as pd

@np.vectorize
def seconds_to_timecode(seconds):
    """ Convert seconds to timecode string (HH:MM:SS.MS) """
    seconds = np.round(seconds, 3)
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    milliseconds = int((seconds % 1) * 1000)
    seconds = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def main(args):
    scenes = pd.read_csv(args.scenes_file)

    """Example of pyscenedetect CSV file
        Scene Number  Start Frame Start Timecode  Start Time (seconds)  End Frame  End Timecode  End Time (seconds)  Length (frames) Length (timecode)  Length (seconds)
    0               1            1   00:00:00.000                  0.00         50  00:00:02.000                2.00               50      00:00:02.000              2.00
    1               2           51   00:00:02.000                  2.00         59  00:00:02.360                2.36                9      00:00:00.360              0.36
    2               3           60   00:00:02.360                  2.36        246  00:00:09.840                9.84              187      00:00:07.480              7.48
    3               4          247   00:00:09.840                  9.84        296  00:00:11.840               11.84               50      00:00:02.000              2.00
    4               5          297   00:00:11.840                 11.84        297  00:00:11.880               11.88                1      00:00:00.040              0.04
    ..            ...          ...            ...                   ...        ...           ...                 ...              ...               ...               ...
    158           159         7201   00:04:48.000                288.00       7830  00:05:13.200              313.20              630      00:00:25.200             25.20
    159           160         7831   00:05:13.200                313.20       7900  00:05:16.000              316.00               70      00:00:02.800              2.80
    160           161         7901   00:05:16.000                316.00       8340  00:05:33.600              333.60              440      00:00:17.600             17.60
    161           162         8341   00:05:33.600                333.60       8350  00:05:34.000              334.00               10      00:00:00.400              0.40
    162           163         8351   00:05:34.000                334.00       8786  00:05:51.440              351.44              436      00:00:17.440             17.44
    """

    fps_estimate = scenes.iloc[-1]['End Frame'] / scenes.iloc[-1]['End Time (seconds)']

    splitted_scenes = []

    for _, scene in scenes.iterrows():
        scene_num = scene['Scene Number']

        scene_start_frame = scene['Start Frame']
        scene_start_timecode = scene['Start Timecode']
        scene_start_sec = scene['Start Time (seconds)']

        scene_end_frame = scene['End Frame']
        scene_end_timecode = scene['End Timecode']
        scene_end_sec = scene['End Time (seconds)']

        scene_len_frames = scene['Length (frames)']
        scene_len_timecode = scene['Length (timecode)']
        scene_len_sec = scene['Length (seconds)']


        if scene_len_sec <= args.max_length:
            splitted_scenes.append({
                'Scene Number': scene_num,
                'Start Frame': scene_start_frame,
                'Start Timecode': scene_start_timecode,
                'Start Time (seconds)': scene_start_sec,
                'End Frame': scene_end_frame,
                'End Timecode': scene_end_timecode,
                'End Time (seconds)': scene_end_sec,
                'Length (frames)': scene_len_frames,
                'Length (timecode)': scene_len_timecode,
                'Length (seconds)': scene_len_sec,
            })
            continue

        print(f"Scene {scene_num} is too long ({scene_len_sec}s). Splitting...")

        # Split scene
        num_splits = np.ceil(scene_len_sec / args.max_length).astype(int)
        split_frames = np.linspace(scene_start_frame, scene_end_frame, num_splits + 1).astype(int)
        split_times = (split_frames - 1) / fps_estimate
        split_timecode = seconds_to_timecode(split_times)
        split_lengths_sec = np.diff(split_times)
        split_lengths_frames = np.diff(split_frames)
        split_lengths_timecode = seconds_to_timecode(split_lengths_sec)
        split_num = scene_num + np.linspace(0, 1, num_splits + 1)[:-1]

        subscenes = pd.DataFrame({
            'Scene Number': scene_num + np.linspace(0, 1, num_splits + 1)[:-1],
            'Start Frame': split_frames[:-1],
            'Start Timecode': split_timecode[:-1],
            'Start Time (seconds)': split_times[:-1],
            'End Frame': split_frames[1:],
            'End Timecode': split_timecode[1:],
            'End Time (seconds)': split_times[1:],
            'Length (frames)': split_lengths_frames,
            'Length (timecode)': split_lengths_timecode,
            'Length (seconds)': split_lengths_sec,
        }).to_dict(orient='records')

        splitted_scenes.extend(subscenes)

    splitted_scenes = pd.DataFrame(splitted_scenes)
    splitted_scenes['Scene Number'] = splitted_scenes.index + 1
    splitted_scenes.to_csv(args.scenes_file)
    print(f"After post-processing, there are {len(splitted_scenes)} scenes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Split long scenes in pyscenedetect CSV scene files')
    parser.add_argument('scenes_file', type=Path, help="Path to CSV file.")
    parser.add_argument('--max-length', type=float, help="Max length of a scene in seconds.")

    args = parser.parse_args()
    main(args)
