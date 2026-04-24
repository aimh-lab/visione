# TODO: Remove below import when minimum supported Python version is 3.10
from __future__ import annotations

import copy
import json
import uuid
from typing import Any, Callable, Iterable, Optional, Sequence, Union, List, Dict

import numpy as np
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStore, utils
from sqlalchemy import RowMapping, text
from sqlalchemy.ext.asyncio import AsyncEngine

from langchain_postgres.v2.engine import PGEngine
from langchain_postgres.v2.hybrid_search_config import HybridSearchConfig
from langchain_postgres.v2.indexes import (
    DEFAULT_DISTANCE_STRATEGY,
    DEFAULT_INDEX_NAME_SUFFIX,
    BaseIndex,
    DistanceStrategy,
    ExactNearestNeighbor,
    QueryOptions,
)

COMPARISONS_TO_NATIVE = {
    "$eq": "=",
    "$ne": "!=",
    "$lt": "<",
    "$lte": "<=",
    "$gt": ">",
    "$gte": ">=",
}

SPECIAL_CASED_OPERATORS = {
    "$in",
    "$nin",
    "$between",
    "$exists",
}

TEXT_OPERATORS = {
    "$like",
    "$ilike",
}

LOGICAL_OPERATORS = {"$and", "$or", "$not"}

SUPPORTED_OPERATORS = (
    set(COMPARISONS_TO_NATIVE)
    .union(TEXT_OPERATORS)
    .union(LOGICAL_OPERATORS)
    .union(SPECIAL_CASED_OPERATORS)
)


class AsyncPGVectorStore(VectorStore):
    """Postgres Vector Store class"""

    __create_key = object()

    def __init__(
        self,
        key: object,
        engine: AsyncEngine,
        embedding_service: Union[Embeddings, Dict[str, Embeddings]],
        table_name: str,
        *,
        schema_name: str = "public",
        content_column: str = "content",
        embedding_column: Union[str, List[str]] = "embedding",
        metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: Optional[str] = "langchain_metadata",
        distance_strategy: DistanceStrategy = DEFAULT_DISTANCE_STRATEGY,
        k: int = 4,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        index_query_options: Optional[QueryOptions] = None,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
        groupby_column: Optional[str] = None,
        temporal_column: str = "epoch",
        model_column_map: Optional[Dict[str, str]] = None,
    ):
        """AsyncPGVectorStore constructor.
        Args:
            key (object): Prevent direct constructor usage.
            engine (PGEngine): Connection pool engine for managing connections to postgres database.
            embedding_service (Embeddings): Text embedding model to use.
            table_name (str): Name of the existing table or the table to be created.
            schema_name (str, optional): Name of the database schema. Defaults to "public".
            content_column (str): Column that represent a Document's page_content. Defaults to "content".
            embedding_column (str): Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
            metadata_columns (list[str]): Column(s) that represent a document's metadata.
            id_column (str): Column that represents the Document's id. Defaults to "langchain_id".
            metadata_json_column (str): Column to store metadata as JSON. Defaults to "langchain_metadata".
            distance_strategy (DistanceStrategy): Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
            k (int): Number of Documents to return from search. Defaults to 4.
            fetch_k (int): Number of Documents to fetch to pass to MMR algorithm.
            lambda_mult (float): Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
            index_query_options (QueryOptions): Index query option.
            hybrid_search_config (HybridSearchConfig): Hybrid search configuration. Defaults to None.


        Raises:
            Exception: If called directly by user.
        """
        if key != AsyncPGVectorStore.__create_key:
            raise Exception(
                "Only create class through 'create' or 'create_sync' methods!"
            )

        self.engine = engine
        self.embedding_service = embedding_service
        self.table_name = table_name
        self.schema_name = schema_name
        self.content_column = content_column
        # Handle embedding_column: can be None, empty list, single string, or list of strings
        if embedding_column is None or (isinstance(embedding_column, list) and len(embedding_column) == 0):
            self.embedding_columns = []
            self.embedding_column = None
        elif isinstance(embedding_column, list):
            self.embedding_columns = embedding_column
            self.embedding_column = embedding_column[0]
        else:
            self.embedding_columns = [embedding_column]
            self.embedding_column = embedding_column

        if isinstance(self.embedding_service, dict):
            missing_columns = [
                col for col in self.embedding_service.keys() if col not in self.embedding_columns
            ]
            if missing_columns:
                raise ValueError(
                    f"Embedding service keys {missing_columns} are not present in embedding columns {self.embedding_columns}."
                )
        self.metadata_columns = metadata_columns if metadata_columns is not None else []
        self.id_column = id_column
        self.metadata_json_column = metadata_json_column
        self.distance_strategy = distance_strategy
        self.k = k
        self.fetch_k = fetch_k
        self.lambda_mult = lambda_mult
        self.index_query_options = index_query_options
        self.hybrid_search_config = hybrid_search_config
        self.groupby_column = groupby_column
        self.temporal_column = temporal_column
        self.model_column_map = model_column_map or {}

    @classmethod
    async def create(
        cls: type[AsyncPGVectorStore],
        engine: PGEngine,
        embedding_service: Union[Embeddings, Dict[str, Embeddings]],
        table_name: str,
        *,
        schema_name: str = "public",
        content_column: str = "content",
        embedding_column: Union[str, List[str]] = "embedding",
        metadata_columns: Optional[list[str]] = None,
        ignore_metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: Optional[str] = "langchain_metadata",
        distance_strategy: DistanceStrategy = DEFAULT_DISTANCE_STRATEGY,
        k: int = 4,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        index_query_options: Optional[QueryOptions] = None,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
        groupby_column: Optional[str] = None,
        temporal_column: str = "epoch",
        model_column_map: Optional[Dict[str, str]] = None,
    ) -> AsyncPGVectorStore:
        """Create an AsyncPGVectorStore instance.

        Args:
            engine (PGEngine): Connection pool engine for managing connections to postgres database.
            embedding_service (Embeddings): Text embedding model to use.
            table_name (str): Name of an existing table.
            schema_name (str, optional): Name of the database schema. Defaults to "public".
            content_column (str): Column that represent a Document's page_content. Defaults to "content".
            embedding_column (str): Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
            metadata_columns (list[str]): Column(s) that represent a document's metadata.
            ignore_metadata_columns (list[str]): Column(s) to ignore in pre-existing tables for a document's metadata. Can not be used with metadata_columns. Defaults to None.
            id_column (str): Column that represents the Document's id. Defaults to "langchain_id".
            metadata_json_column (str): Column to store metadata as JSON. Defaults to "langchain_metadata".
            distance_strategy (DistanceStrategy): Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
            k (int): Number of Documents to return from search. Defaults to 4.
            fetch_k (int): Number of Documents to fetch to pass to MMR algorithm.
            lambda_mult (float): Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
            index_query_options (QueryOptions): Index query option.
            hybrid_search_config (HybridSearchConfig): Hybrid search configuration. Defaults to None.

        Returns:
            AsyncPGVectorStore
        """

        if metadata_columns is None:
            metadata_columns = []

        if metadata_columns and ignore_metadata_columns:
            raise ValueError(
                "Can not use both metadata_columns and ignore_metadata_columns."
            )
        # Get field type information
        stmt = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :table_name AND table_schema = :schema_name"
        async with engine._pool.connect() as conn:
            result = await conn.execute(
                text(stmt),
                {"table_name": table_name, "schema_name": schema_name},
            )
            result_map = result.mappings()
            results = result_map.fetchall()
        columns = {}
        for field in results:
            columns[field["column_name"]] = field["data_type"]

        # Check columns
        if id_column not in columns:
            raise ValueError(f"Id column, {id_column}, does not exist.")
        if content_column not in columns:
            raise ValueError(f"Content column, {content_column}, does not exist.")
        content_type = columns[content_column]
        if content_type != "text" and "char" not in content_type:
            raise ValueError(
                f"Content column, {content_column}, is type, {content_type}. It must be a type of character string."
            )
        if hybrid_search_config:
            tsv_column_name = (
                hybrid_search_config.tsv_column
                if hybrid_search_config.tsv_column
                else content_column + "_tsv"
            )
            if tsv_column_name not in columns or columns[tsv_column_name] != "tsvector":
                # mark tsv_column as empty because there is no TSV column in table
                hybrid_search_config.tsv_column = ""
        normalized_embedding_columns = (
            [embedding_column] if isinstance(embedding_column, str) else (embedding_column or [])
        )
        # Allow empty embedding columns for metadata-only updates

        for emb_col in normalized_embedding_columns:
            if emb_col not in columns:
                raise ValueError(f"Embedding column, {emb_col}, does not exist.")
            if columns[emb_col] not in ["USER-DEFINED", "vector"]:
                raise ValueError(
                    f"Embedding column, {emb_col}, is not type Vector."
                )

        metadata_json_column = (
            None if metadata_json_column not in columns else metadata_json_column
        )

        # If using metadata_columns check to make sure column exists
        for column in metadata_columns:
            if column not in columns:
                raise ValueError(f"Metadata column, {column}, does not exist.")

        # If using ignore_metadata_columns, filter out known columns and set known metadata columns
        all_columns = columns
        if ignore_metadata_columns:
            for column in ignore_metadata_columns:
                del all_columns[column]

            del all_columns[id_column]
            del all_columns[content_column]
            for emb_col in normalized_embedding_columns:
                del all_columns[emb_col]
            metadata_columns = [k for k in all_columns.keys()]

        return cls(
            cls.__create_key,
            engine._pool,
            embedding_service,
            table_name,
            schema_name=schema_name,
            content_column=content_column,
            embedding_column=normalized_embedding_columns,
            metadata_columns=metadata_columns,
            id_column=id_column,
            metadata_json_column=metadata_json_column,
            distance_strategy=distance_strategy,
            k=k,
            fetch_k=fetch_k,
            lambda_mult=lambda_mult,
            index_query_options=index_query_options,
            hybrid_search_config=hybrid_search_config,
            groupby_column=groupby_column,
            temporal_column=temporal_column,
            model_column_map=model_column_map,
        )

    @property
    def embeddings(self) -> Union[Embeddings, Dict[str, Embeddings]]:
        return self.embedding_service

    def _resolve_embedding_backend(
        self,
        model: Optional[str] = None,
        embedding_column: Optional[str] = None,
    ) -> tuple[str, Embeddings]:
        selected_column = embedding_column or model
        if model and not embedding_column and model in self.model_column_map:
            selected_column = self.model_column_map[model]

        if isinstance(self.embedding_service, dict):
            if selected_column is None:
                selected_column = self.embedding_column
            if selected_column not in self.embedding_service:
                raise ValueError(
                    f"Unknown model/embedding column '{selected_column}'. Available: {list(self.embedding_service.keys())}"
                )
            return selected_column, self.embedding_service[selected_column]

        if selected_column is None:
            selected_column = self.embedding_column
        if selected_column not in self.embedding_columns:
            raise ValueError(
                f"Unknown embedding column '{selected_column}'. Available: {self.embedding_columns}"
            )
        return selected_column, self.embedding_service

    async def _get_query_embedding_expression(
        self,
        query_text: str,
        embedder: Embeddings,
        param_prefix: str,
    ) -> tuple[str, dict[str, Any]]:
        inline_embed_func = getattr(embedder, "embed_query_inline", None)
        if callable(inline_embed_func):
            return embedder.embed_query_inline(query_text), {}

        vector = await embedder.aembed_query(query_text)
        param_name = f"{param_prefix}_query_embedding"
        return f":{param_name}", {param_name: f"{[float(dimension) for dimension in vector]}"}

    async def aadd_embeddings(
        self,
        texts: Iterable[str],
        ids: Optional[list],
        embeddings: Optional[Union[List[List[float]], List[Dict[str, List[float]]]]] = None,
        metadatas: Optional[list[dict]] = None,
        **kwargs: Any,
    ) -> list[str]:
        """
        Add data to the table. 
        If 'embeddings' are not provided, they will be generated using self.embedding_service.
        """
        text_list = list(texts)
        num_texts = len(text_list)

        if not ids:
            ids = [str(uuid.uuid4()) for _ in range(num_texts)]
        else:
            ids = [id if id is not None else str(uuid.uuid4()) for id in ids]
        
        if not metadatas:
            metadatas = [{} for _ in range(num_texts)]

        # --- Check if embeddings are configured ---
        has_embedding_columns = self.embedding_columns and len(self.embedding_columns) > 0

        # --- 1. Normalize & Initialize Embeddings ---
        # We want a List[Dict[str, Any]] structure.
        
        if not has_embedding_columns or embeddings is None:
            # Start empty, we will fill it below if needed
            normalized_embeddings = [{} for _ in range(num_texts)]
        elif len(embeddings) > 0 and isinstance(embeddings[0], list):
            # Legacy: List[float] provided -> Map to default column
            normalized_embeddings = [{self.embedding_column: vec} for vec in embeddings]
        else:
            # Already List[Dict], assume valid
            normalized_embeddings = embeddings # type: ignore

        # --- 2. Generate Missing Embeddings (Batch Processing) ---
        # We do this OUTSIDE the DB loop for performance (batching).
        # Skip if no embedding columns are configured.
        
        if has_embedding_columns and isinstance(self.embedding_service, dict):
            for col_name, embedder in self.embedding_service.items():
                
                # A. Check if this column is already provided in the input
                # (We check the first element to decide for the batch)
                if normalized_embeddings and col_name in normalized_embeddings[0]:
                    continue

                # B. Check if this is an "Inline" embedder (DB-side)
                # If so, we SKIP generation here; it is handled in the SQL loop below.
                if callable(getattr(embedder, "embed_query_inline", None)):
                    continue

                # C. Generate Python-side
                # This fills in the gaps for columns that weren't passed in but are configured
                col_vectors = await embedder.aembed_documents(text_list)
                
                for i, vector in enumerate(col_vectors):
                    normalized_embeddings[i][col_name] = vector

        # Legacy fallback (if embedding_service is just a single object)
        elif has_embedding_columns and self.embedding_service and not normalized_embeddings[0].get(self.embedding_column):
             if not callable(getattr(self.embedding_service, "embed_query_inline", None)):
                 vecs = await self.embedding_service.aembed_documents(text_list)
                 for i, v in enumerate(vecs):
                     normalized_embeddings[i][self.embedding_column] = v

        # --- 3. Database Insertion Loop ---
        
        for id, content, embedding_dict, metadata in zip(ids, text_list, normalized_embeddings, metadatas):
            
            # --- Prepare SQL Parts ---
            embedding_col_names_str = ""
            embedding_placeholders_str = ""
            
            values = {
                "langchain_id": id,
                "content": content,
            }

            # 3a. Add Computed/Provided Embeddings
            for col_name, vector in embedding_dict.items():
                safe_col = f'"{col_name}"'
                embedding_col_names_str += f', {safe_col}'
                values[col_name] = str([float(dimension) for dimension in vector])
                embedding_placeholders_str += f", :{col_name}"

            # 3b. Handle Inline Embeddings (SQL-side generation)
            # We look at the service definition again to see if anything is still missing
            # which might be an inline embedder.
            # Skip if no embedding columns are configured.
            if has_embedding_columns and isinstance(self.embedding_service, dict):
                for col_name, embedder in self.embedding_service.items():
                    if col_name not in embedding_dict:
                        inline_func = getattr(embedder, "embed_query_inline", None)
                        if callable(inline_func):
                            embedding_col_names_str += f', "{col_name}"'
                            embedding_placeholders_str += f", {inline_func(content)}"
            elif has_embedding_columns and self.embedding_service:
                # Legacy single service inline check
                inline_func = getattr(self.embedding_service, "embed_query_inline", None)
                if self.embedding_column not in embedding_dict and callable(inline_func):
                    embedding_col_names_str += f', "{self.embedding_column}"'
                    embedding_placeholders_str += f", {inline_func(content)}" # type: ignore

            # Metadata Columns
            metadata_col_names = (
                ", " + ", ".join(f'"{col}"' for col in self.metadata_columns)
                if len(self.metadata_columns) > 0
                else ""
            )
            
            # Hybrid Search
            hybrid_search_column_name = ""
            if self.hybrid_search_config and self.hybrid_search_config.tsv_column:
                hybrid_search_column_name = f', "{self.hybrid_search_config.tsv_column}"'

            # --- Construct Statements ---
            insert_stmt = (
                f'INSERT INTO "{self.schema_name}"."{self.table_name}"'
                f'("{self.id_column}", "{self.content_column}"{embedding_col_names_str}{hybrid_search_column_name}{metadata_col_names}'
            )

            values_stmt = f"VALUES (:langchain_id, :content{embedding_placeholders_str}"

            if self.hybrid_search_config and self.hybrid_search_config.tsv_column:
                lang = (
                    f"'{self.hybrid_search_config.tsv_lang}',"
                    if self.hybrid_search_config.tsv_lang
                    else ""
                )
                values_stmt += f", to_tsvector({lang} :tsv_content)"
                values["tsv_content"] = content

            # Metadata
            extra = copy.deepcopy(metadata)
            for metadata_column in self.metadata_columns:
                if metadata_column in metadata:
                    values_stmt += f", :{metadata_column}"
                    values[metadata_column] = metadata[metadata_column]
                    del extra[metadata_column]
                else:
                    values_stmt += ", null"

            if self.metadata_json_column:
                insert_stmt += f', "{self.metadata_json_column}")'
                values_stmt += ", :extra)"
                values["extra"] = json.dumps(extra)
            else:
                insert_stmt += ")"
                values_stmt += ")"

            # --- Construct UPSERT ---
            upsert_stmt = (
                f' ON CONFLICT ("{self.id_column}") DO UPDATE SET '
                f'"{self.content_column}" = EXCLUDED."{self.content_column}"'
            )

            # Update existing columns (both computed and inline)
            # We iterate the SERVICE config to ensure we cover everything, 
            # regardless of whether it came from python or SQL inline.
            # Skip embedding columns if none are configured.
            if has_embedding_columns:
                if isinstance(self.embedding_service, dict):
                    for col_name in self.embedding_service.keys():
                        # Only upsert columns that were actually part of the insert logic
                        # (i.e., either in embedding_dict OR handled by inline check)
                        # A simple way is to just blindly add them if they exist in schema,
                        # but here we can assume if they are in service, they are in schema.
                        upsert_stmt += f', "{col_name}" = EXCLUDED."{col_name}"'
                elif self.embedding_column:
                    upsert_stmt += f', "{self.embedding_column}" = EXCLUDED."{self.embedding_column}"'

            if self.hybrid_search_config and self.hybrid_search_config.tsv_column:
                upsert_stmt += f', "{self.hybrid_search_config.tsv_column}" = EXCLUDED."{self.hybrid_search_config.tsv_column}"'

            if self.metadata_json_column:
                upsert_stmt += f', "{self.metadata_json_column}" = EXCLUDED."{self.metadata_json_column}"'

            for column in self.metadata_columns:
                upsert_stmt += f', "{column}" = EXCLUDED."{column}"'

            upsert_stmt += ";"

            query = insert_stmt + values_stmt + upsert_stmt
            
            async with self.engine.connect() as conn:
                await conn.execute(text(query), values)
                await conn.commit()

        return ids

    async def aadd_texts(
        self,
        texts: Iterable[str],
        metadatas: Optional[list[dict]] = None,
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> list[str]:
        """Embed texts and add to the table."""
        # Just delegate to aadd_embeddings with no pre-computed embeddings
        return await self.aadd_embeddings(
            texts, embeddings=None, metadatas=metadatas, ids=ids, **kwargs
        )

    async def aadd_documents(
        self,
        documents: list[Document],
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> list[str]:
        """Embed documents and add to the table.

        Raises:
            :class:`InvalidTextRepresentationError <asyncpg.exceptions.InvalidTextRepresentationError>`: if the `ids` data type does not match that of the `id_column`.
        """
        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        if not ids:
            ids = [doc.id for doc in documents]
        ids = await self.aadd_texts(texts, metadatas=metadatas, ids=ids, **kwargs)
        return ids

    async def adelete(
        self,
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> Optional[bool]:
        """Delete records from the table.

        Raises:
            :class:`InvalidTextRepresentationError <asyncpg.exceptions.InvalidTextRepresentationError>`: if the `ids` data type does not match that of the `id_column`.
        """
        if not ids:
            return False

        placeholders = ", ".join(f":id_{i}" for i in range(len(ids)))
        param_dict = {f"id_{i}": id for i, id in enumerate(ids)}
        query = f'DELETE FROM "{self.schema_name}"."{self.table_name}" WHERE {self.id_column} in ({placeholders})'
        async with self.engine.connect() as conn:
            await conn.execute(text(query), param_dict)
            await conn.commit()
        return True

    @classmethod
    async def afrom_texts(  # type: ignore[override]
        cls: type[AsyncPGVectorStore],
        texts: list[str],
        embedding: Embeddings,
        engine: PGEngine,
        table_name: str,
        *,
        schema_name: str = "public",
        metadatas: Optional[list[dict]] = None,
        ids: Optional[list] = None,
        content_column: str = "content",
        embedding_column: str = "embedding",
        metadata_columns: Optional[list[str]] = None,
        ignore_metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: str = "langchain_metadata",
        distance_strategy: DistanceStrategy = DEFAULT_DISTANCE_STRATEGY,
        k: int = 4,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        index_query_options: Optional[QueryOptions] = None,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
        groupby_column: Optional[str] = None,
        temporal_column: str = "epoch",
        **kwargs: Any,
    ) -> AsyncPGVectorStore:
        """Create an AsyncPGVectorStore instance from texts.

        Args:
            texts (list[str]): Texts to add to the vector store.
            embedding (Embeddings): Text embedding model to use.
            engine (PGEngine): Connection pool engine for managing connections to postgres database.
            table_name (str): Name of an existing table.
            metadatas (Optional[list[dict]]): List of metadatas to add to table records.
            ids: (Optional[list[str]]): List of IDs to add to table records.
            content_column (str): Column that represent a Document's page_content. Defaults to "content".
            embedding_column (str): Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
            metadata_columns (list[str]): Column(s) that represent a document's metadata.
            ignore_metadata_columns (list[str]): Column(s) to ignore in pre-existing tables for a document's metadata. Can not be used with metadata_columns. Defaults to None.
            id_column (str): Column that represents the Document's id. Defaults to "langchain_id".
            metadata_json_column (str): Column to store metadata as JSON. Defaults to "langchain_metadata".
            distance_strategy (DistanceStrategy): Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
            k (int): Number of Documents to return from search. Defaults to 4.
            fetch_k (int): Number of Documents to fetch to pass to MMR algorithm.
            lambda_mult (float): Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
            index_query_options (QueryOptions): Index query option.

        Raises:
            :class:`InvalidTextRepresentationError <asyncpg.exceptions.InvalidTextRepresentationError>`: if the `ids` data type does not match that of the `id_column`.

        Returns:
            AsyncPGVectorStore
        """
        vs = await cls.create(
            engine,
            embedding,
            table_name,
            schema_name=schema_name,
            content_column=content_column,
            embedding_column=embedding_column,
            metadata_columns=metadata_columns,
            ignore_metadata_columns=ignore_metadata_columns,
            id_column=id_column,
            metadata_json_column=metadata_json_column,
            distance_strategy=distance_strategy,
            k=k,
            fetch_k=fetch_k,
            lambda_mult=lambda_mult,
            index_query_options=index_query_options,
            hybrid_search_config=hybrid_search_config,
            groupby_column=groupby_column,
            temporal_column=temporal_column,
        )
        await vs.aadd_texts(texts, metadatas=metadatas, ids=ids, **kwargs)
        return vs

    @classmethod
    async def afrom_documents(  # type: ignore[override]
        cls: type[AsyncPGVectorStore],
        documents: list[Document],
        embedding: Embeddings,
        engine: PGEngine,
        table_name: str,
        *,
        schema_name: str = "public",
        ids: Optional[list] = None,
        content_column: str = "content",
        embedding_column: str = "embedding",
        metadata_columns: Optional[list[str]] = None,
        ignore_metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: str = "langchain_metadata",
        distance_strategy: DistanceStrategy = DEFAULT_DISTANCE_STRATEGY,
        k: int = 4,
        fetch_k: int = 20,
        lambda_mult: float = 0.5,
        index_query_options: Optional[QueryOptions] = None,
        hybrid_search_config: Optional[HybridSearchConfig] = None,
        groupby_column: Optional[str] = None,
        temporal_column: str = "epoch",
        **kwargs: Any,
    ) -> AsyncPGVectorStore:
        """Create an AsyncPGVectorStore instance from documents.

        Args:
            documents (list[Document]): Documents to add to the vector store.
            embedding (Embeddings): Text embedding model to use.
            engine (PGEngine): Connection pool engine for managing connections to postgres database.
            table_name (str): Name of an existing table.
            metadatas (Optional[list[dict]]): List of metadatas to add to table records.
            ids: (Optional[list[str]]): List of IDs to add to table records.
            content_column (str): Column that represent a Document's page_content. Defaults to "content".
            embedding_column (str): Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
            metadata_columns (list[str]): Column(s) that represent a document's metadata.
            ignore_metadata_columns (list[str]): Column(s) to ignore in pre-existing tables for a document's metadata. Can not be used with metadata_columns. Defaults to None.
            id_column (str): Column that represents the Document's id. Defaults to "langchain_id".
            metadata_json_column (str): Column to store metadata as JSON. Defaults to "langchain_metadata".
            distance_strategy (DistanceStrategy): Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
            k (int): Number of Documents to return from search. Defaults to 4.
            fetch_k (int): Number of Documents to fetch to pass to MMR algorithm.
            lambda_mult (float): Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
            index_query_options (QueryOptions): Index query option.

        Raises:
            :class:`InvalidTextRepresentationError <asyncpg.exceptions.InvalidTextRepresentationError>`: if the `ids` data type does not match that of the `id_column`.

        Returns:
            AsyncPGVectorStore
        """

        vs = await cls.create(
            engine,
            embedding,
            table_name,
            schema_name=schema_name,
            content_column=content_column,
            embedding_column=embedding_column,
            metadata_columns=metadata_columns,
            ignore_metadata_columns=ignore_metadata_columns,
            id_column=id_column,
            metadata_json_column=metadata_json_column,
            distance_strategy=distance_strategy,
            k=k,
            fetch_k=fetch_k,
            lambda_mult=lambda_mult,
            index_query_options=index_query_options,
            hybrid_search_config=hybrid_search_config,
            groupby_column=groupby_column,
            temporal_column=temporal_column,
        )
        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        await vs.aadd_texts(texts, metadatas=metadatas, ids=ids, **kwargs)
        return vs

    async def __query_collection(
        self,
        embedding: list[float],
        *,
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> Sequence[RowMapping]:
        """
        Perform similarity search (or hybrid search) query on database.
        Queries might be slow if the hybrid search column does not exist.
        For best hybrid search performance, consider creating a TSV column
        and adding GIN index.
        """
        hybrid_search_config = kwargs.get(
            "hybrid_search_config", self.hybrid_search_config
        )

        final_k = k if k is not None else self.k

        dense_limit = final_k
        if hybrid_search_config:
            dense_limit = hybrid_search_config.primary_top_k

        operator = self.distance_strategy.operator
        search_function = self.distance_strategy.search_function

        selected_embedding_column, selected_embedder = self._resolve_embedding_backend(
            model=kwargs.get("model"),
            embedding_column=kwargs.get("embedding_column"),
        )

        additional_metadata_columns = kwargs.get("metadata_to_retrieve", [])
        metadata_columns = list(set(self.metadata_columns + additional_metadata_columns))

        columns = [
            self.id_column,
            self.content_column,
            selected_embedding_column,
        ] + metadata_columns
        if self.metadata_json_column:
            columns.append(self.metadata_json_column)

        column_names = ", ".join(f'"{col}"' for col in columns)

        safe_filter = None
        filter_dict = None
        if filter and isinstance(filter, dict):
            safe_filter, filter_dict = self._create_filter_clause(filter)

        inline_embed_func = getattr(selected_embedder, "embed_query_inline", None)
        if not embedding and callable(inline_embed_func) and "query" in kwargs:
            query_embedding = selected_embedder.embed_query_inline(kwargs["query"])  # type: ignore
            embedding_data_string = f"{query_embedding}"
        else:
            query_embedding = f"{[float(dimension) for dimension in embedding]}"
            embedding_data_string = ":query_embedding"
        where_filters = f"WHERE {safe_filter}" if safe_filter else ""
        dense_query_stmt = f"""SELECT {column_names}, {search_function}("{selected_embedding_column}", {embedding_data_string}) as distance
        FROM "{self.schema_name}"."{self.table_name}" {where_filters} ORDER BY "{selected_embedding_column}" {operator} {embedding_data_string} LIMIT :dense_limit;
        """
        param_dict = {"query_embedding": query_embedding, "dense_limit": dense_limit}
        if filter_dict:
            param_dict.update(filter_dict)
        if self.index_query_options:
            async with self.engine.connect() as conn:
                # Set each query option individually
                for query_option in self.index_query_options.to_parameter():
                    query_options_stmt = f"SET LOCAL {query_option};"
                    await conn.execute(text(query_options_stmt))
                result = await conn.execute(text(dense_query_stmt), param_dict)
                result_map = result.mappings()
                dense_results = result_map.fetchall()
        else:
            async with self.engine.connect() as conn:
                result = await conn.execute(text(dense_query_stmt), param_dict)
                result_map = result.mappings()
                dense_results = result_map.fetchall()

        fts_query = (
            hybrid_search_config.fts_query
            if hybrid_search_config and hybrid_search_config.fts_query
            else kwargs.get("fts_query", "")
        )
        if hybrid_search_config and fts_query:
            hybrid_search_config.fusion_function_parameters["fetch_top_k"] = final_k
            # do the sparse query
            lang = (
                f"'{hybrid_search_config.tsv_lang}',"
                if hybrid_search_config.tsv_lang
                else ""
            )
            query_tsv = f"plainto_tsquery({lang} :fts_query)"
            param_dict["fts_query"] = fts_query
            if hybrid_search_config.tsv_column:
                content_tsv = f'"{hybrid_search_config.tsv_column}"'
            else:
                content_tsv = f'to_tsvector({lang} "{self.content_column}")'
            and_filters = f"AND ({safe_filter})" if safe_filter else ""
            sparse_query_stmt = f'SELECT {column_names}, ts_rank_cd({content_tsv}, {query_tsv}) as distance FROM "{self.schema_name}"."{self.table_name}" WHERE {content_tsv} @@ {query_tsv} {and_filters}  ORDER BY distance desc LIMIT {hybrid_search_config.secondary_top_k};'
            async with self.engine.connect() as conn:
                result = await conn.execute(text(sparse_query_stmt), param_dict)
                result_map = result.mappings()
                sparse_results = result_map.fetchall()

            combined_results = hybrid_search_config.fusion_function(
                dense_results,
                sparse_results,
                **hybrid_search_config.fusion_function_parameters,
                distance_strategy=self.distance_strategy,
            )
            return combined_results
        return dense_results

    async def asimilarity_search(
        self,
        query: Any,
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[list[Document]]:
        """Return docs selected by similarity search on query.

        Returns a list of result groups. Each group is a list of Documents:
        - Simple / RRF queries: each group has exactly one Document.
        - Temporal queries: each group may contain multiple Documents.
        """

        if isinstance(query, str):
            query = {"item": query}

        if not isinstance(query, dict):
            raise ValueError("Query must be a dictionary.")
        if (
            "item" not in query
            and "items" not in query
            and "text" not in query
            and "query" in query
        ):
            query = {**query, "item": query.get("query")}

        return await self._atemporal_join_search(
            query=query,
            k=k,
            filter=filter,
            **kwargs,
        )

    async def _atemporal_join_search(
        self,
        query: dict[str, Any],
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[list[Document]]:
        """Perform similarity search with optional temporal/RRF aggregation.

        Returns a list of result groups. Each group is a list of Documents:
        - For simple / RRF queries: each group has exactly one Document.
        - For temporal queries: each group contains one Document per
          temporal step that satisfied the constraints (deduplicated so
          that a frame matching with itself appears only once).
        """
        query_payload = query.get(
            "item", query.get("items", query.get("text", query.get("query")))
        )

        groupby_column = self.groupby_column
        temporal_column = self.temporal_column
        if groupby_column is not None and (
            not isinstance(groupby_column, str) or not groupby_column.isidentifier()
        ):
            raise ValueError("Temporal query 'groupby' must be a valid SQL identifier.")
        if not isinstance(temporal_column, str) or not temporal_column.isidentifier():
            raise ValueError(
                "Temporal query 'temporal_column' must be a valid SQL identifier."
            )

        final_k = k if k is not None else int(query.get("k", self.k))
        hybrid_search_config = kwargs.get("hybrid_search_config", self.hybrid_search_config)
        candidate_limit = int(kwargs.get("candidate_limit", 100000))
        dense_limit = (
            hybrid_search_config.primary_top_k if hybrid_search_config else final_k
        )

        operator = self.distance_strategy.operator
        search_function = self.distance_strategy.search_function
        full_table_name = f'"{self.schema_name}"."{self.table_name}"'

        additional_metadata_columns = kwargs.get("metadata_to_retrieve", [])
        metadata_columns = list(set(self.metadata_columns + additional_metadata_columns))

        base_columns = [
            self.id_column,
            self.content_column,
        ] + metadata_columns
        if self.metadata_json_column:
            base_columns.append(self.metadata_json_column)

        cte_statements: list[str] = []
        params: dict[str, Any] = {}
        node_counter = 0

        def _as_node(node_like: Any) -> dict[str, Any]:
            if isinstance(node_like, str):
                return {"item": node_like}
            if not isinstance(node_like, dict):
                raise ValueError("Each temporal query item must be a string or object.")

            node_copy = dict(node_like)
            node_copy["item"] = node_copy.get(
                "item",
                node_copy.get("items", node_copy.get("text", node_copy.get("query"))),
            )
            if isinstance(node_copy["item"], list):
                if len(node_copy["item"]) == 1 and isinstance(node_copy["item"][0], str):
                    node_copy["item"] = node_copy["item"][0]
                elif len(node_copy["item"]) == 0:
                    node_copy["item"] = None
            return node_copy

        def _normalize_windows(raw_window: Any, count: int) -> list[float]:
            if isinstance(raw_window, list):
                if len(raw_window) != count:
                    raise ValueError(
                        f"window_seconds must have {count} items for a query list of length {count + 1}."
                    )
                return [float(w) for w in raw_window]
            return [float(raw_window)] * count

        def _normalize_aggregation_type(raw: Any) -> str:
            if raw is None:
                return "temporal"
            if isinstance(raw, str) and raw.lower() in {"temporal", "rrf"}:
                return raw.lower()
            raise ValueError("aggregation_type must be either 'temporal' or 'rrf'.")

        def _merge_filters(global_filter: Optional[dict], leaf_filter: Any) -> Optional[dict]:
            if global_filter and leaf_filter:
                return {"$and": [global_filter, leaf_filter]}
            return leaf_filter or global_filter

        def _resolve_filter(node: dict) -> str:
            """Return a SQL WHERE clause (or empty string) and update `params`."""
            local = _merge_filters(filter, node.get("filters"))
            if not local:
                return ""
            clause, clause_params = self._create_filter_clause(local)
            params.update(clause_params)
            return f"WHERE {clause}"

        base_cols_sql = ", ".join(f'b."{c}"' for c in base_columns)
        groupby_select = (
            f'b."{groupby_column}" AS groupby_value'
            if groupby_column
            else "NULL AS groupby_value"
        )

        # -----------------------------------------------------------------
        # _build_cte returns (cte_name, is_temporal).
        # is_temporal=True means the CTE only has id_chain arrays
        # that grow with each temporal join step.
        # -----------------------------------------------------------------
        async def _build_cte(node_like: Any, *, is_root: bool = False) -> tuple[str, bool]:
            nonlocal node_counter
            node = _as_node(node_like)
            payload = node.get("item")
            node_name = f"q_{node_counter}"
            node_counter += 1

            safe_filter = _resolve_filter(node)

            # ── Filter-only leaf (no embedding search) ──────────────────
            if payload is None or (isinstance(payload, str) and not payload.strip()):
                cte_statements.append(
                    f"""
                    {node_name} AS (
                        SELECT
                            {base_cols_sql},
                            b."{temporal_column}" AS start_time,
                            b."{temporal_column}" AS end_time,
                            {groupby_select},
                            1.0 AS score,
                            ARRAY[b."{self.id_column}"::text] AS id_chain
                        FROM {full_table_name} b
                        {safe_filter}
                    )
                    """.strip()
                )
                return node_name, False

            # ── Semantic leaf ───────────────────────────────────────────
            if isinstance(payload, str):
                selected_model, selected_embedder = self._resolve_embedding_backend(
                    model=node.get("model"),
                    embedding_column=node.get("embedding_column"),
                )
                embedding_expr, emb_params = await self._get_query_embedding_expression(
                    query_text=payload.strip(),
                    embedder=selected_embedder,
                    param_prefix=node_name,
                )
                params.update(emb_params)

                leaf_limit_name = f"{node_name}_k"
                params[leaf_limit_name] = int(node.get("k", candidate_limit))

                if is_root:
                    score_expr = (
                        f'(1.0 - {search_function}(b."{selected_model}", {embedding_expr}))'
                        if search_function == "cosine_distance"
                        else f'(1.0 / (1.0 + {search_function}(b."{selected_model}", {embedding_expr})))'
                    )
                else:
                    score_expr = (
                        f'(100.0 / (ROW_NUMBER() OVER '
                        f'(ORDER BY b."{selected_model}" {operator} {embedding_expr}) + 100.0))'
                    )

                cte_statements.append(
                    f"""
                    {node_name} AS (
                        SELECT
                            {base_cols_sql},
                            b."{temporal_column}" AS start_time,
                            b."{temporal_column}" AS end_time,
                            {groupby_select},
                            {score_expr} AS score,
                            ARRAY[b."{self.id_column}"::text] AS id_chain
                        FROM {full_table_name} b
                        {safe_filter}
                        ORDER BY b."{selected_model}" {operator} {embedding_expr}
                        LIMIT :{leaf_limit_name}
                    )
                    """.strip()
                )
                return node_name, False

            # ── Aggregation node (list of ≥ 2 children) ────────────────
            if not isinstance(payload, list) or len(payload) < 2:
                raise ValueError("Temporal query nodes must contain at least two child queries.")

            child_results = [await _build_cte(child) for child in payload]
            child_ctes = [name for name, _ in child_results]

            aggregation_type = _normalize_aggregation_type(node.get("aggregation_type"))

            # Temporal results cannot be further aggregated.
            if any(is_t for _, is_t in child_results):
                raise ValueError(
                    "Temporal aggregation cannot be a child of another aggregation node."
                )

            # ── RRF aggregation ─────────────────────────────────────────
            if aggregation_type == "rrf":
                current = child_ctes[0]
                for idx in range(1, len(child_ctes)):
                    right = child_ctes[idx]
                    jn = f"q_{node_counter}"
                    node_counter += 1
                    jlp = f"{jn}_k"
                    params[jlp] = int(node.get("k", candidate_limit))

                    cte_statements.append(
                        f"""
                        {jn} AS (
                            SELECT
                                COALESCE(l."{self.id_column}", r."{self.id_column}") AS "{self.id_column}",
                                LEAST(COALESCE(l.start_time, r.start_time),
                                      COALESCE(r.start_time, l.start_time)) AS start_time,
                                GREATEST(COALESCE(l.end_time, r.end_time),
                                         COALESCE(r.end_time, l.end_time)) AS end_time,
                                COALESCE(l.groupby_value, r.groupby_value) AS groupby_value,
                                (COALESCE(l.score, 0.0) + COALESCE(r.score, 0.0)) AS score,
                                COALESCE(l.id_chain, r.id_chain) AS id_chain
                            FROM {current} l
                            FULL OUTER JOIN {right} r
                              ON l."{self.id_column}" = r."{self.id_column}"
                            ORDER BY score DESC
                            LIMIT :{jlp}
                        )
                        """.strip()
                    )
                    current = jn

                agg = f"q_{node_counter}"
                node_counter += 1
                alp = f"{agg}_k"
                params[alp] = int(node.get("k", dense_limit))

                cte_statements.append(
                    f"""
                    {agg} AS (
                        SELECT
                            s."{self.id_column}",
                            s.start_time, s.end_time, s.groupby_value,
                            s.score, s.id_chain
                        FROM {current} s
                        ORDER BY s.score DESC
                        LIMIT :{alp}
                    )
                    """.strip()
                )
                return agg, False

            # ── Temporal aggregation ────────────────────────────────────
            windows = _normalize_windows(node.get("window_seconds", 30.0), len(child_ctes) - 1)
            also_backwards = bool(node.get("also_backwards_in_time", False))

            current = child_ctes[0]
            for idx in range(1, len(child_ctes)):
                right = child_ctes[idx]
                jn = f"q_{node_counter}"
                node_counter += 1
                wp = f"{jn}_window"
                jlp = f"{jn}_k"
                params[wp] = windows[idx - 1]
                params[jlp] = int(node.get("k", dense_limit))

                join_conds = []
                if groupby_column:
                    join_conds.append("l.groupby_value = r.groupby_value")
                join_conds.append(
                    f"r.start_time BETWEEN (l.end_time - :{wp}) AND (l.end_time + :{wp})"
                    if also_backwards
                    else f"r.start_time BETWEEN l.end_time AND (l.end_time + :{wp})"
                )

                cte_statements.append(
                    f"""
                    {jn} AS (
                        SELECT
                            l.id_chain || r.id_chain AS id_chain,
                            l.start_time AS start_time,
                            r.end_time AS end_time,
                            COALESCE(l.groupby_value, r.groupby_value) AS groupby_value,
                            (l.score + r.score) AS score
                        FROM {current} l
                        JOIN {right} r
                          ON {' AND '.join(join_conds)}
                        ORDER BY score DESC
                        LIMIT :{jlp}
                    )
                    """.strip()
                )
                current = jn

            return current, True

        # ── Build the CTE tree ──────────────────────────────────────────
        root_cte, is_temporal = await _build_cte({"item": query_payload, **query}, is_root=True)
        params["final_limit"] = dense_limit

        # ── Shared execution helper ─────────────────────────────────────
        async def _execute(sql_str: str) -> list[RowMapping]:
            sql_obj = text(sql_str)
            async with self.engine.connect() as conn:
                if self.index_query_options is not None:
                    for opt in self.index_query_options.to_parameter():
                        await conn.execute(text(f"SET LOCAL {opt};"))
                if kwargs.get("explain_analyze", False):
                    ea = (await conn.execute(
                        text("EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) " + sql_str),
                        params,
                    )).fetchall()
                    print("EXPLAIN ANALYZE:")
                    for r in ea:
                        print(r[0])
                    if kwargs.get("explain_analyze_only", False):
                        return []
                return (await conn.execute(sql_obj, params)).mappings().fetchall()

        def _row_to_doc(row: RowMapping, score: float) -> Document:
            meta = (
                dict(row[self.metadata_json_column])
                if self.metadata_json_column and row.get(self.metadata_json_column)
                else {}
            )
            for col in metadata_columns:
                meta[col] = row[col]
            meta["score"] = score
            return Document(
                page_content=row[self.content_column],
                metadata=meta,
                id=str(row[self.id_column]),
            )

        # ── Parse reorder_by (shared validation + parameter setup) ──────
        reorder_by = query.get("reorder_by")
        _rb_sel_col: Optional[str] = None
        _rb_cols: Optional[list] = None
        if isinstance(reorder_by, dict):
            has_embedding = reorder_by.get("embedding") is not None
            has_columns = reorder_by.get("columns") is not None
            if has_embedding and has_columns:
                raise ValueError(
                    "reorder_by cannot contain both 'embedding' and 'columns'."
                )
            if has_embedding:
                _rb_sel_col, _ = self._resolve_embedding_backend(
                    model=reorder_by.get("model"),
                    embedding_column=reorder_by.get("embedding_column"),
                )
                raw = reorder_by["embedding"]
                if isinstance(raw, np.ndarray):
                    vec = raw.astype(float).ravel().tolist()
                elif isinstance(raw, str):
                    vec = json.loads(raw)
                else:
                    vec = list(raw)
                if not vec:
                    raise ValueError("reorder_by.embedding must be a non-empty vector.")
                params["reorder_query_embedding"] = f"{[float(d) for d in vec]}"
            elif has_columns:
                _rb_cols = reorder_by["columns"]
                if not isinstance(_rb_cols, list) or not _rb_cols:
                    raise ValueError("reorder_by.columns must be a non-empty list.")
                for c in _rb_cols:
                    if not isinstance(c, str) or not c.isidentifier():
                        raise ValueError(f"Invalid reorder column: '{c}'.")

        joined = ",\n".join(cte_statements)

        # ================================================================
        # Non-temporal fast path (simple leaf / RRF)
        # ================================================================
        # The root CTE already carries all base columns; a plain DISTINCT ON
        # (id_column) is far cheaper than the array UNNEST/ARRAY_AGG pipeline
        # that temporal results require.
        if not is_temporal:
            # Always JOIN back to the base table so that the full row data
            # (content, metadata, temporal_column, …) is available even when
            # the root CTE is a stripped RRF aggregation that carries only
            # id / score / start_time / end_time / groupby_value / id_chain.
            extra_join = ""
            reorder_clause = "score DESC"
            if _rb_sel_col is not None:
                extra_join = (
                    f'JOIN {full_table_name} b_reorder '
                    f'ON b_reorder."{self.id_column}" = d."{self.id_column}"'
                )
                reorder_clause = f'b_reorder."{_rb_sel_col}" {operator} :reorder_query_embedding'
            elif _rb_cols is not None:
                extra_join = (
                    f'JOIN {full_table_name} b_reorder '
                    f'ON b_reorder."{self.id_column}" = d."{self.id_column}"'
                )
                reorder_clause = ", ".join(f'b_reorder."{c}"' for c in reversed(_rb_cols))

            rows = await _execute(f"""
                WITH
                {joined},
                deduped AS (
                    SELECT DISTINCT ON ("{self.id_column}") "{self.id_column}", score
                    FROM {root_cte}
                    ORDER BY "{self.id_column}", score DESC
                )
                SELECT d.score, {base_cols_sql}
                FROM deduped d
                JOIN {full_table_name} b ON b."{self.id_column}" = d."{self.id_column}"
                {extra_join}
                ORDER BY {reorder_clause}
                LIMIT :final_limit
            """)
            return [[_row_to_doc(row, float(row["score"]))] for row in rows]

        # ================================================================
        # Temporal result path — chain expansion
        # ================================================================
        reorder_extra_cte = ""
        reorder_order = "uc._score DESC"
        chain_cte = "_unique"
        if _rb_sel_col is not None:
            reorder_extra_cte = (
                f",\n            _reordered AS (\n"
                f"                SELECT u._rk, u._score, u._chain,\n"
                f"                       {search_function}(b_ro.\"{_rb_sel_col}\", :reorder_query_embedding) AS _reorder_dist\n"
                f"                FROM _unique u\n"
                f"                JOIN {full_table_name} b_ro\n"
                f"                  ON b_ro.\"{self.id_column}\"::text = u._chain[1]\n"
                f"            )"
            )
            chain_cte = "_reordered"
            reorder_order = "uc._reorder_dist ASC"
        elif _rb_cols is not None:
            ro_cols_select = ", ".join(f'b_ro."{c}" AS _ro_{c}' for c in _rb_cols)
            reorder_extra_cte = (
                f",\n            _reordered AS (\n"
                f"                SELECT u._rk, u._score, u._chain,\n"
                f"                       {ro_cols_select}\n"
                f"                FROM _unique u\n"
                f"                JOIN {full_table_name} b_ro\n"
                f"                  ON b_ro.\"{self.id_column}\"::text = u._chain[1]\n"
                f"            )"
            )
            chain_cte = "_reordered"
            reorder_order = ", ".join(f'uc._ro_{c}' for c in reversed(_rb_cols))

        rows = await _execute(f"""
            WITH
            {joined},
            _ranked AS (
                SELECT ROW_NUMBER() OVER (ORDER BY score DESC) AS _rk,
                       id_chain, score
                FROM {root_cte}
                LIMIT :final_limit
            ),
            _expanded AS (
                SELECT r._rk, r.score AS _score,
                       u.val AS _mid, u.ord AS _ord
                FROM _ranked r,
                LATERAL UNNEST(r.id_chain) WITH ORDINALITY AS u(val, ord)
            ),
            _deduped AS (
                SELECT DISTINCT ON (_rk, _mid) _rk, _score, _mid, _ord
                FROM _expanded
                ORDER BY _rk, _mid, _ord
            ),
            _chains AS (
                SELECT _rk, _score,
                       ARRAY_AGG(_mid ORDER BY _ord) AS _chain
                FROM _deduped
                GROUP BY _rk, _score
            ),
            _unique AS (
                SELECT DISTINCT ON (_chain) _rk, _score, _chain
                FROM _chains
                ORDER BY _chain, _score DESC
            ){reorder_extra_cte}
            SELECT uc._rk, uc._score,
                   {base_cols_sql}
            FROM {chain_cte} uc,
            LATERAL UNNEST(uc._chain) WITH ORDINALITY AS m(val, ord)
            JOIN {full_table_name} b
              ON b."{self.id_column}"::text = m.val
            ORDER BY {reorder_order}, uc._rk, m.ord
        """)

        results: list[list[Document]] = []
        current_rk: Any = None
        group: list[Document] = []
        for row in rows:
            if row["_rk"] != current_rk:
                if group:
                    results.append(group)
                group = []
                current_rk = row["_rk"]
            group.append(_row_to_doc(row, float(row["_score"])))
        if group:
            results.append(group)
        return results

    def _select_relevance_score_fn(self) -> Callable[[float], float]:
        """Select a relevance function based on distance strategy."""
        # Calculate distance strategy provided in
        # vectorstore constructor
        if self.distance_strategy == DistanceStrategy.COSINE_DISTANCE:
            return self._cosine_relevance_score_fn
        if self.distance_strategy == DistanceStrategy.INNER_PRODUCT:
            return self._max_inner_product_relevance_score_fn
        elif self.distance_strategy == DistanceStrategy.EUCLIDEAN:
            return self._euclidean_relevance_score_fn

    async def asimilarity_search_with_score(
        self,
        query: str,
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        """Return docs and distance scores selected by similarity search on query."""
        selected_model, selected_embedder = self._resolve_embedding_backend(
            model=kwargs.get("model"),
            embedding_column=kwargs.get("embedding_column"),
        )
        inline_embed_func = getattr(selected_embedder, "embed_query_inline", None)
        embedding = (
            []
            if callable(inline_embed_func)
            else await selected_embedder.aembed_query(text=query)
        )
        kwargs["query"] = query
        kwargs["model"] = selected_model

        # add fts_query to hybrid_search_config
        hybrid_search_config = kwargs.get(
            "hybrid_search_config", self.hybrid_search_config
        )
        if hybrid_search_config and not hybrid_search_config.fts_query:
            hybrid_search_config.fts_query = query
            kwargs["hybrid_search_config"] = hybrid_search_config

        docs = await self.asimilarity_search_with_score_by_vector(
            embedding=embedding, k=k, filter=filter, **kwargs
        )
        return docs

    async def asimilarity_search_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        """Return docs selected by vector similarity search."""
        docs_and_scores = await self.asimilarity_search_with_score_by_vector(
            embedding=embedding, k=k, filter=filter, **kwargs
        )

        return [doc for doc, _ in docs_and_scores]

    async def asimilarity_search_with_score_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        """Return docs and distance scores selected by vector similarity search."""
        results = await self.__query_collection(
            embedding=embedding, k=k, filter=filter, **kwargs
        )

        additional_metadata_columns = kwargs.get("metadata_to_retrieve", [])
        metadata_columns = list(set(self.metadata_columns + additional_metadata_columns))

        documents_with_scores = []
        for row in results:
            metadata = (
                row[self.metadata_json_column]
                if self.metadata_json_column and row[self.metadata_json_column]
                else {}
            )
            for col in metadata_columns:
                metadata[col] = row[col]
            assert self.distance_strategy.search_function == "cosine_distance"
            metadata["score"] = 1 - row["distance"] # quite bad to add scores to metadata, but easier to handle
            documents_with_scores.append(
                (
                    Document(
                        page_content=row[self.content_column],
                        metadata=metadata,
                        id=str(row[self.id_column]),
                    ),
                    row["distance"],
                )
            )

        return documents_with_scores

    async def amax_marginal_relevance_search(
        self,
        query: str,
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        """Return docs selected using the maximal marginal relevance."""
        selected_model, selected_embedder = self._resolve_embedding_backend(
            model=kwargs.get("model"),
            embedding_column=kwargs.get("embedding_column"),
        )
        embedding = await selected_embedder.aembed_query(text=query)
        kwargs["model"] = selected_model

        return await self.amax_marginal_relevance_search_by_vector(
            embedding=embedding,
            k=k,
            fetch_k=fetch_k,
            lambda_mult=lambda_mult,
            filter=filter,
            **kwargs,
        )

    async def amax_marginal_relevance_search_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        """Return docs selected using the maximal marginal relevance."""
        docs_and_scores = (
            await self.amax_marginal_relevance_search_with_score_by_vector(
                embedding,
                k=k,
                fetch_k=fetch_k,
                lambda_mult=lambda_mult,
                filter=filter,
                **kwargs,
            )
        )

        return [result[0] for result in docs_and_scores]

    async def amax_marginal_relevance_search_with_score_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        """Return docs and distance scores selected using the maximal marginal relevance."""
        results = await self.__query_collection(
            embedding=embedding, k=fetch_k, filter=filter, **kwargs
        )

        k = k if k else self.k
        fetch_k = fetch_k if fetch_k else self.fetch_k
        lambda_mult = lambda_mult if lambda_mult else self.lambda_mult
        embedding_list = [json.loads(row[self.embedding_column]) for row in results]
        mmr_selected = utils.maximal_marginal_relevance(
            np.array(embedding, dtype=np.float32),
            embedding_list,
            k=k,
            lambda_mult=lambda_mult,
        )

        documents_with_scores = []
        for row in results:
            metadata = (
                row[self.metadata_json_column]
                if self.metadata_json_column and row[self.metadata_json_column]
                else {}
            )
            for col in self.metadata_columns:
                metadata[col] = row[col]
            documents_with_scores.append(
                (
                    Document(
                        page_content=row[self.content_column],
                        metadata=metadata,
                        id=str(row[self.id_column]),
                    ),
                    row["distance"],
                )
            )

        return [r for i, r in enumerate(documents_with_scores) if i in mmr_selected]

    async def aapply_hybrid_search_index(
        self,
        concurrently: bool = False,
    ) -> None:
        """Creates a TSV index in the vector store table if possible."""
        if (
            not self.hybrid_search_config
            or not self.hybrid_search_config.index_type
            or not self.hybrid_search_config.index_name
        ):
            # no index needs to be created
            raise ValueError("Hybrid Search Config cannot create index.")

        lang = (
            f"'{self.hybrid_search_config.tsv_lang}',"
            if self.hybrid_search_config.tsv_lang
            else ""
        )
        tsv_column_name = (
            self.hybrid_search_config.tsv_column
            if self.hybrid_search_config.tsv_column
            else f"to_tsvector({lang} {self.content_column})"
        )
        tsv_index_query = f'CREATE INDEX {"CONCURRENTLY" if concurrently else ""} {self.hybrid_search_config.index_name} ON "{self.schema_name}"."{self.table_name}" USING {self.hybrid_search_config.index_type}({tsv_column_name});'
        if concurrently:
            async with self.engine.connect() as conn:
                autocommit_conn = await conn.execution_options(
                    isolation_level="AUTOCOMMIT"
                )
                await autocommit_conn.execute(text(tsv_index_query))
        else:
            async with self.engine.connect() as conn:
                await conn.execute(text(tsv_index_query))
                await conn.commit()

    async def aapply_vector_index(
        self,
        index: BaseIndex,
        name: Optional[str] = None,
        *,
        concurrently: bool = False,
    ) -> None:
        """Create index in the vector store table."""
        if isinstance(index, ExactNearestNeighbor):
            await self.adrop_vector_index()
            return

        # if extension name is mentioned, create the extension
        if index.extension_name:
            async with self.engine.connect() as conn:
                await conn.execute(
                    text(f"CREATE EXTENSION IF NOT EXISTS {index.extension_name}")
                )
                await conn.commit()
        function = index.get_index_function()

        filter = f"WHERE ({index.partial_indexes})" if index.partial_indexes else ""
        params = "WITH " + index.index_options()
        if name is None:
            if index.name is None:
                index.name = self.table_name + DEFAULT_INDEX_NAME_SUFFIX
            name = index.name
        stmt = f'CREATE INDEX {"CONCURRENTLY" if concurrently else ""} "{name}" ON "{self.schema_name}"."{self.table_name}" USING {index.index_type} ({self.embedding_column} {function}) {params} {filter};'

        if concurrently:
            async with self.engine.connect() as conn:
                autocommit_conn = await conn.execution_options(
                    isolation_level="AUTOCOMMIT"
                )
                await autocommit_conn.execute(text(stmt))
        else:
            async with self.engine.connect() as conn:
                await conn.execute(text(stmt))
                await conn.commit()

    async def areindex(self, index_name: Optional[str] = None) -> None:
        """Re-index the vector store table."""
        index_name = index_name or self.table_name + DEFAULT_INDEX_NAME_SUFFIX
        query = f'REINDEX INDEX "{index_name}";'
        async with self.engine.connect() as conn:
            await conn.execute(text(query))
            await conn.commit()

    async def adrop_vector_index(
        self,
        index_name: Optional[str] = None,
    ) -> None:
        """Drop the vector index."""
        index_name = index_name or self.table_name + DEFAULT_INDEX_NAME_SUFFIX
        query = f'DROP INDEX IF EXISTS "{index_name}";'
        async with self.engine.connect() as conn:
            await conn.execute(text(query))
            await conn.commit()

    async def is_valid_index(
        self,
        index_name: Optional[str] = None,
    ) -> bool:
        """Check if index exists in the table."""
        index_name = index_name or self.table_name + DEFAULT_INDEX_NAME_SUFFIX
        query = """
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE tablename = :table_name AND schemaname = :schema_name AND indexname = :index_name;
        """
        param_dict = {
            "table_name": self.table_name,
            "schema_name": self.schema_name,
            "index_name": index_name,
        }
        async with self.engine.connect() as conn:
            result = await conn.execute(text(query), param_dict)
            result_map = result.mappings()
            results = result_map.fetchall()
        return bool(len(results) == 1)

    async def aget_by_ids(self, ids: Sequence[str], columns_override=None) -> list[Document]:
        """Get documents by ids."""

        if columns_override is not None:
            columns = columns_override + [
                self.id_column,
                self.content_column,
            ]
        else:
            columns = self.metadata_columns + [
                self.id_column,
                self.content_column,
            ]
            if self.metadata_json_column:
                columns.append(self.metadata_json_column)

        column_names = ", ".join(f'"{col}"' for col in columns)

        placeholders = ", ".join(f":id_{i}" for i in range(len(ids)))
        param_dict = {f"id_{i}": id for i, id in enumerate(ids)}

        query = f'SELECT {column_names} FROM "{self.schema_name}"."{self.table_name}" WHERE "{self.id_column}" IN ({placeholders});'

        async with self.engine.connect() as conn:
            result = await conn.execute(text(query), param_dict)
            result_map = result.mappings()
            results = result_map.fetchall()

        documents = []
        for row in results:
            if columns_override is not None:
                metadata = {col: row[col] for col in columns_override}
            else:
                metadata = (
                    row[self.metadata_json_column]
                    if self.metadata_json_column and row[self.metadata_json_column]
                    else {}
                )
                for col in self.metadata_columns:
                    metadata[col] = row[col]
            documents.append(
                (
                    Document(
                        page_content=row[self.content_column],
                        metadata=metadata,
                        id=str(row[self.id_column]),
                    )
                )
            )

        return documents

    async def aget_random_documents(
        self,
        limit: int,
        columns_override=None,
        exclude_ids: Optional[Sequence[str]] = None,
    ) -> list[Document]:
        """Get a random sample of documents."""

        if limit <= 0:
            return []

        if columns_override is not None:
            columns = columns_override + [
                self.id_column,
                self.content_column,
            ]
        else:
            columns = self.metadata_columns + [
                self.id_column,
                self.content_column,
            ]
            if self.metadata_json_column:
                columns.append(self.metadata_json_column)

        column_names = ", ".join(f'"{col}"' for col in columns)
        param_dict: dict[str, Any] = {"limit": limit}

        where_clause = ""
        if exclude_ids:
            placeholders = ", ".join(f":exclude_id_{i}" for i in range(len(exclude_ids)))
            where_clause = f'WHERE "{self.id_column}" NOT IN ({placeholders}) '
            param_dict.update(
                {f"exclude_id_{i}": doc_id for i, doc_id in enumerate(exclude_ids)}
            )

        query = (
            f'SELECT {column_names} FROM "{self.schema_name}"."{self.table_name}" '
            f"{where_clause}ORDER BY RANDOM() LIMIT :limit;"
        )

        async with self.engine.connect() as conn:
            result = await conn.execute(text(query), param_dict)
            result_map = result.mappings()
            results = result_map.fetchall()

        documents = []
        for row in results:
            if columns_override is not None:
                metadata = {col: row[col] for col in columns_override}
            else:
                metadata = (
                    row[self.metadata_json_column]
                    if self.metadata_json_column and row[self.metadata_json_column]
                    else {}
                )
                for col in self.metadata_columns:
                    metadata[col] = row[col]
            documents.append(
                Document(
                    page_content=row[self.content_column],
                    metadata=metadata,
                    id=str(row[self.id_column]),
                )
            )

        return documents

    async def aget_by_field_value(
        self,
        *,
        select_field: str,
        select_value: Any,
        retrieve_fields: Sequence[str],
    ) -> list[dict[str, Any]]:
        """Return requested fields where ``select_field`` equals ``select_value``."""

        if not retrieve_fields:
            raise ValueError("retrieve_fields must contain at least one field.")

        safe_filter, filter_dict = self._create_filter_clause(
            {select_field: {"$eq": select_value}}
        )

        selected_columns = ", ".join(f'"{field}"' for field in retrieve_fields)

        query = (
            f'SELECT {selected_columns} FROM "{self.schema_name}"."{self.table_name}" '
            f"WHERE {safe_filter};"
        )

        async with self.engine.connect() as conn:
            result = await conn.execute(text(query), filter_dict)
            rows = result.mappings().fetchall()

        return [{field: row[field] for field in retrieve_fields} for row in rows]

    def _handle_field_filter(
        self,
        *,
        field: str,
        value: Any,
    ) -> tuple[str, dict]:
        """Create a filter for a specific field.

        Args:
            field: name of field
            value: value to filter
                If provided as is then this will be an equality filter
                If provided as a dictionary then this will be a filter, the key
                will be the operator and the value will be the value to filter by

        Returns:
            sql where query as a string
        """
        if not isinstance(field, str):
            raise ValueError(
                f"field should be a string but got: {type(field)} with value: {field}"
            )

        if field.startswith("$"):
            raise ValueError(
                f"Invalid filter condition. Expected a field but got an operator: "
                f"{field}"
            )

        # Allow [a-zA-Z0-9_], disallow $ for now until we support escape characters
        if not field.isidentifier():
            raise ValueError(
                f"Invalid field name: {field}. Expected a valid identifier."
            )

        if isinstance(value, dict):
            # This is a filter specification
            if len(value) != 1:
                raise ValueError(
                    "Invalid filter condition. Expected a value which "
                    "is a dictionary with a single key that corresponds to an operator "
                    f"but got a dictionary with {len(value)} keys. The first few "
                    f"keys are: {list(value.keys())[:3]}"
                )
            operator, filter_value = list(value.items())[0]
            # Verify that that operator is an operator
            if operator not in SUPPORTED_OPERATORS:
                raise ValueError(
                    f"Invalid operator: {operator}. "
                    f"Expected one of {SUPPORTED_OPERATORS}"
                )
        else:  # Then we assume an equality operator
            operator = "$eq"
            filter_value = value

        suffix_id = str(uuid.uuid4()).split("-")[0]
        if operator in COMPARISONS_TO_NATIVE:
            # Then we implement an equality filter
            # native is trusted input
            native = COMPARISONS_TO_NATIVE[operator]
            param_name = f"{field}_{suffix_id}"
            return f"{field} {native} :{param_name}", {f"{param_name}": filter_value}
        elif operator == "$between":
            # Use AND with two comparisons
            low, high = filter_value
            low_param_name = f"{field}_low_{suffix_id}"
            high_param_name = f"{field}_high_{suffix_id}"
            return f"({field} BETWEEN :{low_param_name} AND :{high_param_name})", {
                f"{low_param_name}": low,
                f"{high_param_name}": high,
            }
        elif operator in {"$in", "$nin"}:
            # We'll do force coercion to text
            for val in filter_value:
                if not isinstance(val, (str, int, float)):
                    raise NotImplementedError(
                        f"Unsupported type: {type(val)} for value: {val}"
                    )

                if isinstance(val, bool):  # b/c bool is an instance of int
                    raise NotImplementedError(
                        f"Unsupported type: {type(val)} for value: {val}"
                    )
            param_name = f"{field}_{operator.replace('$', '')}_{suffix_id}"
            if operator == "$in":
                return f"{field} = ANY(:{param_name})", {f"{param_name}": filter_value}
            else:  # i.e. $nin
                return f"{field} <> ALL (:{param_name})", {
                    f"{param_name}": filter_value
                }

        elif operator in {"$like", "$ilike"}:
            param_name = f"{field}_{operator.replace('$', '')}_{suffix_id}"
            if operator == "$like":
                return f"({field} LIKE :{param_name})", {f"{param_name}": filter_value}
            else:  # i.e. $ilike
                return f"({field} ILIKE :{param_name})", {f"{param_name}": filter_value}
        elif operator == "$exists":
            if not isinstance(filter_value, bool):
                raise ValueError(
                    "Expected a boolean value for $exists "
                    f"operator, but got: {filter_value}"
                )
            else:
                if filter_value:
                    return f"({field} IS NOT NULL)", {}
                else:
                    return f"({field} IS NULL)", {}
        else:
            raise NotImplementedError()

    def _create_filter_clause(self, filters: Any) -> tuple[str, dict]:
        """Create LangChain filter representation to matching SQL where clauses

        Args:
            filters: Dictionary of filters to apply to the query.

        Returns:
            String containing the sql where query.
        """

        if not isinstance(filters, dict):
            raise ValueError(
                f"Invalid type: Expected a dictionary but got type: {type(filters)}"
            )
        if len(filters) == 1:
            # The only operators allowed at the top level are $AND, $OR, and $NOT
            # First check if an operator or a field
            key, value = list(filters.items())[0]
            if key.startswith("$"):
                # Then it's an operator
                if key.lower() not in ["$and", "$or", "$not"]:
                    raise ValueError(
                        f"Invalid filter condition. Expected $and, $or or $not "
                        f"but got: {key}"
                    )
            else:
                # Then it's a field
                return self._handle_field_filter(field=key, value=filters[key])

            if key.lower() == "$and" or key.lower() == "$or":
                if not isinstance(value, list):
                    raise ValueError(
                        f"Expected a list, but got {type(value)} for value: {value}"
                    )
                op = key[1:].upper()  # Extract the operator
                filter_clause = [self._create_filter_clause(el) for el in value]
                if len(filter_clause) > 1:
                    all_clauses = [clause[0] for clause in filter_clause]
                    params = {}
                    for clause in filter_clause:
                        params.update(clause[1])
                    return f"({f' {op} '.join(all_clauses)})", params
                elif len(filter_clause) == 1:
                    return filter_clause[0]
                else:
                    raise ValueError(
                        "Invalid filter condition. Expected a dictionary "
                        "but got an empty dictionary"
                    )
            elif key.lower() == "$not":
                if isinstance(value, list):
                    not_conditions = [
                        self._create_filter_clause(item) for item in value
                    ]
                    all_clauses = [clause[0] for clause in not_conditions]
                    params = {}
                    for clause in not_conditions:
                        params.update(clause[1])
                    not_stmts = [f"NOT {condition}" for condition in all_clauses]
                    return f"({' AND '.join(not_stmts)})", params
                elif isinstance(value, dict):
                    not_, params = self._create_filter_clause(value)
                    return f"(NOT {not_})", params
                else:
                    raise ValueError(
                        f"Invalid filter condition. Expected a dictionary "
                        f"or a list but got: {type(value)}"
                    )
            else:
                raise ValueError(
                    f"Invalid filter condition. Expected $and, $or or $not "
                    f"but got: {key}"
                )
        elif len(filters) > 1:
            # Then all keys have to be fields (they cannot be operators)
            for key in filters.keys():
                if key.startswith("$"):
                    raise ValueError(
                        f"Invalid filter condition. Expected a field but got: {key}"
                    )
            # These should all be fields and combined using an $and operator
            and_ = [
                self._handle_field_filter(field=k, value=v) for k, v in filters.items()
            ]
            if len(and_) > 1:
                all_clauses = [clause[0] for clause in and_]
                params = {}
                for clause in and_:
                    params.update(clause[1])
                return f"({' AND '.join(all_clauses)})", params
            elif len(and_) == 1:
                return and_[0]
            else:
                raise ValueError(
                    "Invalid filter condition. Expected a dictionary "
                    "but got an empty dictionary"
                )
        else:
            return "", {}

    def get_by_ids(self, ids: Sequence[str]) -> list[Document]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def add_texts(
        self,
        texts: Iterable[str],
        metadatas: Optional[list[dict]] = None,
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> list[str]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def add_documents(
        self,
        documents: list[Document],
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> list[str]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def delete(
        self,
        ids: Optional[list] = None,
        **kwargs: Any,
    ) -> Optional[bool]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    @classmethod
    def from_texts(  # type: ignore[override]
        cls: type[AsyncPGVectorStore],
        texts: list[str],
        embedding: Embeddings,
        engine: PGEngine,
        table_name: str,
        metadatas: Optional[list[dict]] = None,
        ids: Optional[list] = None,
        content_column: str = "content",
        embedding_column: str = "embedding",
        metadata_columns: Optional[list[str]] = None,
        ignore_metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: str = "langchain_metadata",
        **kwargs: Any,
    ) -> AsyncPGVectorStore:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    @classmethod
    def from_documents(  # type: ignore[override]
        cls: type[AsyncPGVectorStore],
        documents: list[Document],
        embedding: Embeddings,
        engine: PGEngine,
        table_name: str,
        ids: Optional[list] = None,
        content_column: str = "content",
        embedding_column: str = "embedding",
        metadata_columns: Optional[list[str]] = None,
        ignore_metadata_columns: Optional[list[str]] = None,
        id_column: str = "langchain_id",
        metadata_json_column: str = "langchain_metadata",
        **kwargs: Any,
    ) -> AsyncPGVectorStore:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def similarity_search(
        self,
        query: str,
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[list[Document]]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def similarity_search_with_score(
        self,
        query: str,
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def similarity_search_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def similarity_search_with_score_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def max_marginal_relevance_search(
        self,
        query: str,
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def max_marginal_relevance_search_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[Document]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )

    def max_marginal_relevance_search_with_score_by_vector(
        self,
        embedding: list[float],
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        filter: Optional[dict] = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        raise NotImplementedError(
            "Sync methods are not implemented for AsyncPGVectorStore. Use PGVectorStore interface instead."
        )
