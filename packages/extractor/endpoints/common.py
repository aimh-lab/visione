import asyncio
import base64
import io
import logging
import os
from pathlib import Path
import socket
import tempfile
import time
from typing import List, Dict, Any, Union
from urllib.parse import urlparse

import aiohttp
from PIL import Image
import requests


logger = logging.getLogger(__name__)
IMAGE_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/102.0.0.0 Safari/537.36"
    )
}
IMAGE_REQUEST_TIMEOUT_SECONDS = 10
DEFAULT_IMAGE_DOWNLOAD_CONCURRENCY = 16
DEFAULT_IMAGE_DECODE_CONCURRENCY = 4

_BATCH_METHODS = {
    "image": "extract_image",
    "text": "extract_text",
    "video": "extract_video",
    "image+text": "extract_image_text",
    "video+audio": "extract_video_audio",
}


class ConfigurableBatching:
    """Apply Ray Serve batch limits without reconstructing a model replica."""

    image_download_concurrency = DEFAULT_IMAGE_DOWNLOAD_CONCURRENCY
    image_decode_concurrency = DEFAULT_IMAGE_DECODE_CONCURRENCY

    def reconfigure(self, user_config: Dict[str, Any]) -> None:
        batch_sizes = user_config.get("batch_sizes", {})
        if not isinstance(batch_sizes, dict):
            raise ValueError("user_config.batch_sizes must be a mapping")

        for modality, max_batch_size in batch_sizes.items():
            if (
                isinstance(max_batch_size, bool)
                or not isinstance(max_batch_size, int)
                or max_batch_size <= 0
            ):
                raise ValueError(
                    f"batch size for modality '{modality}' must be a positive integer"
                )
            method_name = _BATCH_METHODS.get(modality)
            batch_handler = getattr(self, method_name, None) if method_name else None
            if batch_handler is None:
                raise ValueError(
                    f"{type(self).__name__} does not support batching modality "
                    f"'{modality}'"
                )
            batch_handler.set_max_batch_size(max_batch_size)

        image_loading = user_config.get("image_loading", {})
        if not isinstance(image_loading, dict):
            raise ValueError("user_config.image_loading must be a mapping")
        unknown_keys = sorted(
            set(image_loading)
            - {"download_concurrency", "decode_concurrency"}
        )
        if unknown_keys:
            raise ValueError(
                "user_config.image_loading contains unknown keys: "
                + ", ".join(unknown_keys)
            )

        for key, default in (
            ("download_concurrency", DEFAULT_IMAGE_DOWNLOAD_CONCURRENCY),
            ("decode_concurrency", DEFAULT_IMAGE_DECODE_CONCURRENCY),
        ):
            value = image_loading.get(key, default)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError(
                    f"image loading {key} must be a positive integer"
                )
            setattr(self, f"image_{key}", value)


def configure_http_cache() -> bool:
    """Install an isolated requests cache only when explicitly enabled."""
    if os.environ.get("FEATURE_EXTRACTOR_CACHE_ENABLED") != "1":
        return False

    import requests_cache

    cache_root = Path(
        os.environ.get("FEATURE_EXTRACTOR_CACHE_DIR", tempfile.gettempdir())
    ).expanduser()
    cache_root.mkdir(parents=True, exist_ok=True)
    replica_id = f"{socket.gethostname()}_{os.getpid()}"
    cache_path = cache_root / f"feature_extractor_cache_{replica_id}"
    cache_ttl = int(os.environ.get("FEATURE_EXTRACTOR_CACHE_TTL_SECONDS", "60"))
    requests_cache.install_cache(str(cache_path), expire_after=cache_ttl)
    return True


HTTP_CACHE_ENABLED = configure_http_cache()


def _decode_image_bytes(image_bytes: bytes) -> Image.Image:
    with Image.open(io.BytesIO(image_bytes)) as image:
        return image.convert("RGB")


def _decode_base64_bytes(image_data: str, *, validate: bool = False) -> bytes:
    if image_data.startswith("data:image"):
        try:
            image_data = image_data.split(",", 1)[1]
        except IndexError as exc:
            raise ValueError("invalid image data URL") from exc
    return base64.b64decode(image_data, validate=validate)


async def load_image_batch(
    image_values: List[Any],
    *,
    download_concurrency: int = DEFAULT_IMAGE_DOWNLOAD_CONCURRENCY,
    decode_concurrency: int = DEFAULT_IMAGE_DECODE_CONCURRENCY,
    label: str = "image",
) -> List[Union[Image.Image, Exception]]:
    """Load and decode images concurrently while preserving input ordering."""
    if download_concurrency <= 0 or decode_concurrency <= 0:
        raise ValueError("image loading concurrency limits must be positive")

    started_at = time.perf_counter()
    download_semaphore = asyncio.Semaphore(download_concurrency)
    decode_semaphore = asyncio.Semaphore(decode_concurrency)
    timeout = aiohttp.ClientTimeout(total=IMAGE_REQUEST_TIMEOUT_SECONDS)
    connector = aiohttp.TCPConnector(limit=download_concurrency)

    async with aiohttp.ClientSession(
        timeout=timeout,
        connector=connector,
        headers=IMAGE_REQUEST_HEADERS,
    ) as session:
        async def load_one(image_data: Any) -> Union[Image.Image, Exception]:
            try:
                if not isinstance(image_data, str):
                    raise TypeError("image data must be a string")

                parsed_url = urlparse(image_data)
                if image_data.startswith("data:image") or not parsed_url.scheme:
                    async with decode_semaphore:
                        image_bytes = await asyncio.to_thread(
                            _decode_base64_bytes, image_data, validate=True
                        )
                        return await asyncio.to_thread(
                            _decode_image_bytes, image_bytes
                        )

                async with download_semaphore:
                    async with session.get(image_data) as response:
                        response.raise_for_status()
                        image_bytes = await response.read()

                async with decode_semaphore:
                    return await asyncio.to_thread(
                        _decode_image_bytes, image_bytes
                    )
            except Exception as exc:
                return RuntimeError(f"Errore nel caricamento immagine: {exc}")

        results = await asyncio.gather(*(load_one(value) for value in image_values))

    successful = sum(isinstance(result, Image.Image) for result in results)
    logger.info(
        "Loaded %d/%d images for %s on node=%s replica_pid=%d in %.3fs "
        "(download_concurrency=%d, decode_concurrency=%d)",
        successful,
        len(results),
        label,
        socket.gethostname(),
        os.getpid(),
        time.perf_counter() - started_at,
        download_concurrency,
        decode_concurrency,
    )
    return results


def validate_media_url(media_data: str, field_name: str = "media") -> str:
    """Validate an HTTP(S) media URL without rewriting it."""
    if not isinstance(media_data, str):
        raise ValueError(f"'{field_name}' must be an HTTP(S) URL string")

    media_url = media_data.strip()
    parsed_url = urlparse(media_url)
    if (
        not media_url
        or parsed_url.scheme not in {"http", "https"}
        or not parsed_url.netloc
    ):
        raise ValueError(f"'{field_name}' must be a valid HTTP(S) URL")

    # Return the original value so signed URLs and temporal query parameters are
    # passed to the media reader exactly as supplied by the caller.
    return media_data

def decode_image_data(image_data: str) -> Image.Image:
    """
    Decodifica immagine da base64 o URL
    
    Args:
        image_data: Stringa contenente URL o dati base64
        
    Returns:
        PIL Image object
        
    Raises:
        Exception: Se l'immagine non può essere caricata
    """
    try:
        # Controlla se è base64
        if image_data.startswith('data:image') or not urlparse(image_data).scheme:
            return _decode_image_bytes(_decode_base64_bytes(image_data))
        
        else:
            # È un URL - scarica l'immagine
            response = requests.get(
                image_data,
                timeout=IMAGE_REQUEST_TIMEOUT_SECONDS,
                headers=IMAGE_REQUEST_HEADERS,
            )
            response.raise_for_status()
            return _decode_image_bytes(response.content)
            
    except Exception as e:
        raise Exception(f"Errore nel caricamento immagine: {str(e)}")
