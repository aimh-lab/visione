import glob
import os

from .v3c12 import V3C12Loader


class V3C3Loader(V3C12Loader):
    """Load V3C3 metadata while retaining the V3C output contract."""

    def _get_scene_files(self):
        csv_folder = os.path.join(
            self.v3c_root_folder,
            "output_data",
            "V3C3",
            "csv_VISIONE",
        )
        five_digit_filename = "".join(["[0-9]"] * 5) + ".csv"
        return glob.glob(os.path.join(csv_folder, five_digit_filename))

    def _format_shot_id(self, shot_id, pad_to):
        return str(int(shot_id))

    def _video_file_path(self, video_id):
        path = os.path.join(
            self.v3c_root_folder,
            "raw-data",
            "V3C3",
            "videos",
            str(video_id),
            f"{video_id}.mp4",
        )
        return path if os.path.isfile(path) else None

    def _image_file_path(self, video_id, shot_id, pad_to):
        path = os.path.join(
            self.v3c_root_folder,
            "output_data",
            "V3C3",
            "keyframes_VISIONE",
            str(video_id),
            f"{video_id}_{int(shot_id)}.jpg",
        )
        return path if os.path.isfile(path) else None

    def _get_media_collection_name(self):
        return "v3c"

    def get_table_name(self):
        return "v3c3"


if __name__ == "__main__":
    data_server_url = "https://visione.isti.cnr.it:43333"
    v3c_root_folder = "/data2/v3c-2026-data" #"/data2/v3c-2026-data"

    v3c = V3C3Loader("v3c3", data_server_url, v3c_root_folder, debug=True)

    docs, ids = v3c.generate_docs()
    id = ids[0]

    video_url = v3c.get_collection_element_url_from_id(id, what="video")
    image_url = v3c.get_collection_element_url_from_id(id, what="image")
    print(video_url)
    print(image_url)

    print(f"Table name: {v3c.get_table_name()}")

    # 10 random idx from 0 to len(ids)-1
    import random
    random.seed(42)
    sample_ids = random.sample(range(len(ids)), min(1000, len(ids)))

    print(f"Generated {len(docs)} documents.")
    if len(docs) > 0:
        for idx in sample_ids:
            print(f"Document {idx}:")
            print(f"  ID: {ids[idx]}")
            print(f"  Content: {docs[idx].page_content}")
            print(f"  Metadata: {docs[idx].metadata}")
            print(f"  Video URL: {v3c.get_collection_element_url_from_id(ids[idx], what='video')}")
            print(f"  Image URL: {v3c.get_collection_element_url_from_id(ids[idx], what='image')}")
