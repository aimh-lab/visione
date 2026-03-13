from typing import List

from fastapi import APIRouter, HTTPException, Query, Request

from utils import generate_doc_id


router = APIRouter()


@router.get("/field")
def metadata_field(id: str, request: Request, field: List[str] = Query(default=["epoch"])):
    """
    Given an image name (ID) and a metadata field name, return the value of that field.
    Example: /field?id=20190101_121948_000.jpg&field=hour
    """
    try:
        hashed_id = generate_doc_id(id)
        doc = request.app.state.vector_store.get_by_ids(ids=[hashed_id], columns_override=field)
        if not doc:
            raise HTTPException(status_code=404, detail=f"No record found for ID '{id}'.")
        return doc[0].metadata
    except HTTPException:
        raise
    except Exception as exc:
        error_str = f"Metadata Field Error: {exc}"
        raise HTTPException(status_code=400, detail=error_str)
