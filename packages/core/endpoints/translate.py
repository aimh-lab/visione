"""Translation endpoint using Ollama LLM."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field


router = APIRouter()


class TranslateRequest(BaseModel):
    text: str = Field(..., description="The text to translate.")
    source_language: Optional[str] = Field(
        default="auto",
        description="The source language of the text. Use 'auto' for automatic detection.",
    )
    target_language: str = Field(..., description="The target language for translation.")


class TranslateResponse(BaseModel):
    translated_text: str = Field(..., description="The translated text.")
    detected_language: Optional[str] = Field(
        default=None,
        description="The detected source language (if auto-detection was used).",
    )


def _get_translate_config(request: Request) -> dict:
    """Read required translate config from the 'translate' section."""
    translate_cfg = getattr(getattr(request.app.state, "config", None), "translate", None)

    if translate_cfg is None:
        raise HTTPException(
            status_code=500,
            detail="Missing required 'translate' configuration section.",
        )

    model = getattr(translate_cfg, "model", None)
    base_url = getattr(translate_cfg, "base_url", None)

    if model is None:
        raise HTTPException(
            status_code=500,
            detail="Missing required 'translate.model' configuration value.",
        )
    if base_url is None:
        raise HTTPException(
            status_code=500,
            detail="Missing required 'translate.base_url' configuration value.",
        )

    return {
        "model": str(model),
        "base_url": str(base_url),
        "temperature": float(getattr(translate_cfg, "temperature", 0.0)),
    }


def _build_translation_prompt(text: str, source_language: str, target_language: str) -> tuple[str, str]:
    """Build system and user prompts for translation."""
    if source_language.lower() == "auto":
        system_prompt = (
            "You are a professional translator. Your task is to:\n"
            "1. Detect the language of the input text\n"
            "2. Translate the text to the target language\n\n"
            "Respond ONLY with a JSON object in this exact format:\n"
            '{"detected_language": "<detected language>", "translated_text": "<translation>"}\n\n'
            "Do not include any other text, explanation, or formatting."
        )
        user_prompt = f"Translate the following text to {target_language}:\n\n{text}"
    else:
        system_prompt = (
            "You are a professional translator. Translate the input text from the source language "
            "to the target language.\n\n"
            "Respond ONLY with a JSON object in this exact format:\n"
            '{"translated_text": "<translation>"}\n\n'
            "Do not include any other text, explanation, or formatting."
        )
        user_prompt = f"Translate from {source_language} to {target_language}:\n\n{text}"

    return system_prompt, user_prompt


@router.post("/translate", response_model=TranslateResponse)
async def translate(request: Request, body: TranslateRequest) -> TranslateResponse:
    """Translate text using an Ollama model."""
    config = _get_translate_config(request)

    llm = ChatOllama(
        model=config["model"],
        base_url=config["base_url"],
        temperature=config["temperature"],
        format="json",
    )

    system_prompt, user_prompt = _build_translation_prompt(
        body.text, body.source_language, body.target_language
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        content = response.content

        import json
        result = json.loads(content)

        translated_text = result.get("translated_text")
        if not translated_text:
            raise HTTPException(
                status_code=500,
                detail="Translation failed: no translated text in response.",
            )

        detected_language = result.get("detected_language")

        return TranslateResponse(
            translated_text=translated_text,
            detected_language=detected_language,
        )

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse translation response: {e}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Translation failed: {e}",
        )
