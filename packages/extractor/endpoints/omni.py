import logging
import time
from typing import Any, Dict, List

import torch
from ray import serve
from sentence_transformers import SentenceTransformer
from transformers.utils import is_flash_attn_2_available

from .common import decode_image_data, validate_media_url


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "nvidia/omni-embed-nemotron-3b"
SUPPORTED_TASKS = {"query", "document"}
VIDEO_PROCESSING_KWARGS = {
    "min_pixels": 32 * 14 * 14,
    "max_pixels": 64 * 28 * 28,
    "do_sample_frames": True,
    "fps": 2,
}
AUDIO_PROCESSING_KWARGS = {"max_length": 2048000}


@serve.deployment(
    ray_actor_options={"num_cpus": 4, "num_gpus": 0.1},
    max_concurrent_queries=16,
)
class OmniFeatureExtractor:
    """Ray Serve deployment for NVIDIA Omni-Embed-Nemotron-3B."""

    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.startup_time = time.time()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        attention_implementation = (
            "flash_attention_2" if is_flash_attn_2_available() else "sdpa"
        )

        logger.info(
            "Loading %s on %s with %s attention",
            model_name,
            self.device,
            attention_implementation,
        )
        self.embedder = SentenceTransformer(
            model_name,
            trust_remote_code=True,
            device=self.device,
            model_kwargs={"attn_implementation": attention_implementation},
        )
        self.embedder[0].processing_kwargs.update(
            {
                "video": dict(VIDEO_PROCESSING_KWARGS),
                "audio": dict(AUDIO_PROCESSING_KWARGS),
            }
        )
        self.embedder.eval()

        load_time = time.time() - self.startup_time
        logger.info("READY: Omni-Embed service active (%.2fs)", load_time)

    def _prepare_input(self, request: Dict[str, Any], modality: str) -> Any:
        task = request.get("task")
        if task not in SUPPORTED_TASKS:
            raise ValueError("'task' is required and must be 'query' or 'document'")

        if modality == "text":
            text = request.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError("'text' must be a non-empty string")
            return text

        if modality in {"image", "image+text"}:
            if "image" not in request:
                raise ValueError("Missing 'image' field")
            image = decode_image_data(request["image"])
            if modality == "image":
                return {"image": image}

            text = request.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError("'text' must be a non-empty string")
            return {"image": image, "text": text}

        video_url = validate_media_url(request.get("video"), "video")
        if modality == "video":
            return {"video": video_url}

        if modality == "video+audio":
            audio_url = validate_media_url(request.get("audio"), "audio")
            return {"video": video_url, "audio": audio_url}

        raise ValueError(f"Unsupported modality: {modality}")

    def _extract_batch(
        self, requests: List[Dict[str, Any]], modality: str
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any] | None] = [None] * len(requests)
        grouped_inputs = {
            "query": {"inputs": [], "indices": []},
            "document": {"inputs": [], "indices": []},
        }

        for index, request in enumerate(requests):
            try:
                model_input = self._prepare_input(request, modality)
                task = request["task"]
                grouped_inputs[task]["inputs"].append(model_input)
                grouped_inputs[task]["indices"].append(index)
            except Exception as exc:
                results[index] = {
                    "success": False,
                    "error": f"Preprocessing error: {exc}",
                    "model": self.model_name,
                }

        for task, group in grouped_inputs.items():
            inputs = group["inputs"]
            indices = group["indices"]
            if not inputs:
                continue

            encode = (
                self.embedder.encode_query
                if task == "query"
                else self.embedder.encode_document
            )
            try:
                embeddings = encode(
                    inputs,
                    batch_size=len(inputs),
                    show_progress_bar=False,
                    convert_to_tensor=True,
                    normalize_embeddings=True,
                )
                embeddings = embeddings.detach().cpu()
                for index, embedding in zip(indices, embeddings):
                    features = embedding.tolist()
                    results[index] = {
                        "success": True,
                        "features": features,
                        "feature_dim": len(features),
                        "model": self.model_name,
                    }
            except Exception as exc:
                # raise
                logger.error("%s %s inference error: %s", modality, task, exc)
                for index in indices:
                    results[index] = {
                        "success": False,
                        "error": f"Model error: {exc}",
                        "model": self.model_name,
                    }

        return [
            result
            if result is not None
            else {
                "success": False,
                "error": "Unknown error",
                "model": self.model_name,
            }
            for result in results
        ]

    @serve.batch(max_batch_size=64, batch_wait_timeout_s=0.1)
    async def extract_text(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._extract_batch(requests, "text")

    @serve.batch(max_batch_size=16, batch_wait_timeout_s=0.1)
    async def extract_image(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._extract_batch(requests, "image")

    @serve.batch(max_batch_size=16, batch_wait_timeout_s=0.1)
    async def extract_image_text(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._extract_batch(requests, "image+text")

    @serve.batch(max_batch_size=4, batch_wait_timeout_s=0.1)
    async def extract_video(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._extract_batch(requests, "video")

    @serve.batch(max_batch_size=4, batch_wait_timeout_s=0.1)
    async def extract_video_audio(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return self._extract_batch(requests, "video+audio")
