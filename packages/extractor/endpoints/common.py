import base64
import io
import os
from pathlib import Path
import socket
import tempfile
from typing import List, Dict, Any, Union
from urllib.parse import urlparse

from PIL import Image
import requests


_BATCH_METHODS = {
    "image": "extract_image",
    "text": "extract_text",
    "video": "extract_video",
    "image+text": "extract_image_text",
    "video+audio": "extract_video_audio",
}


class ConfigurableBatching:
    """Apply Ray Serve batch limits without reconstructing a model replica."""

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
            # Rimuovi prefisso data URL se presente
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Decodifica base64
            image_bytes = base64.b64decode(image_data)
            return Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        else:
            # È un URL - scarica l'immagine
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'}
            response = requests.get(image_data, timeout=10, headers=headers)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content)).convert('RGB')
            
    except Exception as e:
        raise Exception(f"Errore nel caricamento immagine: {str(e)}")
