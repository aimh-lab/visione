import time
import json
from typing import List
from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict, List, Literal, Optional, Union
from langchain_classic.chains.query_constructor.ir import StructuredQuery
from langchain_core.structured_query import Comparator, Comparison, Operation, Operator
from langchain_postgres.translator import PGVectorTranslator
from pydantic import BaseModel, Field
import numpy as np
from sklearn.svm import SVC

from utils import generate_doc_id


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

class RelevanceFeedback(BaseModel):
    positive_ids: List[str] = Field(
        default_factory=list,
        description="List of document IDs marked as relevant by the user.",
    )
    negative_ids: List[str] = Field(
        default_factory=list,
        description="List of document IDs marked as irrelevant by the user.",
    )
    model: str = Field(
        description="Optional embedding model to use for relevance feedback processing.",
    )
    method: Optional[Literal["rocchio", "svm"]] = Field(
        default="rocchio",
        description="Method to use for incorporating relevance feedback (e.g., 'rocchio', 'svm').",
    )
    num_additional_negatives: Optional[int] = Field(
        default=0,
        ge=0,
        description="Number of random negatives sampled from the vector store, excluding labeled positive/negative IDs.",
    )

class SearchRequest(BaseModel):
    query: TemporalQueryNode = Field(..., description="Structured query with 'items' and optional filters.")
    urls_to_retrieve: Optional[List[str]] = Field(
        default=None,
        description="List of element types to retrieve (e.g., ['images', 'thumbnails']).",
    )
    metadata_to_retrieve: Optional[List[str]] = Field(
        default=None,
        description="List of metadata fields to include in results (e.g., ['month', 'city']). If None, only default metadata is included.",
    )
    fetch_k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Override for the number of candidates to fetch before re-ranking (default is 10x final k, capped at 1000).",
    )
    relevance_feedback: Optional[RelevanceFeedback] = Field(
        default=None,
        description="User-provided relevance feedback for improving search results.",
    )
    reorder_by: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional reordering instructions, e.g., {'columns': ['epoch', 'day']}",
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


def _decode_embedding(raw_embedding: Any):
    if raw_embedding is None:
        return None
    if isinstance(raw_embedding, str):
        return json.loads(raw_embedding)
    return raw_embedding

def collect_features(request, rf: RelevanceFeedback, num_additional_negatives: int = 0):
    embedding_column = request.app.state.model_column_map.get(rf.get("model"))
    if rf["positive_ids"]:
        positive_features = request.app.state.vector_store.get_by_ids(ids=[generate_doc_id(pid) for pid in rf["positive_ids"]], columns_override=[embedding_column])
        positive_features = [_decode_embedding(feat.metadata.get(embedding_column)) for feat in positive_features]
        positive_features = [feature for feature in positive_features if feature is not None]
        positive_features = np.array(positive_features) if positive_features else None
    else:
        positive_features = None

    negative_features = []
    excluded_ids = {generate_doc_id(pid) for pid in rf["positive_ids"]}
    excluded_ids.update(generate_doc_id(nid) for nid in rf["negative_ids"])

    if rf["negative_ids"]:
        explicit_neg_docs = request.app.state.vector_store.get_by_ids(ids=[generate_doc_id(nid) for nid in rf["negative_ids"]], columns_override=[embedding_column])
        negative_features.extend(_decode_embedding(feat.metadata.get(embedding_column)) for feat in explicit_neg_docs)
    
    if num_additional_negatives > 0:
        random_neg_docs = request.app.state.vector_store.get_random_documents(
            limit=num_additional_negatives,
            columns_override=[embedding_column],
            exclude_ids=list(excluded_ids),
        )
        negative_features.extend(_decode_embedding(feat.metadata.get(embedding_column)) for feat in random_neg_docs)

    negative_features = [feature for feature in negative_features if feature is not None]
    negative_features = np.array(negative_features) if negative_features else None

    return positive_features, negative_features

def rocchio_relevance_feedback(positive_features, negative_features, alpha=1.0, beta=0.75, gamma=0.5):
    if positive_features is None and negative_features is None:
        raise ValueError("At least one of positive_features or negative_features must be provided.")
    
    if positive_features is not None:
        centroid_pos = np.mean(positive_features, axis=0)
    else:
        centroid_pos = 0

    if negative_features is not None:
        centroid_neg = np.mean(negative_features, axis=0)
    else:
        centroid_neg = 0

    modified_query = beta * centroid_pos - gamma * centroid_neg
    return modified_query

def svm_relevance_feedback(positive_features, negative_features):
    if positive_features is None or negative_features is None:
        raise ValueError("Both positive_features and negative_features must be provided for SVM relevance feedback.")
    
    X = np.vstack((positive_features, negative_features))
    y = np.hstack((np.ones(len(positive_features)), np.zeros(len(negative_features))))
    
    model = SVC(kernel='linear')
    model.fit(X, y)
    
    return model.coef_[0]


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
    unknown_models = [m for m in requested_models if m not in [m["name"] for m in request.app.state.available_models]]
    if unknown_models:
        raise HTTPException(status_code=400, detail=f"Unknown model(s): {sorted(set(unknown_models))}")

    default_k = int(getattr(request.app.state.config, "default_k", 100))
    final_k = int(payload.query.k or default_k)
    metadata_to_retrieve = payload.metadata_to_retrieve or []

    # Handle relevance feedback if provided
    if payload.relevance_feedback:
        rf = query_dict.pop("relevance_feedback")
        positive_features, negative_features = collect_features(
            request,
            rf,
            num_additional_negatives=rf.get("num_additional_negatives", 0),
        )
        if rf["method"] == "rocchio":
            rf_method = rocchio_relevance_feedback
        elif rf["method"] == "svm":
            rf_method = svm_relevance_feedback
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported relevance feedback method: {rf['method']}")
        
        rf_feature = rf_method(positive_features, negative_features)
        actual_query["reorder_by"] = {"embedding": rf_feature, "model": rf.get("model")}
    else:
        actual_query["reorder_by"] = query_dict.get("reorder_by", None)

    try:
        docs = request.app.state.vector_store.similarity_search(
            actual_query,
            k=final_k,
            filter=None,
            metadata_to_retrieve=metadata_to_retrieve,
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
        if payload.relevance_feedback:
            print(f"Relevance Feedback Method: {rf['method']} | Positives: {len(rf['positive_ids'])} | Negatives: {len(rf['negative_ids'])} | Additional Negatives: {rf.get('num_additional_negatives', 0)}")

        return results
    except Exception as exc:
        print(f"Search Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
