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


def _coerce_bool(value: Any, *, setting: str) -> bool:
    """Parse a configuration boolean without treating ``"false"`` as true."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    raise ValueError(f"{setting} must be a boolean.")


def build_chat_model(config: Mapping[str, Any]) -> ChatOpenAI:
    """Build a ChatOpenAI client for a vLLM or Ollama-compatible server."""
    client_options: dict[str, Any] = {
        "model": str(config["model"]),
        "base_url": normalize_openai_base_url(str(config["base_url"])),
        "api_key": str(config.get("api_key") or DEFAULT_API_KEY),
        "temperature": float(config.get("temperature", 0.0)),
    }
    if "reasoning" in config:
        client_options["extra_body"] = {
            "chat_template_kwargs": {
                "enable_thinking": _coerce_bool(
                    config["reasoning"], setting="reasoning"
                )
            }
        }
    return ChatOpenAI(**client_options)
