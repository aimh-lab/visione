import asyncio
import hashlib
import time
import asyncpg
import hydra
from omegaconf import DictConfig
from tqdm.asyncio import tqdm
from hydra.utils import instantiate

# Imports from your custom modules
from embeddings import RemoteEmbeddings
from extraction_config import resolve_extraction_specs
from pg.pg_store import PGVectorStore
from pg.pg_engine import PGEngineWithMultiVector
from utils import generate_doc_id

async def run_pipeline(cfg: DictConfig):
    # --- 1. Load Data ---
    loader = instantiate(cfg.loader, data_server_url=cfg.data.server_url)  # Pass data_server
    documents, ids = loader.generate_docs()

    table_name = loader.get_table_name()
    
    # Generate hashed IDs for database storage
    all_hashed_ids = [generate_doc_id(id_str) for id_str in ids]
    
    print(f"Loaded {len(documents)} documents.")

    # --- 2. Setup Embeddings ---
    extraction_specs = resolve_extraction_specs(cfg.loader, cfg.embedding)
    embedding_column_names = [spec.native_column for spec in extraction_specs]

    embedders = {
        spec.native_column: RemoteEmbeddings(
            embedding_server_url=cfg.embedding.server_url,
            data_server_url=cfg.data.server_url,
            data_loader=loader,
            model=spec.model,
            modality=spec.modality,
            timeout=cfg.embedding.timeout,
            max_concurrent_requests=cfg.embedding.get(
                "max_concurrent_requests", 128
            ),
        )
        for spec in extraction_specs
    }

    # --- 3. Database Connection ---
    connection_string = (
        f"postgresql+asyncpg://{cfg.database.user}:{cfg.database.password}"
        f"@{cfg.database.host}/{cfg.database.dbname}"
    )

    # --- 5. Initialize Engine & Table ---
    metadata_columns = loader.get_column_schema()
    pg_engine = PGEngineWithMultiVector.from_connection_string(url=connection_string)

    model_size_dict = {
        spec.native_column: spec.dim for spec in extraction_specs
    }

    try:
        await pg_engine.ainit_vectorstore_table(
            table_name=table_name,
            vector_size=model_size_dict, # Pass the dictionary {model_name: size}
            metadata_columns=metadata_columns,
            overwrite_existing=False
        )
        print(f"Table '{table_name}' initialized.")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"Table '{table_name}' already exists. Attempting update...")
            await pg_engine.aupdate_vectorstore_table(
                table_name=table_name,
                vector_size=model_size_dict,
                metadata_columns=metadata_columns
            )
        else:
            raise e

    vector_store = await PGVectorStore.create(
        engine=pg_engine,
        table_name=table_name,
        embedding_column=embedding_column_names,
        embedding_service=embedders,
        metadata_columns=[col.name for col in metadata_columns]
    )

    # --- 6. Check Existing IDs (Efficiently) ---
    existing_ids_set = set()
    raw_conn_string = (
        f"postgresql://{cfg.database.user}:{cfg.database.password}"
        f"@{cfg.database.host}/{cfg.database.dbname}"
    )
    
    if extraction_specs:
        print("Checking for existing documents in DB...")
        try:
            conn = await asyncpg.connect(raw_conn_string)
            
            # Build query to check if ID exists AND all specific vector columns are not null
            query = f'SELECT id FROM "{table_name}" WHERE id = ANY($1)'
            
            # Note: Assuming your custom engine uses 'id' or 'langchain_id' as primary key.
            # Standard LangChain PG uses 'id'. Adjust 'id' below if your custom engine uses 'langchain_id'.
            # Based on your previous snippet, it seemed to be 'langchain_id'.
            pk_column = "langchain_id" # or "id" depending on your implementation
            
            query = f'SELECT {pk_column} FROM "{table_name}" WHERE {pk_column} = ANY($1)'
            
            # Add checks for specific vector columns to ensure we only skip if THESE embeddings exist
            for embedding_column in embedding_column_names:
                query += f' AND "{embedding_column}" IS NOT NULL'
            
            results = await conn.fetch(query, all_hashed_ids)
            existing_ids_set = {str(row[pk_column]).replace('-', '') for row in results}
            print(f"Found {len(existing_ids_set)} existing documents in DB.")
        except Exception as e:
            print(f"Warning during ID check: {e}")
            # If check fails (e.g. table empty), assume 0 existing
            existing_ids_set = set()
        finally:
            if 'conn' in locals() and conn:
                await conn.close()
    else:
        print("No embedding models configured, skipping existing document check.")
        existing_ids_set = set()  # Treat all as new if no models configured

    # Filter documents
    # Zip docs and hashed_ids to filter together
    docs_to_process = []
    ids_to_process = []
    
    for doc, hashed_id in zip(documents, all_hashed_ids):
        if hashed_id not in existing_ids_set:
            docs_to_process.append(doc)
            ids_to_process.append(hashed_id)

    print(f"{len(docs_to_process)} new documents to process.")

    # --- 7. Processing Loop ---
    succeeded_count = 0
    failed_count = 0
    ingestion_started = time.perf_counter()
    embedding_seconds = 0.0
    persistence_seconds = 0.0
    try:
        if docs_to_process:
            batch_size = cfg.batch_size

            for i in tqdm(range(0, len(docs_to_process), batch_size), desc="Ingesting Batches"):
                batch_docs = docs_to_process[i : i + batch_size]
                batch_ids = ids_to_process[i : i + batch_size]

                try:
                    persisted_ids = await vector_store.aadd_documents(
                        documents=batch_docs,
                        ids=batch_ids
                    )
                    batch_succeeded = len(persisted_ids)
                    batch_failed = len(batch_ids) - batch_succeeded
                    succeeded_count += batch_succeeded
                    failed_count += batch_failed
                    batch_metrics = vector_store.last_ingestion_metrics
                    embedding_seconds += batch_metrics.get("embedding_seconds", 0.0)
                    persistence_seconds += batch_metrics.get(
                        "persistence_seconds", 0.0
                    )
                    if batch_failed:
                        persisted_id_set = set(persisted_ids)
                        failed_ids = [
                            document_id
                            for document_id in batch_ids
                            if document_id not in persisted_id_set
                        ]
                        print(
                            f"Batch at index {i} partially succeeded: "
                            f"{batch_succeeded} persisted, {batch_failed} failed. "
                            f"Failed IDs: {failed_ids}"
                        )
                except Exception as e:
                    failed_count += len(batch_ids)
                    print(f"Error adding batch at index {i}: {e}")
                    continue
        else:
            print("No new documents to add.")

        ingestion_seconds = time.perf_counter() - ingestion_started
        throughput = (
            succeeded_count / ingestion_seconds if ingestion_seconds > 0 else 0.0
        )
        print(
            f"Pipeline finished: {succeeded_count} documents persisted, "
            f"{failed_count} failed in {ingestion_seconds:.3f}s "
            f"({throughput:.1f} docs/s; embedding={embedding_seconds:.3f}s, "
            f"database={persistence_seconds:.3f}s)."
        )
    finally:
        await asyncio.gather(
            *(embedder.aclose() for embedder in embedders.values()),
            return_exceptions=True,
        )

@hydra.main(version_base=None, config_path="configs", config_name="load")
def main(cfg: DictConfig):
    asyncio.run(run_pipeline(cfg))

if __name__ == "__main__":
    main()