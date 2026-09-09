import math
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
):
    """
    Two supported modes:
    1) Existing behavior: given an image ID and a metadata field list, return those metadata values.
       Example: /field?id=20190101_121948_000.jpg&field=hour
     2) Overloaded behavior: return requested fields for all rows where select_field == select_value.
         Example: /field?select_field=hour_id&select_value=1208&field=content&field=epoch
    """
    try:
        # Keep old behavior unchanged when ID is provided.
        if id is not None:
            hashed_id = generate_doc_id(id)
            doc = request.app.state.vector_store.get_by_ids(ids=[hashed_id], columns_override=field)
            if not doc:
                raise HTTPException(status_code=404, detail=f"No record found for ID '{id}'.")
            return _sanitize_for_json(doc[0].metadata)

        # Overloaded mode requires select_field and select_value.
        if not (select_field and select_value is not None):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Provide either 'id' (with optional 'field') or all of "
                    "'select_field' and 'select_value' (with one or more 'field')."
                ),
            )

        rows = request.app.state.vector_store.get_by_field_value(
            select_field=select_field,
            select_value=_coerce_select_value(
                select_value,
                data_type=_get_select_field_type(request, select_field),
                field_name=select_field,
            ),
            retrieve_fields=field,
        )
        return _sanitize_for_json(rows)
    except HTTPException:
        raise
    except Exception as exc:
        error_str = f"Metadata Field Error: {exc}"
        raise HTTPException(status_code=400, detail=error_str)


def _get_select_field_type(request: Request, select_field: str) -> str | None:
    """Return the loader-declared type for a selectable database field."""
    if select_field == "content":
        return "text"

    loader = getattr(request.app.state, "loader", None)
    get_column_schema = getattr(loader, "get_column_schema", None)
    if get_column_schema is None:
        return None

    for column in get_column_schema():
        if isinstance(column, dict):
            name = column.get("name")
            data_type = column.get("data_type")
        else:
            name = getattr(column, "name", None)
            data_type = getattr(column, "data_type", None)

        if name == select_field:
            return data_type

    return None


def _coerce_select_value(
    value: str,
    *,
    data_type: str | None,
    field_name: str,
):
    """Convert a query-string value according to its declared database type."""
    if data_type is None:
        return value

    normalized_type = data_type.strip().lower()

    if normalized_type in {"smallint", "integer", "bigint"}:
        try:
            return int(value)
        except ValueError as exc:
            raise ValueError(
                f"Invalid select_value {value!r} for integer field {field_name!r}."
            ) from exc

    if normalized_type in {
        "float",
        "real",
        "double precision",
        "numeric",
        "decimal",
    }:
        try:
            return float(value)
        except ValueError as exc:
            raise ValueError(
                f"Invalid select_value {value!r} for numeric field {field_name!r}."
            ) from exc

    if normalized_type in {"bool", "boolean"}:
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        raise ValueError(
            f"Invalid select_value {value!r} for boolean field {field_name!r}; "
            "expected 'true' or 'false'."
        )

    # Text and specialized/unknown loader types are passed through unchanged.
    return value


def _sanitize_for_json(value):
    """Convert non-finite floats (NaN/Inf) to None so JSON encoding succeeds."""
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize_for_json(v) for v in value]

    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return value

    # Handle numpy/pandas scalar values that can wrap NaN/Inf.
    if hasattr(value, "item"):
        try:
            return _sanitize_for_json(value.item())
        except Exception:
            return value

    return value
