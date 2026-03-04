import time
import uvicorn
import hydra
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from omegaconf import DictConfig
from hydra.utils import instantiate

# --- LangChain Imports ---
from langchain_classic.retrievers import EnsembleRetriever
from langchain_postgres import PGEngine
from langchain_core.structured_query import Operation, Operator, Comparison, Comparator
from langchain_postgres.translator import PGVectorTranslator
from langchain_classic.chains.query_constructor.ir import StructuredQuery

# --- Custom Imports ---
from pg.pg_store import PGVectorStore
from embeddings import RemoteEmbeddings
from utils import generate_doc_id 

# --- Pydantic Models ---
class SearchRequest(BaseModel):
    query: Dict[str, Any] = Field(..., description="Structured query with 'items' and optional filters.")
    k: int = Field(default=100, ge=1, description="Number of results to return")
    models: Optional[List[str]] = Field(
        default=None, 
        description="List of model names to use. If None, uses all available."
    )
    # New: Dictionary for exact match filtering (e.g., {"city": "London"})
    filters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Metadata filters. Example: {'city': 'London', 'year': 2022}"
    )

class SearchResult(BaseModel):
    metadata: Dict[str, Any]
    image_id: str

def _parse_dict_to_ir(d: dict):
    """Recursively maps a dict to LangChain's IR classes."""
    if not d:
        return None
    # If it has an operator, it's an Operation node
    if "operator" in d:
        return Operation(
            operator=Operator(d["operator"]),
            arguments=[_parse_dict_to_ir(arg) for arg in d["arguments"]]
        )
    # Otherwise, it's a Comparison node
    return Comparison(
        comparator=Comparator(d["comparator"]),
        attribute=d["attribute"],
        value=d["value"]
    )

def build_pg_filter(filter_dict: dict):
    # 1. Build the StructuredQuery directly using our clean mapper
    structured_query = StructuredQuery(
        query="", 
        filter=_parse_dict_to_ir(filter_dict)
    )
    
    # 2. Translate into PGVector's expected format
    translator = PGVectorTranslator()
    _, pg_kwargs = translator.visit_structured_query(structured_query)
    
    return pg_kwargs['filter']

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

    # 2. Initialize Vector Stores (NOT Retrievers)
    app.state.vector_stores = {}
    
    for model_conf in cfg.embedding.models:
        model_name = model_conf.name
        mrl_dim = model_conf.get("mrl_dim")
        
        # Determine Embedding Column
        embedding_col = f"{model_name}_MRL{mrl_dim}" if mrl_dim else model_name
        print(f"-> Initializing VectorStore for: {model_name} (Col: {embedding_col})")

        # Embedding Service
        emb_kwargs = {
            "embedding_server_url": cfg.embedding.server_url,
            "data_server_url": cfg.data.server_url,
            "data_loader": loader,
            "model": model_name,
            "timeout": cfg.embedding.timeout,
        }
        if mrl_dim is not None:
             emb_kwargs["mrl_dimension"] = mrl_dim

        embedding_service = RemoteEmbeddings(**emb_kwargs)

        # Create/Cache Vector Store
        vs = PGVectorStore.create_sync(
            engine=engine,
            table_name=table_name,
            embedding_service=embedding_service,
            embedding_column=embedding_col,
            metadata_columns=app.state.loader.get_retrieved_metadata_columns(),
            groupby_column=loader.get_temporal_groupby_column(),
            temporal_column=loader.get_temporal_column()
        )
        app.state.vector_stores[model_name] = vs

    print(f"Ready. Available models: {list(app.state.vector_stores.keys())}")
    yield
    print("Shutting down...")

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)

@app.post("/search", response_model=List[SearchResult])
async def search_endpoint(request: SearchRequest):
    start_time = time.time()
    
    # 1. Select Models
    available_stores = app.state.vector_stores
    target_models = request.models if request.models else list(available_stores.keys())
    
    # 2. Prepare Filter (Once for all retrievers)
    pg_filter = build_pg_filter(request.filters) if request.filters else None

    # 3. Create Dynamic Retrievers
    active_retrievers = []
    for model_name in target_models:
        if model_name not in available_stores:
            raise HTTPException(status_code=400, detail=f"Model '{model_name}' unknown.")
        
        store = available_stores[model_name]
        
        # Construct search_kwargs
        search_kwargs = {'k': request.k, 'fetch_k': min(request.k * 10, 1000)}  # fetch_k can be higher for better recall
        if pg_filter:
            search_kwargs['filter'] = pg_filter
            
        retriever = store.as_retriever(search_kwargs=search_kwargs)
        active_retrievers.append(retriever)

    # 4. Create Ensemble
    if not active_retrievers:
        raise HTTPException(status_code=400, detail="No valid models selected.")

    if len(active_retrievers) > 1:
        final_retriever = EnsembleRetriever(retrievers=active_retrievers)
    else:
        final_retriever = active_retrievers[0]

    try:
        # 5. Execute Search
        docs = final_retriever.invoke(request.query)
        
        # 6. Format Response
        results = [
            SearchResult(
                metadata=doc.metadata,
                image_id=doc.page_content
            ) for doc in docs
        ]
        
        duration = time.time() - start_time
        print(f"Query: '{request.query}' | Filter: {request.filters} | Time: {duration:.4f}s")
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
    
@app.get("/metadata-field")
def metadata_field(id: str, field: List[str] = Query(default=["epoch"])):
    """
    Given an image name (ID) and a metadata field name, return the value of that field.
    Example: /metadata-field?id=20190101_121948_000.jpg&field=hour
    """
    try:
        hashed_id = generate_doc_id(id)
        doc = app.state.vector_stores[next(iter(app.state.vector_stores))].get_by_ids(ids=[hashed_id], columns_override=field)
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