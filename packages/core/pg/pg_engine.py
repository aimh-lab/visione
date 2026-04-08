import asyncio
from dataclasses import dataclass
from threading import Thread
from typing import Any, Awaitable, Optional, TypedDict, TypeVar, Union, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from langchain_postgres.v2.hybrid_search_config import HybridSearchConfig
from langchain_postgres.v2.engine import Column, ColumnDict
from langchain_postgres import PGEngine

class PGEngineWithMultiVector(PGEngine):
    def __init__(
        self,
        key: object,
        pool: AsyncEngine,
        loop: Optional[asyncio.AbstractEventLoop],
        thread: Optional[Thread],
    ) -> None:
        super().__init__(key, pool, loop, thread)

    async def _ainit_vectorstore_table(
        self,
        table_name: str,
        vector_size: Union[int, Dict[str, int]],  # CHANGED: Supports int or dict
        *,
        schema_name: str = "public",
        content_column: str = "content",
        embedding_column: str = "embedding",      # Used only if vector_size is int
        metadata_columns: Optional[list[Union[Column, ColumnDict]]] = None,
        metadata_json_column: str = "langchain_metadata",
        id_column: Union[str, Column, ColumnDict] = "langchain_id",
        overwrite_existing: bool = False,
        store_metadata: bool = True,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
    ) -> None:
        """
        Create a table for saving of vectors to be used with PGVectorStore.
        Supports multiple vector embedding columns.
        """

        # 1. Normalize Vector Columns Configuration
        # If user passes an int, use the default embedding_column name.
        # If user passes a dict, use that mapping: { "col_name": 1536, "col_name_2": 768 }
        vector_columns_map = {}
        if isinstance(vector_size, int):
            vector_columns_map[embedding_column] = vector_size
        elif isinstance(vector_size, dict):
            vector_columns_map = vector_size
        else:
            raise ValueError("vector_size must be an integer or a dictionary of {column_name: size}")

        # Escape basic identifiers
        schema_name = self._escape_postgres_identifier(schema_name)
        table_name = self._escape_postgres_identifier(table_name)
        content_column = self._escape_postgres_identifier(content_column)
        
        # (Note: We do NOT escape embedding_column here immediately because 
        # we need to iterate over vector_columns_map keys and escape them individually)

        # Validate Metadata columns
        if metadata_columns is None:
            metadata_columns = []
        else:
            for col in metadata_columns:
                if isinstance(col, Column):
                    col.name = self._escape_postgres_identifier(col.name)
                elif isinstance(col, dict):
                    self._validate_column_dict(col)
                    col["name"] = self._escape_postgres_identifier(col["name"])

        # Validate ID column
        if isinstance(id_column, str):
            id_column = self._escape_postgres_identifier(id_column)
        elif isinstance(id_column, Column):
            id_column.name = self._escape_postgres_identifier(id_column.name)
        else:
            self._validate_column_dict(id_column)
            id_column["name"] = self._escape_postgres_identifier(id_column["name"])

        # Ensure PGVector extension exists
        async with self._pool.connect() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.commit()

        # Drop existing table if requested
        if overwrite_existing:
            async with self._pool.connect() as conn:
                await conn.execute(
                    text(f'DROP TABLE IF EXISTS "{schema_name}"."{table_name}"')
                )
                await conn.commit()

        # Determine ID column details
        if isinstance(id_column, str):
            id_data_type = "UUID"
            id_column_name = id_column
        elif isinstance(id_column, Column):
            id_data_type = id_column.data_type
            id_column_name = id_column.name
        else:
            id_data_type = id_column["data_type"]
            id_column_name = id_column["name"]

        # Configure Hybrid Search
        hybrid_search_default_column_name = content_column + "_tsv"
        hybrid_search_column = "" 
        if hybrid_search_config:
            hybrid_search_column_name = (
                hybrid_search_config.tsv_column or hybrid_search_default_column_name
            )
            hybrid_search_column_name = self._escape_postgres_identifier(
                hybrid_search_column_name
            )
            hybrid_search_config.tsv_column = hybrid_search_column_name
            hybrid_search_column = f',"{self._escape_postgres_identifier(hybrid_search_column_name)}" TSVECTOR NOT NULL'

        # 2. Build the Create Table Query
        query = f"""CREATE TABLE "{schema_name}"."{table_name}"(
            "{id_column_name}" {id_data_type} PRIMARY KEY,
            "{content_column}" TEXT NOT NULL"""

        # Dynamically append all vector columns
        for col_name, v_size in vector_columns_map.items():
            safe_col_name = self._escape_postgres_identifier(col_name)
            query += f',\n        "{safe_col_name}" halfvec({v_size})'

        # Append hybrid search column if exists
        query += f"""
            {hybrid_search_column}"""

        # Append Metadata columns
        for column in metadata_columns:
            if isinstance(column, Column):
                nullable = "NOT NULL" if not column.nullable else ""
                query += f',\n"{column.name}" {column.data_type} {nullable}'
            elif isinstance(column, dict):
                nullable = "NOT NULL" if not column["nullable"] else ""
                query += f',\n"{column["name"]}" {column["data_type"]} {nullable}'

        # Append JSON Metadata
        if store_metadata:
            query += f""",\n"{metadata_json_column}" JSON"""
        
        query += "\n);"

        async with self._pool.connect() as conn:
            await conn.execute(text(query))
            await conn.commit()

    async def ainit_vectorstore_table(
        self,
        table_name: str,
        vector_size: Union[int, Dict[str, int]], # CHANGED Type Hint
        *,
        schema_name: str = "public",
        content_column: str = "content",
        embedding_column: str = "embedding",
        metadata_columns: Optional[list[Union[Column, ColumnDict]]] = None,
        metadata_json_column: str = "langchain_metadata",
        id_column: Union[str, Column, ColumnDict] = "langchain_id",
        overwrite_existing: bool = False,
        store_metadata: bool = True,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
    ) -> None:
        """
        Public wrapper for _ainit_vectorstore_table.
        Pass `vector_size` as a dictionary {name: size} to create multiple vector columns.
        """
        await self._run_as_async(
            self._ainit_vectorstore_table(
                table_name,
                vector_size,
                schema_name=schema_name,
                content_column=content_column,
                embedding_column=embedding_column,
                metadata_columns=metadata_columns,
                metadata_json_column=metadata_json_column,
                id_column=id_column,
                overwrite_existing=overwrite_existing,
                store_metadata=store_metadata,
                hybrid_search_config=hybrid_search_config,
            )
        )

    async def _aupdate_vectorstore_table(
        self,
        table_name: str,
        vector_size: Optional[Union[int, Dict[str, int]]] = None,
        *,
        metadata_columns: Optional[list[Union[Column, ColumnDict]]] = None,
        schema_name: str = "public",
        embedding_column: str = "embedding",
    ) -> None:
        """
        Add new vector and/or metadata column(s) to an existing table.
        
        Args:
            vector_size: Optional single integer (uses embedding_column name) OR
                         dictionary mapping column names to vector sizes.
        """
        # 1. Normalize Vector Columns Configuration
        vector_columns_map = {}
        if vector_size is None:
            vector_columns_map = {}
        elif isinstance(vector_size, int):
            vector_columns_map[embedding_column] = vector_size
        elif isinstance(vector_size, dict):
            vector_columns_map = vector_size
        else:
            raise ValueError(
                "vector_size must be None, an integer, or a dictionary of {column_name: size}"
            )

        # Escape Table/Schema Identifiers
        safe_schema = self._escape_postgres_identifier(schema_name)
        safe_table = self._escape_postgres_identifier(table_name)

        # Validate/escape metadata columns when provided.
        if metadata_columns is not None:
            for col in metadata_columns:
                if isinstance(col, Column):
                    col.name = self._escape_postgres_identifier(col.name)
                elif isinstance(col, dict):
                    self._validate_column_dict(col)
                    col["name"] = self._escape_postgres_identifier(col["name"])

        # 2. Build the ALTER TABLE Query
        # We start with the base command
        query = f'ALTER TABLE "{safe_schema}"."{safe_table}" \n'
        
        add_column_clauses = []
        for col_name, v_size in vector_columns_map.items():
            safe_col = self._escape_postgres_identifier(col_name)
            # We use IF NOT EXISTS to be safe. 
            # Columns are added as NULLable so they work with existing data.
            add_column_clauses.append(f'ADD COLUMN IF NOT EXISTS "{safe_col}" halfvec({v_size})')

        # Add metadata columns that are not already present.
        if metadata_columns is not None:
            for column in metadata_columns:
                if isinstance(column, Column):
                    nullable = "NOT NULL" if not column.nullable else ""
                    add_column_clauses.append(
                        f'ADD COLUMN IF NOT EXISTS "{column.name}" {column.data_type} {nullable}'.strip()
                    )
                elif isinstance(column, dict):
                    nullable = "NOT NULL" if not column["nullable"] else ""
                    add_column_clauses.append(
                        f'ADD COLUMN IF NOT EXISTS "{column["name"]}" {column["data_type"]} {nullable}'.strip()
                    )

        if not add_column_clauses:
            return

        # Join clauses with commas for a single atomic statement
        query += ",\n".join(add_column_clauses) + ";"

        async with self._pool.connect() as conn:
            await conn.execute(text(query))
            await conn.commit()

    async def aupdate_vectorstore_table(
        self,
        table_name: str,
        vector_size: Optional[Union[int, Dict[str, int]]] = None,
        metadata_columns: Optional[list[Union[Column, ColumnDict]]] = None,
        *,
        schema_name: str = "public",
        embedding_column: str = "embedding",
    ) -> None:
        """
        Add new vector and/or metadata column(s) to an existing table.

        Args:
            table_name (str): The database table name.
            vector_size (Optional[Union[int, Dict[str, int]]]):
                - If int: Adds a single column named `embedding_column`.
                - If dict: Adds multiple columns based on keys/values.
                - If None: no vector columns are added (metadata-only update).
            schema_name (str): The schema name. Default: "public".
            embedding_column (str): Name used only if vector_size is an int. Default: "embedding".
        """
        await self._run_as_async(
            self._aupdate_vectorstore_table(
                table_name,
                vector_size,
                schema_name=schema_name,
                embedding_column=embedding_column,
                metadata_columns=metadata_columns
            )
        )