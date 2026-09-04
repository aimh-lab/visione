import glob
import math
import os

import pandas as pd
from langchain_classic.chains.query_constructor.schema import AttributeInfo
from langchain_core.documents import Document
from langchain_postgres.v2.engine import Column
from tqdm import tqdm

from .media import MediaResource


class V3C12Loader:
    def __init__(
        self,
        name,
        data_server_url,
        v3c_root_folder,
        video_root_folder=None,
        extraction=None,
        debug=False,
    ):
        self.name = name
        self.debug = debug
        self.data_server_url = data_server_url
        self.v3c_root_folder = v3c_root_folder
        self.video_root_folder = video_root_folder
        self.extraction = extraction or []
        self.metadata_df = self._generate_metadata()

    def _get_scene_files(self):
        pattern = os.path.join(self.v3c_root_folder, "**", "*-scenes.csv")
        return glob.glob(pattern, recursive=True)

    def _format_shot_id(self, shot_id, pad_to):
        return f"{shot_id:0{pad_to}d}"

    def _get_media_collection_name(self):
        return self.name

    def _video_file_path(self, video_id):
        if not self.video_root_folder:
            return None
        candidates = [
            os.path.join(self.video_root_folder, "videos", f"{video_id}.mp4"),
            os.path.join(
                self.video_root_folder,
                "videos-converted-to-mp4",
                f"{video_id}.mp4",
            ),
        ]
        return next((path for path in candidates if os.path.isfile(path)), None)

    def _image_file_path(self, video_id, shot_id, pad_to):
        formatted_shot_id = self._format_shot_id(shot_id, pad_to)
        path = os.path.join(
            self.v3c_root_folder,
            str(video_id),
            f"{video_id}-{formatted_shot_id}.jpg",
        )
        return path if os.path.isfile(path) else None

    def _generate_metadata(self):
        dfs = []
        for i, file_path in tqdm(enumerate(self._get_scene_files())):
            df = pd.read_csv(
                file_path,
                dtype={
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
                },
            )
            df["pad_to"] = max(3, len(str(df["Scene Number"].max())))
            stem = os.path.splitext(os.path.basename(file_path))[0]
            df["video_id"] = stem.split("-")[0]
            df["id"] = df["video_id"] + "_" + df["Scene Number"].astype(str)
            dfs.append(df)
            if self.debug and i >= 30:
                break

        metadata_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
        for column in ["Start Timecode", "End Timecode", "Length (timecode)"]:
            if column in metadata_df.columns:
                metadata_df[column] = metadata_df[column].apply(
                    self._timecode_to_seconds
                )
        metadata_df.columns = [
            column.lower().replace(" ", "_").replace("(", "").replace(")", "")
            for column in metadata_df.columns
        ]
        return metadata_df

    @staticmethod
    def _timecode_to_seconds(timecode):
        hours, minutes, remainder = timecode.split(":")
        seconds, milliseconds = remainder.split(".", 1)
        return (
            int(hours) * 3600
            + int(minutes) * 60
            + int(seconds)
            + int(milliseconds) / 1000
        )

    def generate_docs(self):
        records = self.metadata_df.to_dict(orient="records")
        documents = [
            Document(page_content=record["id"], metadata=record)
            for record in tqdm(records)
        ]
        return documents, [record["id"] for record in records]

    def get_collection_element_url_from_id(
        self,
        id_str,
        what="image",
        tpad=1.5,
    ):
        collection = self._get_media_collection_name()
        url = f"{self.data_server_url}/{collection}/{id_str}/{what}"
        _, separator, shot_id = str(id_str).rpartition("_")
        if what != "video" or not separator or not shot_id.isdigit() or tpad is None:
            return url
        tpad = float(tpad)
        if not math.isfinite(tpad) or tpad < 0:
            raise ValueError("tpad must be a finite, non-negative number")
        return f"{url}?tpad={tpad:g}"

    def iter_media_resources(self, metadata_df=None):
        metadata_df = self.metadata_df if metadata_df is None else metadata_df
        collection = self._get_media_collection_name()
        video_paths = {
            str(video_id): self._video_file_path(str(video_id))
            for video_id in metadata_df["video_id"].unique()
        }
        for video_id, video_path in video_paths.items():
            yield MediaResource(
                collection=collection,
                resource_id=video_id,
                element_type="video",
                file_key=f"{collection}:video:{video_id}",
                file_path=video_path,
                media_kind="video",
            )

        for record in metadata_df.itertuples(index=False):
            video_id = str(record.video_id)
            resource_id = str(record.id)
            video_key = f"{collection}:video:{video_id}"
            yield MediaResource(
                collection=collection,
                resource_id=resource_id,
                element_type="video",
                file_key=video_key,
                file_path=video_paths[video_id],
                media_kind="video",
                start_seconds=float(record.start_time_seconds),
                end_seconds=float(record.end_time_seconds),
            )
            yield MediaResource(
                collection=collection,
                resource_id=resource_id,
                element_type="image",
                file_key=f"{collection}:image:{resource_id}",
                file_path=self._image_file_path(
                    video_id,
                    int(record.scene_number),
                    int(record.pad_to),
                ),
                media_kind="image",
            )

    def get_media_resource_count(self, metadata_df=None):
        metadata_df = self.metadata_df if metadata_df is None else metadata_df
        if metadata_df.empty:
            return 0
        return 2 * len(metadata_df) + metadata_df["video_id"].nunique()

    def get_retrieved_metadata_columns(self):
        return ["video_id"]

    def get_table_name(self):
        return "v3c12"

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
        descriptions = {
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
                description=descriptions.get(
                    column.name, f"Collection metadata field {column.name}."
                ),
                type=type_map.get(column.data_type, "string"),
            )
            for column in self.get_column_schema()
            if column.name in descriptions
        ]
