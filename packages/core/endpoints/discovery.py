from typing import List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel


class DiscoveryResponse(BaseModel):
    name: str
    metadata: List[str]
    groupby_attribute: str
    collection_items: List[str]
    available_models: List[str]


router = APIRouter()


@router.get("/discovery", response_model=DiscoveryResponse)
def discovery(request: Request):
    """
    Return collection-level information from the active loader:
    - metadata: list of available metadata field names
    - groupby_attribute: temporal grouping key
    - collection_items: available collection element types (collection_paths keys)
    - available_models: list of available embedding models (from config)
    """
    try:
        loader = request.app.state.loader

        name = loader.name
        metadata = [column.name for column in loader.get_column_schema()]
        groupby_attribute = loader.get_temporal_groupby_column()
        collection_items = list(loader.collection_paths.keys())

        return DiscoveryResponse(
            name = name,
            metadata=metadata,
            groupby_attribute=groupby_attribute,
            collection_items=collection_items,
            available_models=request.app.state.available_models,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Discovery Error: {exc}")
