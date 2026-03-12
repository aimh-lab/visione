import time
import uvicorn
import hydra
from typing import List, Optional, Dict, Any, Union, Literal
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from omegaconf import DictConfig
from hydra.utils import instantiate

# --- LangChain Imports ---
from langchain_postgres import PGEngine
from langchain_core.structured_query import Operation, Operator, Comparison, Comparator
from langchain_postgres.translator import PGVectorTranslator
from langchain_classic.chains.query_constructor.ir import StructuredQuery

# --- Custom Imports ---
from pg.pg_store import PGVectorStore
from embeddings import RemoteEmbeddings
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
        default=None,
        description="Scalar or list of N-1 windows for this node's query list.",
    )
    also_backwards_in_time: Optional[bool] = Field(
        default=None,
        description="If true, temporal joins are evaluated in both directions.",
    )
    aggregation_type: Optional[Literal["temporal", "rrf"]] = Field(
        default="temporal",
        description="Aggregation strategy for list items: 'temporal' (default) or 'rrf'.",
    )

# --- Pydantic Models ---
class SearchRequest(BaseModel):
    query: TemporalQueryNode = Field(..., description="Structured query with 'items' and optional filters.")
    urls_to_retrieve: Optional[List[str]] = Field(
        default=None,
        description="List of element types to retrieve (e.g., ['images', 'thumbnails'])."
    )
    fetch_k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Override for the number of candidates to fetch before re-ranking (default is 10x final k, capped at 1000)."
    )

class SearchResult(BaseModel):
    metadata: Dict[str, Any]
    score: float
    id: str


if hasattr(TemporalQueryNode, "model_rebuild"):
    TemporalQueryNode.model_rebuild()
else:
    TemporalQueryNode.update_forward_refs()


def _parse_dict_to_ir(d: dict):
    """Recursively map API filter dict to LangChain IR classes."""
    if not d:
        return None
    if "operator" in d:
        return Operation(
            operator=Operator(d["operator"]),
            arguments=[_parse_dict_to_ir(arg) for arg in d["arguments"]],
        )
    return Comparison(
        comparator=Comparator(d["comparator"]),
        attribute=d["attribute"],
        value=d["value"],
    )


def build_pg_filter(filter_dict: dict):
    structured_query = StructuredQuery(
        query="",
        filter=_parse_dict_to_ir(filter_dict),
    )
    translator = PGVectorTranslator()
    _, pg_kwargs = translator.visit_structured_query(structured_query)
    return pg_kwargs["filter"]

# --- Lifecycle Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Retrieve config
    cfg = app.state.config
    print(f"--- Initializing Server Resources ---")

    # Initialize specific data loader
    loader = instantiate(cfg.loader, data_server_url=cfg.data.server_url)  # Pass data_server")
    app.state.loader = loader
    table_name = loader.get_table_name()

    # 1. Initialize Shared DB Engine
    connection_string = (
        f"postgresql+asyncpg://{cfg.database.user}:{cfg.database.password}"
        f"@{cfg.database.host}/{cfg.database.dbname}"
    )
    engine = PGEngine.from_connection_string(connection_string)
    app.state.engine = engine
    print("Database connection established.")

    # 2. Initialize one multi-model Vector Store
    embedders = {}
    model_names = []
    model_column_map = {}
    available_model_names = set()
    for model_conf in cfg.embedding.models:
        mrl_dim = model_conf.get("mrl_dim")
        if mrl_dim is None:
            mrl_dim = model_conf.get("mrl_dim_serve")

        model_name = model_conf.name
        embedding_column_name = f"{model_name}_MRL{mrl_dim}" if mrl_dim else model_name

        embedders[embedding_column_name] = RemoteEmbeddings(
            embedding_server_url=cfg.embedding.server_url,
            data_server_url=cfg.data.server_url,
            data_loader=loader,
            model=model_name,
            timeout=cfg.embedding.timeout,
            mrl_dimension=mrl_dim if mrl_dim else None,
        )
        model_names.append(embedding_column_name)
        model_column_map[model_name] = embedding_column_name
        available_model_names.add(model_name)
        available_model_names.add(embedding_column_name)

    app.state.vector_store = PGVectorStore.create_sync(
        engine=engine,
        table_name=table_name,
        embedding_service=embedders,
        embedding_column=model_names,
        model_column_map=model_column_map,
        metadata_columns=app.state.loader.get_retrieved_metadata_columns(),
        groupby_column=loader.get_temporal_groupby_column(),
        temporal_column=loader.get_temporal_column(),
    )
    app.state.available_models = sorted(available_model_names)

    print(f"Ready. Available models: {app.state.available_models}")
    yield
    print("Shutting down...")

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)

def _collect_models(node: TemporalQueryNode) -> List[str]:
    models: List[str] = []
    if node.model:
        models.append(node.model)
    if isinstance(node.item, list):
        for child in node.item:
            models.extend(_collect_models(child))
    return models


def _convert_filters_to_pg(node: Dict[str, Any]) -> Dict[str, Any]:
    converted = dict(node)
    if "filters" in converted and isinstance(converted["filters"], dict):
        converted["filters"] = build_pg_filter(converted["filters"])

    payload = converted.get("item")
    if isinstance(payload, list):
        converted["item"] = [
            _convert_filters_to_pg(child) if isinstance(child, dict) else child
            for child in payload
        ]
    return converted


@app.post("/search", response_model=List[SearchResult])
async def search_endpoint(request: SearchRequest):
    start_time = time.time()

    query_dict = (
        request.model_dump(exclude_none=True)
        if hasattr(request, "model_dump")
        else request.dict(exclude_none=True)
    )
    actual_query = query_dict.get("query")
    actual_query = _convert_filters_to_pg(actual_query)
    requested_models = _collect_models(request.query)
    unknown_models = [m for m in requested_models if m not in app.state.available_models]
    if unknown_models:
        raise HTTPException(status_code=400, detail=f"Unknown model(s): {sorted(set(unknown_models))}")

    default_k = int(getattr(app.state.config, "default_k", 100))
    final_k = int(request.query.k or default_k)

    try:
        docs = app.state.vector_store.similarity_search(
            actual_query,
            k=final_k,
            filter=None,
            fetch_k=request.fetch_k if request.fetch_k else min(final_k * 10, 1000),
        )

        urls_to_retrieve = query_dict.get("urls_to_retrieve", None)
        
        results = [
            SearchResult(
                score=doc.metadata.pop("score"),
                metadata=doc.metadata | {what: app.state.loader.get_collection_element_url_from_id(doc.page_content, what) for what in urls_to_retrieve} if urls_to_retrieve else doc.metadata,
                id=doc.page_content
            ) for doc in docs
        ]
        
        duration = time.time() - start_time
        print(f"Query: '{query_dict}' | Time: {duration:.4f}s")
        return results

    except Exception as e:
        print(f"Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/element-url")
def element_url(id: str, what: List[str] = Query(default=["images"])):
    """
    Given an image name (ID) and one or more element types, return the full URL for each type.
    Example: /element-url?id=20190101_121948_000.jpg&what=images&what=thumbnails
    """
    try:
        types = what
        if len(types) == 1 and "," in types[0]:
            types = [item.strip() for item in types[0].split(",") if item.strip()]

        urls = {
            collection_type: app.state.loader.get_collection_element_url_from_id(id, collection_type)
            for collection_type in types
        }
        return {"urls": urls}
    except Exception as e:
        error_str = f"URL Generation Error: {e}"
        raise HTTPException(status_code=400, detail=error_str)
    
@app.get("/field")
def metadata_field(id: str, field: List[str] = Query(default=["epoch"])):
    """
    Given an image name (ID) and a metadata field name, return the value of that field.
    Example: /field?id=20190101_121948_000.jpg&field=hour
    """
    try:
        hashed_id = generate_doc_id(id)
        doc = app.state.vector_store.get_by_ids(ids=[hashed_id], columns_override=field)
        if not doc:
            raise HTTPException(status_code=404, detail=f"No record found for ID '{id}'.")
        return doc[0].metadata
    
    except Exception as e:
        error_str = f"Metadata Field Error: {e}"
        raise HTTPException(status_code=400, detail=error_str)

@hydra.main(version_base=None, config_path="configs", config_name="serve")
def main(cfg: DictConfig):
    app.state.config = cfg
    uvicorn.run(app, host=cfg.host, port=cfg.port)

if __name__ == "__main__":
    main()