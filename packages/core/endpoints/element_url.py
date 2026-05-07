from typing import List

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel


router = APIRouter()


class ElementUrlBatchRequest(BaseModel):
    ids: List[str]
    what: List[str] = ["images"]


@router.post("/element-url")
def element_url_batch(body: ElementUrlBatchRequest, request: Request):
    """
    Given a list of element IDs and one or more element types, return for each element
    a dict with its "id" and the URLs for each requested type.
    Example body: {"ids": ["20190101_121948_000.jpg", "..."], "what": ["images", "thumbnails"]}
    """
    try:
        results = []
        for element_id in body.ids:
            entry = {"id": element_id}
            for collection_type in body.what:
                entry[collection_type] = request.app.state.loader.get_collection_element_url_from_id(element_id, collection_type)
            results.append(entry)
        return results
    except Exception as exc:
        error_str = f"URL Generation Error: {exc}"
        raise HTTPException(status_code=400, detail=error_str)
