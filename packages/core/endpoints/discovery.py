from typing import List, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel


class DiscoveryResponse(BaseModel):
    name: str
    default_dataserver: str
    metadata: List[str]
    groupby_attribute: str | None
    video_time_reference_attributes: Dict[str, str]
    available_models: List[Dict]


router = APIRouter()


@router.get("/discovery", response_model=DiscoveryResponse)
def discovery(request: Request):
    """
    Return collection-level information from the active loader:
    - name: name of the collection/loader
    - default_dataserver: default data server URL for this collection (can be used by clients
    - metadata: list of available metadata field names
    - groupby_attribute: temporal grouping key
    - video_time_reference_attributes: map of semantic time key ("item_time",
      "item_start_time", "item_end_time") to the metadata field name that
      carries it for this dataset (e.g. V3C: {"item_time": "start_time_seconds",
      ...}); {} for a dataset with no video concept (e.g. LSC).
    - available_models: list of available embedding models (from config)
    """
    try:
        loader = request.app.state.loader

        name = loader.name
        metadata = [column.name for column in loader.get_column_schema()]
        groupby_attribute = loader.get_temporal_groupby_column()
        video_time_reference_attributes = loader.get_video_time_reference_columns()

        return DiscoveryResponse(
            name = name,
            default_dataserver=request.app.state.config.data.server_url,
            metadata=metadata,
            groupby_attribute=groupby_attribute,
            video_time_reference_attributes=video_time_reference_attributes,
            available_models=request.app.state.available_models,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Discovery Error: {exc}")
