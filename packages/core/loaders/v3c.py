import itertools

import pandas as pd

from .v3c12 import V3C12Loader
from .v3c3 import V3C3Loader


class V3CLoader(V3C12Loader):
    """Combined V3C1+2 and V3C3 loader exposed as one V3C collection."""

    def __init__(
        self,
        name,
        data_server_url,
        v3c12_root_folder,
        v3c3_root_folder,
        v3c12_video_root_folder=None,
        extraction=None,
        debug=False,
    ):
        self.name = name
        self.debug = debug
        self.data_server_url = data_server_url
        self.extraction = extraction or []
        self.v3c12 = V3C12Loader(
            name=name,
            data_server_url=data_server_url,
            v3c_root_folder=v3c12_root_folder,
            video_root_folder=v3c12_video_root_folder,
            extraction=self.extraction,
            debug=debug,
        )
        self.v3c3 = V3C3Loader(
            name=name,
            data_server_url=data_server_url,
            v3c_root_folder=v3c3_root_folder,
            extraction=self.extraction,
            debug=debug,
        )
        self._v3c12_row_count = len(self.v3c12.metadata_df)
        self.metadata_df = pd.concat(
            [self.v3c12.metadata_df, self.v3c3.metadata_df],
            ignore_index=True,
            copy=False,
        )
        self.v3c12.metadata_df = self.metadata_df.iloc[: self._v3c12_row_count]
        self.v3c3.metadata_df = self.metadata_df.iloc[self._v3c12_row_count :]

    def iter_media_resources(self):
        split = self._v3c12_row_count
        return itertools.chain(
            self.v3c12.iter_media_resources(self.metadata_df.iloc[:split]),
            self.v3c3.iter_media_resources(self.metadata_df.iloc[split:]),
        )

    def get_media_resource_count(self):
        split = self._v3c12_row_count
        return self.v3c12.get_media_resource_count(
            self.metadata_df.iloc[:split]
        ) + self.v3c3.get_media_resource_count(self.metadata_df.iloc[split:])

    def get_table_name(self):
        return "v3c"
