import pandas as pd
import os
import csv
import glob
from tqdm import tqdm
from langchain_core.documents import Document
from langchain_classic.chains.query_constructor.schema import AttributeInfo
from langchain_postgres.v2.engine import Column


class V3CLoader:
    def __init__(
            self,
            name,
            data_server_url,
            v3c_root_folder,
            extraction=None,
            debug=False,
            ):
        self.name = name
        self.debug = debug
        self.data_server_url = data_server_url
        self.v3c_root_folder = v3c_root_folder
        self.extraction = extraction or []
        self.metadata_df = self._generate_metadata()

    def _generate_metadata(self):
        # Load all the *.scenes.csv files in the v3c_root_folder/detected_scenes/ searching them recursively and concatenate them into a single DataFrame
        
        scenes_pattern = os.path.join(self.v3c_root_folder, "**", "*-scenes.csv")
        scene_files = glob.glob(scenes_pattern, recursive=True)

        dfs = []
        for i, file in tqdm(enumerate(scene_files)):
            df = pd.read_csv(file, dtype={
                "Scene Number": int,
                "Start Timecode": str,
                "End Timecode": str,
                "Start Frame": int,
                "End Frame": int,
                "Length (frames)": int,
                "Length (timecode)": str,
                "Start Time (seconds)": float,
                "End Time (seconds)": float,
                "Length (seconds)": float,
            })

            df["pad_to"] = max(3, len(str(df["Scene Number"].max())))

            # Extract numeric part from filename stem (e.g., "00001-scenes.csv" -> "00001")
            stem = os.path.splitext(os.path.basename(file))[0]
            numeric_part = stem.split("-")[0]
            df["video_id"] = numeric_part
            df["id"] = df["video_id"] + "_" + df["Scene Number"].astype(str)            
            dfs.append(df)

            if self.debug and i >= 30:
                break  # Limit to first 10 files for debugging
        
        metadata_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()

        # Convert timecodes to seconds
        for col in ["Start Timecode", "End Timecode", "Length (timecode)"]:
            if col in metadata_df.columns:
                metadata_df[col] = metadata_df[col].apply(self._timecode_to_seconds)

        # rename columns to all lowercase, spaces replaced with underscores and parentheses removed
        metadata_df.columns = [col.lower().replace(" ", "_").replace("(", "").replace(")", "") for col in metadata_df.columns]

        return metadata_df

    def _timecode_to_seconds(self, timecode):
        """Convert HH:MM:SS.mmm format to seconds"""
        parts = timecode.split(":")
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds_part, millis_part = parts[2].split(".", 1)
        seconds = int(seconds_part)
        milliseconds = int(millis_part)
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
        

    def generate_docs(self):
        final_records = self.metadata_df.to_dict(orient="records")

        documents = [
            Document(page_content=record["id"], metadata=record)
            for record in tqdm(final_records)
        ]
        ids = [record["id"] for record in final_records]

        return documents, ids

    def get_collection_element_url_from_id(self, id_str, what="image"):
        """
        Given an image name (e.g. '20190101_205237.webp'), construct its URL.
        The relative path is what/id_str, where what is the collection path (e.g. 'images') and id_str is the image name.
        """
        
        if what == "video":
            start_end_seconds = self.metadata_df.loc[self.metadata_df["id"] == id_str, ["start_timecode", "end_timecode"]].values[0]
            start_seconds, end_seconds = start_end_seconds
            # TODO: bad to put segment extension here: these are here in place so that extraction works on extended video margins
            start_seconds -= 1.5
            end_seconds += 1.5
            path = id_str[:5] + "/" + what + f"?start={start_seconds}&end={end_seconds}"
        elif what == "image":
            video_id, shot_id, pad_to = self.metadata_df.loc[self.metadata_df["id"] == id_str, ["video_id", "scene_number", "pad_to"]].values[0]
            path = video_id + "/" + f"{shot_id:0{pad_to}d}" + "/" + what
        return self.data_server_url + "/" + self.name + "/" + path
    
    def get_retrieved_metadata_columns(self):
        return ["video_id"]

    def get_table_name(self):
        return "v3c"

    def get_temporal_column(self):
        return "start_time_seconds"

    def get_temporal_groupby_column(self):
        return "video_id"

    def get_video_time_reference_columns(self):
        return []
    
    def get_full_text_search_columns(self):
        return []

    def get_column_schema(self):
        return [
            Column(name="id", data_type="text"),
            Column(name="video_id", data_type="text"),
            Column(name="scene_number", data_type="integer"),
            Column(name="start_timecode", data_type="float"),
            Column(name="end_timecode", data_type="float"),
            Column(name="start_frame", data_type="integer"),
            Column(name="end_frame", data_type="integer"),
            Column(name="length_frames", data_type="integer"),
            Column(name="length_timecode", data_type="float"),
            Column(name="start_time_seconds", data_type="float"),
            Column(name="end_time_seconds", data_type="float"),
            Column(name="length_seconds", data_type="float"),
        ]

    def get_attribute_info(self):
        column_descriptions = {
            "id": "Unique identifier for the video segment.",
            "video_id": "Identifier for the parent video.",
            "scene_number": "The scene number within the video.",
            "start_timecode": "The start timecode of the video segment.",
            "end_timecode": "The end timecode of the video segment.",
            "start_frame": "The start frame number of the video segment.",
            "end_frame": "The end frame number of the video segment.",
            "length_frames": "The length of the video segment in frames.",
            "length_timecode": "The length of the video segment in timecode.",
            "start_time_seconds": "The start time of the video segment in seconds.",
            "end_time_seconds": "The end time of the video segment in seconds.",
            "length_seconds": "The length of the video segment in seconds.",
        }
        type_map = {
            "text": "string",
            "integer": "integer",
            "bigint": "integer",
            "float": "float",
            "boolean": "boolean",
            "point": "string",
        }
        return [
            AttributeInfo(
                name=column.name,
                description=column_descriptions.get(column.name, f"Collection metadata field {column.name}."),
                type=type_map.get(column.data_type, "string"),
            )
            for column in self.get_column_schema() if column.name in column_descriptions
        ]


if __name__ == "__main__":
    data_server_url = "https://visione.isti.cnr.it:43333"
    v3c_root_folder = "/data1/v3c-collection/selected-frames" #"/data2/v3c-2026-data"

    lsc = V3CLoader("v3c", data_server_url, v3c_root_folder, debug=True)

    docs, ids = lsc.generate_docs()
    id = ids[0]

    video_url = lsc.get_collection_element_url_from_id(id, what="video")
    image_url = lsc.get_collection_element_url_from_id(id, what="image")
    print(video_url)
    print(image_url)

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
            print(f"  Video URL: {lsc.get_collection_element_url_from_id(ids[idx], what='video')}")
            print(f"  Image URL: {lsc.get_collection_element_url_from_id(ids[idx], what='image')}")
