import time
import uvicorn
import hydra
from contextlib import asynccontextmanager
from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
from omegaconf import DictConfig
from hydra.utils import instantiate

from langchain_postgres import PGEngine

from endpoints.discovery import router as discovery_router
from endpoints.field import router as field_router
from endpoints.llm_query import router as llm_query_router
from endpoints.qa import router as qa_router
from endpoints.search import router as search_router
from endpoints.translate import router as translate_router
from pg.pg_store import PGVectorStore
from embeddings import RemoteEmbeddings
from extraction_config import ExtractionSpec, resolve_extraction_specs
from langchain_postgres.v2.indexes import QueryOptions

class PGVectorQueryOptions(QueryOptions):
    """Base class for index query options."""

    def __init__(self, ef_search: int = 1000, iterative_scan: str = "relaxed_order",
                 max_scan_tuples: int = 150000, random_page_cost: float = 0.2):
        self.ef_search = ef_search
        self.iterative_scan = iterative_scan
        self.max_scan_tuples = max_scan_tuples
        self.random_page_cost = random_page_cost

    def to_parameter(self) -> list[str]:
        """Convert index attributes to list of configurations."""
        return [
            f"hnsw.ef_search = {self.ef_search}",
            f"hnsw.iterative_scan = {self.iterative_scan}",
            f"hnsw.max_scan_tuples = {self.max_scan_tuples}",
            f"random_page_cost = {self.random_page_cost}",
        ]
    
    def to_string(self) -> str:
        """Convert index attributes to string."""
        return f"(ef_search = {self.ef_search}, iterative_scan = {self.iterative_scan}, max_scan_tuples = {self.max_scan_tuples}, random_page_cost = {self.random_page_cost})"


def build_available_model_info(
    spec: ExtractionSpec,
    remote_model_info: dict,
) -> dict:
    """Build the collection-specific model descriptor exposed by discovery."""
    return {
        "name": spec.public_name,
        "model": spec.model,
        "modality": spec.modality,
        "modalities": list(remote_model_info.get("modalities", [])),
    }


def build_combined_model_infos(
    combined_model_configs,
    available_public_names: set[str],
) -> list[dict]:
    """Return only combined models whose child extraction IDs are available."""
    combined_model_infos = []
    for model_conf in combined_model_configs:
        missing_models = [
            model_name
            for model_name in model_conf.models
            if model_name not in available_public_names
        ]
        if missing_models:
            print(
                f"Warning: Skipping combined model '{model_conf.name}'; "
                f"missing extraction(s): {missing_models}"
            )
            continue
        combined_model_infos.append(
            {
                "name": model_conf.name,
                "modalities": list(model_conf.modalities),
            }
        )
    return combined_model_infos

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
    extraction_specs = resolve_extraction_specs(cfg.loader, cfg.embedding)
    embedders = {}
    embedding_column_names = []
    model_column_map = {}
    available_model_infos = []
    for spec in extraction_specs:
        try:
            embedder = RemoteEmbeddings(
                embedding_server_url=cfg.embedding.server_url,
                data_server_url=cfg.data.server_url,
                data_loader=loader,
                model=spec.model,
                modality=spec.modality,
                timeout=cfg.embedding.timeout,
                mrl_dimension=spec.mrl_dim,
            )
        except ValueError as exc:
            print(f"Warning: Skipping extraction '{spec.public_name}': {exc}")
            continue

        embedder_models = embedder.available_models
        entry = [m for m in embedder_models if m["name"] == spec.model]
        if len(entry) == 0:
            print(f"Warning: Model '{spec.model}' not available in embedding server. Available models: {[m['name'] for m in embedder_models]}")
            continue

        entry = entry[0]
        embedders[spec.searchable_column] = embedder
        embedding_column_names.append(spec.searchable_column)
        model_column_map[spec.public_name] = spec.searchable_column
        available_model_infos.append(build_available_model_info(spec, entry))

    index_options = PGVectorQueryOptions(
        ef_search=cfg.index_query_options.ef_search,
        iterative_scan=cfg.index_query_options.iterative_scan,
        max_scan_tuples=cfg.index_query_options.max_scan_tuples,
        random_page_cost=cfg.index_query_options.random_page_cost,
    )

    app.state.vector_store = PGVectorStore.create_sync(
        engine=engine,
        table_name=table_name,
        embedding_service=embedders,
        embedding_column=embedding_column_names,
        model_column_map=model_column_map,
        metadata_columns=app.state.loader.get_retrieved_metadata_columns(),
        groupby_column=loader.get_temporal_groupby_column(),
        temporal_column=loader.get_temporal_column(),
        index_query_options=index_options,
        fts_language=cfg.get("fts_language", "simple"),
    )

    # Add only combined models whose collection-specific children are available.
    available_model_infos.extend(
        build_combined_model_infos(
            cfg.combined_retrieval_models,
            set(model_column_map),
        )
    )

    app.state.available_models = available_model_infos
    app.state.model_column_map = model_column_map

    print(f"Ready. Available models: {app.state.available_models}")
    yield
    print("Shutting down...")

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)
# app.add_middleware(
#    CORSMiddleware,
#    allow_origins=["*"],
#    allow_methods=["*"],
#    allow_headers=["*"],
#)

app.include_router(search_router)
app.include_router(llm_query_router)
app.include_router(qa_router)
app.include_router(field_router)
app.include_router(discovery_router)
app.include_router(translate_router)

@hydra.main(version_base=None, config_path="configs", config_name="serve")
def main(cfg: DictConfig):
    app.state.config = cfg
    uvicorn.run(app, host=cfg.host, port=cfg.port)

if __name__ == "__main__":
    main()
