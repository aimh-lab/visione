import os
import pandas as pd
from tqdm import tqdm
from langchain_core.documents import Document
from langchain_classic.chains.query_constructor.schema import AttributeInfo
from langchain_postgres.v2.engine import Column


class LSC26Loader:
    def __init__(self, name, data_server_url, metadata_file):
        self.name = name
        self.data_server_url = data_server_url
        self.metadata_file = metadata_file

    def _generate_metadata(self):
        # 1. Read the CSV, keeping only the columns we need
        df = pd.read_csv(
            self.metadata_file,
            usecols=[
                "image_key",
                "time.timezone",
                "location",
                "location.vaisl.stop",
                "location.vaisl.country",
                "local_time",
                "utc_offset_hours",
                "location.gps.latitude",
                "location.gps.longitude",
                "location.gps.elevation",
            ],
            dtype={
                "image_key": str,
                "time.timezone": str,
                "location": str,
                "location.vaisl.stop": str,
                "location.vaisl.country": str,
                "local_time": str,
                "utc_offset_hours": float,
                "location.gps.latitude": float,
                "location.gps.longitude": float,
                "location.gps.elevation": float,
            },
        )

        # 2. Rename columns with dots to use underscores
        df = df.rename(columns={
            "location.vaisl.stop": "location_stop",
            "location.vaisl.country": "location_country",
            "location.gps.elevation": "gps_elevation",
            "time.timezone": "timezone",
        })

        # 3. image_name is image_key
        df["image_name"] = df["image_key"]

        # 4. Derive epoch (UTC) from filename stem (YYYYMMDD_HHMMSS)
        def stem_to_epoch(image_key):
            stem = image_key.rsplit(".", 1)[0]  # remove extension
            dt = pd.to_datetime(stem, format="%Y%m%d_%H%M%S", errors="coerce")
            # if pd.isnull(dt):
            #     return None
            return int(dt.timestamp())

        df["epoch"] = df["image_name"].apply(stem_to_epoch)

        local_times = pd.to_datetime(df["local_time"], format="mixed", dayfirst=False, errors="coerce")

        # 6. hour_local: hour of day in local time
        df["hour_local"] = local_times.apply(lambda x: x.hour if pd.notnull(x) else None)

        # 7. hour_id: YYYYMMDD_hh (first 11 chars of the stem)
        df["hour_id"] = df["image_name"].str[:11]

        # 8. Temporal components (UTC, from filename)
        df["year"] = df["image_name"].str[0:4].astype(int)
        df["month"] = df["image_name"].str[4:6].astype(int)
        df["day"] = df["image_name"].str[6:8].astype(int)
        df["hour"] = df["image_name"].str[9:11].astype(int)

        # 9. Parse location_vaisl_stop as boolean
        df["location_stop"] = df["location_stop"].map(
            lambda x: True if str(x).strip().lower() == "true" else (False if str(x).strip().lower() == "false" else None)
        )

        # 10. GPS position: combine lat/lon into a (lat, lon) tuple for PostgreSQL point type
        def make_point(row):
            lat = row["location.gps.latitude"]
            lon = row["location.gps.longitude"]
            if pd.isnull(lat) or pd.isnull(lon):
                return None
            return (lat, lon)

        df["gps_position"] = df.apply(make_point, axis=1)
        df = df.drop(columns=["location.gps.latitude", "location.gps.longitude"])

        # 11. Select final columns
        target_cols = [
            "image_name",
            "epoch",
            "hour_id",
            "year",
            "month",
            "day",
            "hour",
            "hour_local",
            "timezone",
            "utc_offset_hours",
            "location",
            "location_stop",
            "location_country",
            "gps_position",
            "gps_elevation",
        ]
        df = df[target_cols]

        # 12. Replace NaN with None
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
        return "lsc26"

    def get_temporal_column(self):
        return "epoch"

    def get_temporal_groupby_column(self):
        return "hour_id"

    def get_video_time_reference_columns(self):
        return []

    def get_column_schema(self):
        return [
            Column(name="image_name", data_type="text"),
            Column(name="epoch", data_type="bigint"),
            Column(name="hour_id", data_type="text"),
            Column(name="year", data_type="integer"),
            Column(name="month", data_type="integer"),
            Column(name="day", data_type="integer"),
            Column(name="hour", data_type="integer"),
            Column(name="hour_local", data_type="integer"),
            Column(name="timezone", data_type="text"),
            Column(name="utc_offset_hours", data_type="float"),
            Column(name="location", data_type="text"),
            Column(name="location_stop", data_type="boolean"),
            Column(name="location_country", data_type="text"),
            Column(name="gps_position", data_type="point"),
            Column(name="gps_elevation", data_type="float"),
        ]

    def get_attribute_info(self):
        column_descriptions = {
            "image_name": "Image filename in the collection, formatted as YYYYMMDD_HHMMSS.webp.",
            "epoch": "Unix timestamp in seconds for the image capture time (UTC, derived from filename).",
            "hour_id": "Identifier of the hour segment containing the image, formatted as YYYYMMDD_hh.",
            "year": "Four-digit year extracted from the image timestamp.",
            "month": "Month number extracted from the image timestamp.",
            "day": "Day of month extracted from the image timestamp.",
            "hour": "Hour of day in 24-hour format (UTC) extracted from the image timestamp.",
            "hour_local": "Hour of day in 24-hour format in local time.",
            "timezone": "Timezone in which the image was captured (e.g., Europe/Dublin).",
            "utc_offset_hours": "UTC offset in hours at the time of capture.",
            "location": "Semantic location description (e.g., 'Killashee House Hotel & Villa Spa; Hotel; Ireland').",
            "location_country": "Country of the capture location.",
            "gps_position": "GPS coordinates as a (latitude, longitude) point.",
            "gps_elevation": "GPS elevation in meters.",
            # "location_stop": "Whether the location is a recognized semantic stop.",
        }
        type_map = {
            "text": "string",
            "integer": "integer",
            "bigint": "integer",
            "float": "float",
            "boolean": "boolean",
        }
        return [
            AttributeInfo(
                name=column.name,
                description=column_descriptions.get(column.name, f"Collection metadata field {column.name}."),
                type=type_map.get(column.data_type, "string"),
            )
            for column in self.get_column_schema()
            if column.name in column_descriptions
        ]


if __name__ == "__main__":
    data_server_url = "http://localhost:8000"
    metadata_file = "/data1/lsc-common-data/lsc26-data/lsc26_metadata.csv"

    loader = LSC26Loader("lsc26", data_server_url, metadata_file)

    url = loader.get_collection_element_url_from_id("20190101_205237.webp")
    print(url)

    docs, ids = loader.generate_docs()
    print(f"Generated {len(docs)} documents.")
    random_doc_ids = range(0, 100000, 1000)
    if docs:
        for idx in random_doc_ids:
            if idx < len(docs):
                print(f"Document {idx}: {docs[idx].metadata}")
        
