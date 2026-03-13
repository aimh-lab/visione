import time
import uvicorn
import hydra
from contextlib import asynccontextmanager
from fastapi import FastAPI
from omegaconf import DictConfig
from hydra.utils import instantiate

from langchain_postgres import PGEngine

from endpoints.element_url import router as element_url_router
from endpoints.field import router as field_router
from endpoints.search import router as search_router
from pg.pg_store import PGVectorStore
from embeddings import RemoteEmbeddings

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

app.include_router(search_router)
app.include_router(element_url_router)
app.include_router(field_router)

@hydra.main(version_base=None, config_path="configs", config_name="serve")
def main(cfg: DictConfig):
    app.state.config = cfg
    uvicorn.run(app, host=cfg.host, port=cfg.port)

if __name__ == "__main__":
    main()