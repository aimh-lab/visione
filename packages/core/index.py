import asyncio
import sys

import hydra
from omegaconf import DictConfig
from hydra.utils import instantiate
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def get_index_validity(conn, index_name: str):
    """
    Returns True if the index exists and is valid,
    False if it exists but is invalid,
    None if it does not exist.
    """
    result = await conn.execute(
        text(
            "SELECT indisvalid "
            "FROM pg_index "
            "JOIN pg_class ON pg_class.oid = pg_index.indexrelid "
            "WHERE pg_class.relname = :index_name"
        ),
        {"index_name": index_name},
    )
    row = result.fetchone()
    if row is None:
        return None
    return row[0]


async def run(cfg: DictConfig):
    loader = instantiate(cfg.loader, data_server_url=cfg.data.server_url)
    table_name = loader.get_table_name()

    connection_string = (
        f"postgresql+asyncpg://{cfg.database.user}:{cfg.database.password}"
        f"@{cfg.database.host}/{cfg.database.dbname}"
    )
    engine = create_async_engine(connection_string)
    # Autocommit engine for DDL statements that cannot run inside a transaction
    # (e.g. CREATE INDEX CONCURRENTLY).
    autocommit_engine = engine.execution_options(isolation_level="AUTOCOMMIT")

    # ------------------------------------------------------------------
    # 1. Create MRL generated columns
    # ------------------------------------------------------------------
    print("=== Step 1: Creating MRL generated columns ===")
    async with engine.begin() as conn:
        for model_conf in cfg.embedding.models:
            mrl_dim = model_conf.get("mrl_dim")
            if not mrl_dim:
                continue
            model_name = model_conf.name
            mrl_col = f"{model_name}_MRL{mrl_dim}"
            print(f"  Adding column '{mrl_col}' to table '{table_name}'...")
            await conn.execute(
                text(
                    f'ALTER TABLE "{table_name}" '
                    f'ADD COLUMN IF NOT EXISTS "{mrl_col}" halfvec({mrl_dim}) '
                    f'GENERATED ALWAYS AS ('
                    f'    ("{model_name}"::vector::real[])[1:{mrl_dim}]::halfvec'
                    f') STORED'
                )
            )
            print(f"  Column '{mrl_col}' ready.")

    # ------------------------------------------------------------------
    # 2. Create HNSW indexes on original embedding columns
    # ------------------------------------------------------------------
    print("=== Step 2: Creating HNSW indexes on embedding columns ===")
    async with autocommit_engine.connect() as conn:
        await conn.execute(
            text(f"SET maintenance_work_mem = '{cfg.hnsw.maintenance_work_mem}'")
        )
        for model_conf in cfg.embedding.models:
            model_name = model_conf.name
            mrl_dim = model_conf.get("mrl_dim")
            embedding_col = f"{model_name}_MRL{mrl_dim}" if mrl_dim else model_name
            index_name = f"idx_{table_name}_{embedding_col}_hnsw".lower()

            validity = await get_index_validity(conn, index_name)
            if validity is True:
                print(f"  Index '{index_name}' already exists and is valid. Skipping.")
                continue
            elif validity is False:
                print(
                    f"  Index '{index_name}' exists but is invalid. "
                    f"Dropping and re-creating..."
                )
                await conn.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))

            print(f"  Creating HNSW index '{index_name}' on column '{embedding_col}'...")
            await conn.execute(
                text(
                    f'CREATE INDEX "{index_name}" '
                    f'ON "{table_name}" '
                    f'USING hnsw ("{embedding_col}" halfvec_cosine_ops) '
                    f'WITH (m = {cfg.hnsw.m}, ef_construction = {cfg.hnsw.ef_construction})'
                )
            )

            validity = await get_index_validity(conn, index_name)
            if not validity:
                raise RuntimeError(
                    f"Index '{index_name}' is not valid after creation."
                )
            print(f"  Index '{index_name}' created and verified.")

    # ------------------------------------------------------------------
    # 3. Create temporal indexes
    # ------------------------------------------------------------------
    print("=== Step 3: Creating temporal indexes ===")
    groupby_col = loader.get_temporal_groupby_column()
    temporal_col = loader.get_temporal_column()

    # Build the list of indexes to create: always the single-column one,
    # and the composite one only when groupby_col is present.
    temporal_indexes = []
    if groupby_col:
        temporal_indexes.append(
            (
                f"idx_{table_name}_{groupby_col}_{temporal_col}_lookup".lower(),
                f'("{groupby_col}", "{temporal_col}")',
            )
        )
    temporal_indexes.append(
        (
            f"idx_{table_name}_{temporal_col}_lookup".lower(),
            f'("{temporal_col}")',
        )
    )

    async with autocommit_engine.connect() as conn:
        for index_name, columns_expr in temporal_indexes:
            validity = await get_index_validity(conn, index_name)
            if validity is True:
                print(f"  Index '{index_name}' already exists and is valid. Skipping.")
                continue
            elif validity is False:
                print(
                    f"  Index '{index_name}' exists but is invalid. "
                    f"Dropping and re-creating..."
                )
                await conn.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))

            print(f"  Creating index '{index_name}' on {columns_expr}...")
            await conn.execute(
                text(
                    f'CREATE INDEX CONCURRENTLY "{index_name}" '
                    f'ON "{table_name}" {columns_expr}'
                )
            )

            validity = await get_index_validity(conn, index_name)
            if not validity:
                raise RuntimeError(
                    f"Index '{index_name}' is not valid after creation."
                )
            print(f"  Index '{index_name}' created and verified.")

    await engine.dispose()
    print("=== Indexing complete. ===")


@hydra.main(version_base=None, config_path="configs", config_name="index")
def main(cfg: DictConfig):
    try:
        asyncio.run(run(cfg))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
