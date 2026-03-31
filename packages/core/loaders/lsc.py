import pandas as pd
import ast
import os
import csv
from tqdm import tqdm
# Assuming you are using LangChain or similar for the Document class
from langchain_core.documents import Document 
from langchain_classic.chains.query_constructor.schema import AttributeInfo
from langchain_postgres.v2.engine import Column

class LSCLoader:
    def __init__(self, name, data_server_url, metadata_file, collection_paths, old_new_file_mapping_csv):
        self.name = name
        self.data_server_url = data_server_url
        self.metadata_file = metadata_file
        self.collection_paths = collection_paths
        with open(old_new_file_mapping_csv, mode='r') as f:
            reader = csv.DictReader(f)
            self.old_to_new_id_map = {row['Original Filename']: row['New Filename'] for row in reader}

    def generate_docs(self):
        # 1. Read the CSV
        df = pd.read_csv(self.metadata_file, dtype={
            'minute_id': str, 
            'utc_time_epoch': 'Int64', 
            'local_time_epoch': 'Int64',
            'position': str,
            'altitude': float,
            'semantic_name': str,
            'heart_rate_bpm': float,
            'now_playing': str,
            'sleep_level': str,
            'time_in_bed': float,
            'new_position': str,
            'new_semantic_name': str,
            'original_name': str,
            'categories': str,
            'movement': str,
            'city': str,
            'country': str,
            'new_timezone': str,
            'ImageID': str
        })

        # 2. Filter: Remove rows where minute_id is missing (Vectorized equivalent of your check)
        df = df.dropna(subset=['minute_id'])
        
        # 3. Rename Columns: Map CSV headers to your desired Metadata keys
        column_map = {
            'ImageID': 'image_name',
            'timeInBed': 'time_in_bed',
            # Columns that share names (e.g., 'city', 'altitude') don't need mapping
        }
        df = df.rename(columns=column_map)

        # --- TIME CONVERSION ---
        # Convert strings "2020-06-30 21:22:49" to Python datetime objects
        # errors='coerce' turns invalid strings into NaT (which we later turn to None)
        # df['utc_time'] = pd.to_datetime(df['utc_time_epoch'], errors='coerce')
        # df['local_time'] = pd.to_datetime(df['local_time_epoch'], errors='coerce')

        # 4. Enforce Data Types (Vectorized "get_float" and "clean_str")
        
        # Ensure ID is string
        df['image_name'] = df['image_name'].astype(str)

        # Force numeric columns, coercing errors to NaN
        numeric_cols = ['altitude', 'heart_rate_bpm', 'time_in_bed']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Position is converted from "lat lon" into "(lat, lon)" as required by the point data type in PostgreSQL
        df['position'] = df['position'].apply(lambda x: ast.literal_eval(f"({x.replace(' ', ',')})") if pd.notnull(x) else None) 
        df['new_position'] = df['new_position'].apply(lambda x: ast.literal_eval(f"({x.replace(' ', ',')})") if pd.notnull(x) else None) 

        def datetime_str_to_epoch(dt_str):
            """
            Convert datetime in YYYYMMDD_HHMMSS format (20190101_121948) into epoch time (int).
            """
            dt = pd.to_datetime('_'.join(dt_str.split('_')[:2]), format="%Y%m%d_%H%M%S", errors='coerce')
            return int(dt.timestamp())

        # Reconstruct utc_time_epoch from ImageID (sometimes utc_time_epoch is null)
        df['epoch'] = df['image_name'].apply(datetime_str_to_epoch)

        # Get hour id
        df['hour_id'] = df['image_name'].str[:11]

        # Get year, month, day, hour
        df['year'] = df['image_name'].str[0:4].astype(int)
        df['month'] = df['image_name'].str[4:6].astype(int)
        df['day'] = df['image_name'].str[6:8].astype(int)
        df['hour'] = df['image_name'].str[9:11].astype(int)

        # 5. Select only the columns you strictly need for metadata
        target_cols = [
            "hour_id", "minute_id", "epoch", 
            "position", "altitude", "semantic_name", 
            "heart_rate_bpm", "now_playing", 
            "sleep_level", "time_in_bed", 
            "new_position", "new_semantic_name", "original_name", 
            "categories", "movement", "city", "country", "new_timezone", 
            "image_name", "year", "month", "day", "hour"
        ]
                
        # Filter DataFrame to only these columns
        df = df[target_cols]

        # 6. Handle NaNs: Replace NaN with Python's None 
        # (Crucial because Vector Stores often crash on NaN floats in metadata)
        df = df.where(pd.notnull(df), None)

        # 7. Bulk Convert to Dictionary
        # 'records' produces: [{'minute_id': '...', 'city': '...'}, {...}]
        metadata_records = df.to_dict(orient='records')

        # 8. Generate Documents
        # List comprehensions are significantly faster than appending in a loop
        documents = [
            Document(page_content=record['image_name'], metadata=record)
            for record in tqdm(metadata_records)
        ]
        
        # Extract IDs directly
        ids = [record['image_name'] for record in metadata_records]

        return documents, ids
    
    def get_collection_element_url_from_id(self, id_str, what="images"):
        """
        Given an image name (ID), construct its URL.
        In case of LSC, if "20190101_121948_000.jpg" is the name, the relative path should be "201901/01/20190101_121948_000.jpg"
        """
        date_part = id_str.split('_')[0]
        year = date_part[:4]
        month = date_part[4:6]
        day = date_part[6:8]
        hour = id_str.split('_')[1][:2]

        # construct the base path
        base_path = self.collection_paths[what]

        if what in ["images", "thumbnails"]:
            new_name = self.old_to_new_id_map[id_str]
            path = os.path.join(base_path, f"{year}{month}{day}_{hour}", new_name)
        elif what == "videos":
            name = f"{year}{month}{day}_{hour}.mp4"
            path = os.path.join(base_path, name)
        elif what == "resized-videos-full-day":
            name = f"{year}{month}{day}.mp4"
            path = os.path.join(base_path, name)
        elif what in ["resized-videos-medium", "resized-videos-tiny"]:
            kind = "medium" if what == "resized-videos-medium" else "tiny"
            name = f"{year}{month}{day}_{hour}-{kind}.mp4"
            path = os.path.join(base_path, name)
        else:
            raise ValueError(f"Unknown collection type: {what}")

        url = self.data_server_url + '/' + path
        return url
    
    def get_retrieved_metadata_columns(self):
        # Return the list of metadata keys that will be returned from a query
        return [
            "epoch"
        ]
    
    def get_table_name(self):
        # Return the name of the database table to store LSC data
        return "lsc"
    
    def get_temporal_column(self):
        # Return the name of the temporal column to be used for time-based queries
        return "epoch"
    
    def get_temporal_groupby_column(self):
        # Return the name of the column to group by for temporal queries (e.g., hourly)
        return "hour_id"

    def get_column_schema(self):
        # --- Define Metadata Schema ---
        # This matches the dictionary keys produced by LSCLoader
        metadata_columns = [
            Column(name="minute_id", data_type="text"),
            Column(name="hour_id", data_type="text"),
            Column(name="year", data_type="integer"),
            Column(name="month", data_type="integer"),
            Column(name="day", data_type="integer"),
            Column(name="hour", data_type="integer"),
            Column(name="epoch", data_type="bigint"), 
            Column(name="position", data_type="point"),
            Column(name="altitude", data_type="float"),
            Column(name="semantic_name", data_type="text"),
            Column(name="heart_rate_bpm", data_type="float"),
            Column(name="now_playing", data_type="text"),
            Column(name="sleep_level", data_type="text"),
            Column(name="time_in_bed", data_type="float"),
            Column(name="new_position", data_type="point"),
            Column(name="new_semantic_name", data_type="text"),
            Column(name="original_name", data_type="text"),
            Column(name="categories", data_type="text"),
            Column(name="movement", data_type="text"),
            Column(name="city", data_type="text"),
            Column(name="country", data_type="text"),
            Column(name="new_timezone", data_type="text"),
            Column(name="image_name", data_type="text"),
        ]
        return metadata_columns

    def get_attribute_info(self):
        column_descriptions = {
            "minute_id": "Identifier of the minute segment that contains the image.",
            "hour_id": "Identifier of the hour segment that contains the image.",
            "year": "Four-digit year extracted from the image timestamp.",
            "month": "Month number extracted from the image timestamp.",
            # "day": "Day of month extracted from the image timestamp.",
            "hour": "Hour of day in 24-hour format extracted from the image timestamp.",
            "epoch": "Unix timestamp in seconds for the image capture time.",
            # "position": "Original geographic coordinates stored as a point.",
            "altitude": "Altitude associated with the image, as a numeric value.",
            # "semantic_name": "Original semantic place or scene label.",
            "heart_rate_bpm": "Heart rate in beats per minute.",
            # "now_playing": "Audio track playing at capture time on my mp3 player.",
            "sleep_level": "Sleep stage annotation associated with the moment.",
            "time_in_bed": "Time spent in bed, expressed as a numeric duration.",
            "new_position": "Refined geographic coordinates stored as a point.",
            # "new_semantic_name": "Refined semantic place or scene label used for textual filtering.",
            # "original_name": "Original image filename or identifier before remapping.",
            # "categories": "Category labels associated with the image.",
            # "movement": "Movement or activity label associated with the image.",
            "city": "City associated with the image.",
            "country": "Country associated with the image.",
            # "new_timezone": "Timezone associated with the image.",
            "image_name": "Image filename in the collection, typically formatted as YYYYMMDD_HHMMSS_NNN.jpg.",
        }
        type_map = {
            "text": "string",
            "integer": "integer",
            "bigint": "integer",
            "float": "float",
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
    metadata_file = "/data1/lsc-common-data/lsc22_vaisl_image_metadata.csv"
    old_new_file_mapping_csv = "/data1/lsc-collection/mapping.csv"

    collection_paths = {
        "images": "selected-frames",
        "videos": "videos",
        "resized-videos-full-day": "resized-videos/full-day-videos",
        "resized-videos-medium": "resized-videos/medium",
        "resized-videos-tiny": "resized-videos/tiny",
        "thumbnails": "thumbnails"
    }
    
    lsc = LSCLoader(data_server_url, metadata_file, collection_paths, old_new_file_mapping_csv)
    url = lsc.get_collection_element_url_from_id("20190101_121948_000.jpg")
    print(url)

    # docs, ids = lsc.generate_docs()
    
    # print(f"Generated {len(docs)} documents.")
    # if len(docs) > 0:
    #     print("Sample Doc Metadata:", docs[0].metadata)