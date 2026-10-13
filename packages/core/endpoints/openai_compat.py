"""Shared OpenAI-compatible chat-model helpers.

Both vLLM and Ollama expose the OpenAI Chat Completions API below ``/v1``.
Keeping the protocol details here makes switching between those servers a
configuration-only operation for the application endpoints.
"""

from __future__ import annotations

from typing import Any, Mapping

from langchain_openai import ChatOpenAI


DEFAULT_API_KEY = "ollama"


def normalize_openai_base_url(base_url: str) -> str:
    """Return an OpenAI API base URL with exactly one trailing ``/v1``."""
    normalized = base_url.strip().rstrip("/")
    if not normalized:
        raise ValueError("OpenAI-compatible base URL must not be empty.")
    return normalized if normalized.endswith("/v1") else f"{normalized}/v1"


def build_chat_model(config: Mapping[str, Any]) -> ChatOpenAI:
    """Build a ChatOpenAI client for a vLLM or Ollama-compatible server."""
    return ChatOpenAI(
        model=str(config["model"]),
        base_url=normalize_openai_base_url(str(config["base_url"])),
        api_key=str(config.get("api_key") or DEFAULT_API_KEY),
        temperature=float(config.get("temperature", 0.0)),
    )
