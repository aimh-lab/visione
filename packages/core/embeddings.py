import asyncio
import re
from typing import Any, List, Optional
from urllib.parse import urlparse

import aiohttp
import requests
from langchain_core.embeddings import Embeddings

from extraction_config import collection_element_type


MEDIA_FIELDS = frozenset({"image", "text", "video", "audio"})
QUERY_PREFIX_PATTERN = re.compile(
    r"(?:^|;)\s*(text|image|video|audio)\s*:",
    flags=re.IGNORECASE,
)


def _payload_modality(payload: dict[str, Any]) -> str:
    fields = frozenset(payload) & MEDIA_FIELDS
    modality_by_fields = {
        frozenset({"text"}): "text",
        frozenset({"image"}): "image",
        frozenset({"video"}): "video",
        frozenset({"audio"}): "audio",
        frozenset({"image", "text"}): "image+text",
        frozenset({"video", "audio"}): "video+audio",
    }
    return modality_by_fields.get(fields, "+".join(sorted(fields)))


class RemoteEmbeddings(Embeddings):
    """Embedding client for a remote multimodal Ray Serve model.

    ``modality`` defines how collection documents are represented. Query
    modality is intrinsic to the query string through ``text:``, ``image:``,
    ``video:``, and ``audio:`` prefixes; an unprefixed query remains text for
    backwards compatibility.
    """

    def __init__(
        self,
        embedding_server_url: str = "http://localhost:8000",
        data_server_url: str = "http://localhost:3333",
        data_loader: Any = None,
        model: str = "base",
        modality: str = "image",
        timeout: float = 120.0,
        max_concurrent_requests: int = 64,
        mrl_dimension: Optional[int] = None,
    ):
        self.embedding_server_url = embedding_server_url.rstrip("/")
        self.data_server_url = data_server_url.rstrip("/")
        self.data_loader = data_loader
        self.model = model
        self.modality = modality
        self.timeout = timeout
        self.max_concurrent_requests = max_concurrent_requests
        self.mrl_dimension = mrl_dimension
        self.endpoint_url = f"{self.embedding_server_url}/{self.model}"

        self.available_models = self._get_available_models()
        model_info = next(
            (entry for entry in self.available_models if entry["name"] == model),
            None,
        )
        if model_info is None:
            raise ValueError(f"Model '{model}' not available")

        self.supported_modalities = frozenset(model_info.get("modalities", []))
        if modality not in self.supported_modalities:
            raise ValueError(
                f"Model '{model}' does not support modality '{modality}'. "
                f"Supported modalities: {sorted(self.supported_modalities)}"
            )

    def _get_available_models(self) -> List[dict[str, Any]]:
        """Obtain the model and modality declarations from the extractor."""
        try:
            response = requests.get(
                f"{self.embedding_server_url}/status",
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            return [
                {
                    "name": name,
                    "modalities": model_data["model_infos"]["modalities"],
                }
                for name, model_data in data["models"].items()
            ]
        except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
            print(f"Error while loading available models: {exc}")
            return []

    @staticmethod
    def _validate_input(input_data: str) -> str:
        if not isinstance(input_data, str):
            raise ValueError("Embedding input must be a string")
        if not input_data.strip():
            raise ValueError("Embedding input cannot be empty")
        return input_data.strip()

    @staticmethod
    def _is_http_url(input_data: str) -> bool:
        parsed = urlparse(input_data)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

    def _resolve_media_input(self, input_data: str, modality: str) -> str:
        validated_input = self._validate_input(input_data)
        if self._is_http_url(validated_input) or validated_input.startswith("data:image"):
            return validated_input
        if self.data_loader is None:
            return validated_input

        try:
            return self.data_loader.get_collection_element_url_from_id(
                validated_input,
                what=collection_element_type(modality),
            )
        except Exception:
            return validated_input

    def _ensure_supported_payload(self, payload: dict[str, Any]) -> None:
        modality = _payload_modality(payload)
        if modality not in self.supported_modalities:
            raise ValueError(
                f"Model '{self.model}' does not support query modality '{modality}'. "
                f"Supported modalities: {sorted(self.supported_modalities)}"
            )

    def _build_document_payload(self, input_data: str) -> dict[str, Any]:
        validated_input = self._validate_input(input_data)
        components = self.modality.split("+")
        payload: dict[str, Any] = {"task": "document"}

        if components == ["text"]:
            payload["text"] = validated_input
            return payload
        if "text" in components:
            raise ValueError(
                "Configured document modalities combining text with media require "
                "an explicit structured input and are not supported"
            )

        media_url = self._resolve_media_input(validated_input, self.modality)
        for component in components:
            payload[component] = media_url
        return payload

    def _parse_query_fields(self, input_data: str) -> dict[str, str]:
        validated_input = self._validate_input(input_data)
        matches = list(QUERY_PREFIX_PATTERN.finditer(validated_input))
        if not matches:
            return {"text": validated_input}

        if validated_input[: matches[0].start()].strip(" ;"):
            raise ValueError("Query text before the first modality prefix is not allowed")

        fields: dict[str, str] = {}
        for index, match in enumerate(matches):
            field = match.group(1).lower()
            value_end = matches[index + 1].start() if index + 1 < len(matches) else len(validated_input)
            value = validated_input[match.end() : value_end].strip()
            if not value:
                raise ValueError(f"Query field '{field}' cannot be empty")
            if field in fields:
                raise ValueError(f"Duplicate query field '{field}'")
            fields[field] = value
        return fields

    def _build_query_payload(self, input_data: str) -> dict[str, Any]:
        query_fields = self._parse_query_fields(input_data)
        raw_payload: dict[str, Any] = {"task": "query", **query_fields}
        self._ensure_supported_payload(raw_payload)

        media_fields = [field for field in query_fields if field != "text"]
        query_media_modality = "+".join(media_fields)
        payload: dict[str, Any] = {"task": "query"}
        for field, value in query_fields.items():
            if field == "text":
                payload[field] = value
            else:
                payload[field] = self._resolve_media_input(value, query_media_modality)
        return payload

    def _extract_response_features(self, result: dict[str, Any]) -> List[float]:
        if not result.get("success"):
            error_msg = result.get("error", "Unknown error occurred")
            raise RuntimeError(f"Remote extraction failed: {error_msg}")

        features = result.get("features")
        if not isinstance(features, list) or not features:
            raise RuntimeError("No features returned from remote model")
        if self.mrl_dimension:
            features = features[: self.mrl_dimension]
        return features

    def _extract_features_sync(self, payload: dict[str, Any]) -> List[float]:
        try:
            response = requests.post(
                self.endpoint_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            return self._extract_response_features(response.json())
        except requests.RequestException as exc:
            raise RuntimeError(f"Request to embedding server failed: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"Feature extraction failed: {exc}") from exc

    async def _extract_features_async(self, payload: dict[str, Any]) -> List[float]:
        try:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    self.endpoint_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as response:
                    response.raise_for_status()
                    return self._extract_response_features(await response.json())
        except aiohttp.ClientError as exc:
            raise RuntimeError(f"Async request to embedding server failed: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"Async feature extraction failed: {exc}") from exc

    @staticmethod
    def _query_input(input_data: Optional[str], kwargs: dict[str, Any]) -> str:
        text_alias = kwargs.pop("text", None)
        if kwargs:
            raise TypeError(f"Unexpected query arguments: {sorted(kwargs)}")
        if input_data is not None and text_alias is not None:
            raise TypeError("Specify either input_data or text, not both")
        return input_data if input_data is not None else text_alias

    def embed_documents(self, input_data: List[str]) -> List[List[float]]:
        if not input_data:
            return []

        embeddings: list[list[float]] = []
        for index, value in enumerate(input_data):
            try:
                payload = self._build_document_payload(value)
                embeddings.append(self._extract_features_sync(payload))
            except Exception as exc:
                print(f"Warning: Failed to embed document {index}: {exc}")
                embeddings.append([])
        return embeddings

    def embed_query(
        self,
        input_data: Optional[str] = None,
        **kwargs: Any,
    ) -> List[float]:
        query_input = self._query_input(input_data, kwargs)
        return self._extract_features_sync(self._build_query_payload(query_input))

    async def aembed_documents(self, input_data: List[str]) -> List[List[float]]:
        if not input_data:
            return []

        semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        async def process_single(index: int, value: str) -> List[float]:
            async with semaphore:
                try:
                    payload = self._build_document_payload(value)
                    return await self._extract_features_async(payload)
                except Exception as exc:
                    print(f"Warning: Failed to embed document {index}: {exc}")
                    return []

        return await asyncio.gather(
            *(process_single(index, value) for index, value in enumerate(input_data))
        )

    async def aembed_query(
        self,
        input_data: Optional[str] = None,
        **kwargs: Any,
    ) -> List[float]:
        query_input = self._query_input(input_data, kwargs)
        return await self._extract_features_async(self._build_query_payload(query_input))

    def get_server_status(self) -> dict[str, Any]:
        try:
            response = requests.get(
                f"{self.embedding_server_url}/status",
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            return {"error": f"Failed to get server status: {exc}"}
