import pandas as pd
import os
import csv
from tqdm import tqdm
from langchain_core.documents import Document
from langchain_classic.chains.query_constructor.schema import AttributeInfo
from langchain_postgres.v2.engine import Column


class LSCLoader:
    def __init__(
            self,
            name,
            data_server_url,
            metadata_file
            ):
        self.name = name
        self.data_server_url = data_server_url
        self.metadata_file = metadata_file

    def _generate_metadata(self):
        df = pd.read_csv(
            self.metadata_file,
            usecols=[
                "image_key",
                "Caption",
                "OCR",
                "Tags",
                "heart_rate_bpm",
                "local_time",
                "utc_offset_hours",
                "location",
                "location.gps.elevation",
                "location.gps.latitude",
                "location.gps.longitude",
                "location.vaisl.country",
                "location.vaisl.stop",
                "time.timezone",
                "now_playing"
            ],
            dtype={
                "image_key": str,
                "Caption": str,
                "OCR": str,
                "Tags": str,
                "heart_rate_bpm": float,
                "local_time": str,
                "utc_offset_hours": float,
                "location": str,
                "location.gps.elevation": float,
                "location.gps.latitude": float,
                "location.gps.longitude": float,
                "location.vaisl.country": str,
                "location.vaisl.stop": str,
                "time.timezone": str,
                "now_playing": str,
            },
        )

        # Rename columns to follow lsc26 naming conventions
        df = df.rename(columns={
            "image_key": "image_name",
            "Caption": "caption",
            "OCR": "ocr",
            "Tags": "tags",
            "location.vaisl.stop": "location_stop",
            "location.vaisl.country": "location_country",
            "location.gps.elevation": "gps_elevation",
            "time.timezone": "timezone",
            "now_playing": "music",
        })

        # Derive epoch from filename stem (YYYYMMDD_HHMMSS)
        def stem_to_epoch(image_key):
            stem = image_key.rsplit(".", 1)[0]
            dt = pd.to_datetime("_".join(stem.split("_")[:2]), format="%Y%m%d_%H%M%S", errors="coerce")
            # if pd.isnull(dt):
            #     return None
            return int(dt.timestamp())

        df["epoch"] = df["image_name"].apply(stem_to_epoch)

        # hour_local: hour of day in local time
        local_times = pd.to_datetime(df["local_time"], format="mixed", dayfirst=False, errors="coerce")
        # df["hour_local"] = local_times.apply(lambda x: x.hour if pd.notnull(x) else None)
        df["epoch_local"] = df["epoch"] + (df["utc_offset_hours"] * 3600).fillna(0).astype(int)
        df = df.drop(columns=["local_time"])

        # hour_id: YYYYMMDD_hh (first 11 chars of image_name)
        df["hour_id"] = df["image_name"].str[:11]

        # Temporal components from filename
        df["year"] = local_times.apply(lambda x: x.year) # df["image_name"].str[0:4].astype(int)
        df["month"] = local_times.apply(lambda x: x.month) # df["image_name"].str[4:6].astype(int)
        df["day"] = local_times.apply(lambda x: x.day) # df["image_name"].str[6:8].astype(int)
        df["hour"] = local_times.apply(lambda x: x.hour) # df["image_name"].str[9:11].astype(int)

        # location_stop as boolean
        df["location_stop"] = df["location_stop"].map(
            lambda x: True if str(x).strip().lower() == "true" else (False if str(x).strip().lower() == "false" else None)
        )

        # GPS position: combine lat/lon into a (lat, lon) tuple for PostgreSQL point type
        def make_point(row):
            lat = row["location.gps.latitude"]
            lon = row["location.gps.longitude"]
            if pd.isnull(lat) or pd.isnull(lon):
                return None
            return (lat, lon)

        df["gps_position"] = df.apply(make_point, axis=1)
        df = df.drop(columns=["location.gps.latitude", "location.gps.longitude"])

        # Select final columns
        target_cols = [
            "image_name",
            "epoch",
            "epoch_local",
            "hour_id",
            "year",
            "month",
            "day",
            "hour",
            "timezone",
            "utc_offset_hours",
            "location",
            "location_stop",
            "location_country",
            "gps_position",
            "gps_elevation",
            "caption",
            "ocr",
            "tags",
            "heart_rate_bpm",
            "music",
        ]
        df = df[target_cols]

        # Replace NaN with None
        df = df.where(pd.notnull(df), None)
        return df

    def generate_docs(self):
        metadata_df = self._generate_metadata()
        final_records = metadata_df.to_dict(orient="records")

        documents = [
            Document(page_content=record["image_name"], metadata=record)
            for record in tqdm(final_records)
        ]
        ids = [record["image_name"] for record in final_records]

        return documents, ids

    # TODO: no more collection-specific, move this to a utility class (or to a base class for loaders)
    def get_collection_element_url_from_id(self, id_str, what="images"):
        """
        Given an image name (e.g. '20190101_205237.webp'), construct its URL.
        The relative path is what/id_str, where what is the collection path (e.g. 'images') and id_str is the image name.
        """
        path = id_str + "/" + what
        return self.data_server_url + "/" + self.name + "/" + path
    
    def get_retrieved_metadata_columns(self):
        return ["epoch"]

    def get_table_name(self):
        return "lsc"

    def get_temporal_column(self):
        return "epoch"

    def get_temporal_groupby_column(self):
        return None

    def get_video_time_reference_columns(self):
        return []
    
    def get_full_text_search_columns(self):
        return ["location", "music"]

    def get_column_schema(self):
        return [
            Column(name="image_name", data_type="text"),
            Column(name="epoch", data_type="bigint"),
            Column(name="epoch_local", data_type="bigint"),
            Column(name="hour_id", data_type="text"),
            Column(name="year", data_type="integer"),
            Column(name="month", data_type="integer"),
            Column(name="day", data_type="integer"),
            Column(name="hour", data_type="integer"),
            Column(name="timezone", data_type="text"),
            Column(name="utc_offset_hours", data_type="float"),
            Column(name="location", data_type="text"),
            Column(name="location_stop", data_type="boolean"),
            Column(name="location_country", data_type="text"),
            Column(name="gps_position", data_type="point"),
            Column(name="gps_elevation", data_type="float"),
            Column(name="caption", data_type="text"),
            Column(name="ocr", data_type="text"),
            Column(name="tags", data_type="text"),
            Column(name="heart_rate_bpm", data_type="float"),
            Column(name="music", data_type="text"),
        ]

    def get_attribute_info(self):
        column_descriptions = {
            "image_name": "Image filename in the collection, formatted as YYYYMMDD_HHMMSS_NNN.jpg.",
            "epoch": "Unix timestamp in seconds for the image capture time (UTC, derived from filename).",
            # "epoch_local": "Unix timestamp in seconds for the image capture time (local time, derived from filename).",
            "hour_id": "Identifier of the hour segment containing the image, formatted as YYYYMMDD_hh.",
            "year": "Four-digit year extracted from the image timestamp (local time).",
            "month": "Month number extracted from the image timestamp (local time).",
            "day": "Day of month extracted from the image timestamp (local time).",
            "hour": "Hour of day in 24-hour format (UTC) extracted from the image timestamp (local time).",
            "timezone": "Timezone in which the image was captured (e.g., Europe/Dublin).",
            "utc_offset_hours": "UTC offset in hours at the time of capture.",
            "location": "Semantic location description (e.g., 'Inside; HOME; Dublin, Ireland, Leinster; Ireland').",
            "location_country": "Country of the capture location.",
            "gps_position": "GPS coordinates as a (latitude, longitude) point.",
            "gps_elevation": "GPS elevation in meters.",
            # "caption": "Auto-generated textual description of the image content.",
            "ocr": "Text extracted from the image via optical character recognition.",
            # "tags": "Comma-separated semantic tags associated with the image.",
            "heart_rate_bpm": "Heart rate in beats per minute at the time of capture.",
            # "music": "The name of the song currently playing in the mp3 player.",
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
    data_server_url = "http://localhost:8000"
    metadata_file = "/data1/lsc-common-data/lsc25-data/lsc25_metadata_clean.csv"

    lsc = LSCLoader("lsc", data_server_url, metadata_file)
    url = lsc.get_collection_element_url_from_id("20190101_121948_000.jpg")
    print(url)

    docs, ids = lsc.generate_docs()

    # 10 random idx from 0 to len(ids)-1
    import random
    random.seed(42)
    sample_ids = random.sample(range(len(ids)), min(10, len(ids)))

    print(f"Generated {len(docs)} documents.")
    if len(docs) > 0:
        for idx in sample_ids:
            print(f"Document {idx}:")
            print(f"  ID: {ids[idx]}")
            print(f"  Content: {docs[idx].page_content}")
            print(f"  Metadata: {docs[idx].metadata}")
