from typing import List

from fastapi import APIRouter, HTTPException, Query, Request


router = APIRouter()


@router.get("/element-url")
def element_url(id: str, request: Request, what: List[str] = Query(default=["images"])):
    """
    Given an image name (ID) and one or more element types, return the full URL for each type.
    Example: /element-url?id=20190101_121948_000.jpg&what=images&what=thumbnails
    """
    try:
        types = what
        if len(types) == 1 and "," in types[0]:
            types = [item.strip() for item in types[0].split(",") if item.strip()]

        urls = {
            collection_type: request.app.state.loader.get_collection_element_url_from_id(id, collection_type)
            for collection_type in types
        }
        return {"urls": urls}
    except Exception as exc:
        error_str = f"URL Generation Error: {exc}"
        raise HTTPException(status_code=400, detail=error_str)
