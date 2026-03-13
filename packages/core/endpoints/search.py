import time
from typing import List
from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict, List, Literal, Optional, Union
from langchain_classic.chains.query_constructor.ir import StructuredQuery
from langchain_core.structured_query import Comparator, Comparison, Operation, Operator
from langchain_postgres.translator import PGVectorTranslator
from pydantic import BaseModel, Field


class TemporalQueryNode(BaseModel):
    item: Union[str, List["TemporalQueryNode"]] = Field(
        ...,
        description="Leaf string query or nested list of temporal query nodes.",
    )
    model: Optional[str] = Field(
        default=None,
        description="Embedding model/column to use for this leaf query.",
    )
    k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Per-node candidate limit.",
    )
    filters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Per-node metadata filters.",
    )
    window_seconds: Optional[Union[float, List[float]]] = Field(
        default=30,
        description="Scalar or list of N-1 windows for this node's query list.",
    )
    also_backwards_in_time: Optional[bool] = Field(
        default=False,
        description="If true, temporal joins are evaluated in both directions.",
    )
    aggregation_type: Optional[Literal["temporal", "rrf"]] = Field(
        default="temporal",
        description="Aggregation strategy for list items: 'temporal' (default) or 'rrf'.",
    )


class SearchRequest(BaseModel):
    query: TemporalQueryNode = Field(..., description="Structured query with 'items' and optional filters.")
    urls_to_retrieve: Optional[List[str]] = Field(
        default=None,
        description="List of element types to retrieve (e.g., ['images', 'thumbnails']).",
    )
    fetch_k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Override for the number of candidates to fetch before re-ranking (default is 10x final k, capped at 1000).",
    )


class SearchResult(BaseModel):
    metadata: Dict[str, Any]
    score: float
    id: str


def _parse_dict_to_ir(node: dict):
    """Recursively map API filter dict to LangChain IR classes."""
    if not node:
        return None
    if "operator" in node:
        return Operation(
            operator=Operator(node["operator"]),
            arguments=[_parse_dict_to_ir(argument) for argument in node["arguments"]],
        )
    return Comparison(
        comparator=Comparator(node["comparator"]),
        attribute=node["attribute"],
        value=node["value"],
    )


def build_pg_filter(filter_dict: dict):
    structured_query = StructuredQuery(
        query="",
        filter=_parse_dict_to_ir(filter_dict),
    )
    translator = PGVectorTranslator()
    _, pg_kwargs = translator.visit_structured_query(structured_query)
    return pg_kwargs["filter"]


def collect_models(node: TemporalQueryNode) -> List[str]:
    models: List[str] = []
    if node.model:
        models.append(node.model)
    if isinstance(node.item, list):
        for child in node.item:
            models.extend(collect_models(child))
    return models


def convert_filters_to_pg(node: Dict[str, Any]) -> Dict[str, Any]:
    converted = dict(node)
    if "filters" in converted and isinstance(converted["filters"], dict):
        converted["filters"] = build_pg_filter(converted["filters"])

    payload = converted.get("item")
    if isinstance(payload, list):
        converted["item"] = [
            convert_filters_to_pg(child) if isinstance(child, dict) else child
            for child in payload
        ]
    return converted


if hasattr(TemporalQueryNode, "model_rebuild"):
    TemporalQueryNode.model_rebuild()
else:
    TemporalQueryNode.update_forward_refs()


router = APIRouter()


@router.post("/search", response_model=List[SearchResult])
async def search_endpoint(payload: SearchRequest, request: Request):
    start_time = time.time()

    query_dict = (
        payload.model_dump(exclude_none=True)
        if hasattr(payload, "model_dump")
        else payload.dict(exclude_none=True)
    )
    actual_query = query_dict.get("query")
    actual_query = convert_filters_to_pg(actual_query)
    requested_models = collect_models(payload.query)
    unknown_models = [m for m in requested_models if m not in request.app.state.available_models]
    if unknown_models:
        raise HTTPException(status_code=400, detail=f"Unknown model(s): {sorted(set(unknown_models))}")

    default_k = int(getattr(request.app.state.config, "default_k", 100))
    final_k = int(payload.query.k or default_k)

    try:
        docs = request.app.state.vector_store.similarity_search(
            actual_query,
            k=final_k,
            filter=None,
            fetch_k=payload.fetch_k if payload.fetch_k else min(final_k * 10, 1000),
        )

        urls_to_retrieve = query_dict.get("urls_to_retrieve")
        results = [
            SearchResult(
                score=doc.metadata.pop("score"),
                metadata=(
                    doc.metadata
                    | {
                        item_type: request.app.state.loader.get_collection_element_url_from_id(
                            doc.page_content,
                            item_type,
                        )
                        for item_type in urls_to_retrieve
                    }
                    if urls_to_retrieve
                    else doc.metadata
                ),
                id=doc.page_content,
            )
            for doc in docs
        ]

        duration = time.time() - start_time
        print(f"Query: '{query_dict}' | Time: {duration:.4f}s")
        return results
    except Exception as exc:
        print(f"Search Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
