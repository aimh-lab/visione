from typing import List

from fastapi import APIRouter, HTTPException, Query, Request

from utils import generate_doc_id


router = APIRouter()


@router.get("/field")
def metadata_field(
    request: Request,
    id: str | None = None,
    field: List[str] = Query(default=["epoch"]),
    select_field: str | None = None,
    select_value: str | None = None,
    retrieve_field: str | None = None,
):
    """
    Two supported modes:
    1) Existing behavior: given an image ID and a metadata field list, return those metadata values.
       Example: /field?id=20190101_121948_000.jpg&field=hour
    2) Overloaded behavior: return all values from retrieve_field where select_field == select_value.
       Example: /field?select_field=hour_id&select_value=1208&retrieve_field=content
    """
    try:
        # Keep old behavior unchanged when ID is provided.
        if id is not None:
            hashed_id = generate_doc_id(id)
            doc = request.app.state.vector_store.get_by_ids(ids=[hashed_id], columns_override=field)
            if not doc:
                raise HTTPException(status_code=404, detail=f"No record found for ID '{id}'.")
            return doc[0].metadata

        # Overloaded mode requires all three parameters.
        if not (select_field and select_value is not None and retrieve_field):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Provide either 'id' (with optional 'field') or all of "
                    "'select_field', 'select_value', and 'retrieve_field'."
                ),
            )

        values = request.app.state.vector_store.get_by_field_value(
            select_field=select_field,
            select_value=_coerce_select_value(select_value),
            retrieve_field=retrieve_field,
        )
        return {retrieve_field: values}
    except HTTPException:
        raise
    except Exception as exc:
        error_str = f"Metadata Field Error: {exc}"
        raise HTTPException(status_code=400, detail=error_str)


def _coerce_select_value(value: str):
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if lowered == "null":
        return None
    # if contains alphabetic or special characters, keep as string
    if any(c.isalpha() or not c.isalnum() for c in value):
        return value
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value
