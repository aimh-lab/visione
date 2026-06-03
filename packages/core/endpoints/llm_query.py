from collections.abc import Callable, Sequence
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from langchain_classic.chains.query_constructor.base import get_query_constructor_prompt
from langchain_classic.chains.query_constructor.parser import get_parser
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import BaseOutputParser
from langchain_core.output_parsers.json import parse_and_check_json_markdown
from langchain_core.prompts import PromptTemplate
from langchain_core.structured_query import Comparator, Comparison, FilterDirective, Operation, Operator
from langchain_ollama.llms import OllamaLLM
from pydantic import BaseModel, Field, ValidationError

from endpoints.search import TemporalQueryNode
from pg.extended_comparator import ExtendedComparator


router = APIRouter()

DOCUMENT_CONTENT_DESCRIPTION = (
    "First-person lifelog moments represented as image embeddings and optional image URLs. "
    "The output must be a TemporalQueryNode tree that can later be used as the query field of the /search endpoint."
)
DEFAULT_LEAF_K = 100000
DEFAULT_FINAL_K = 1000
DEFAULT_MODEL_NAME = "openclip_clip_vit_b_32"
DEFAULT_LLM_MODEL = "qwen3:8b"
DEFAULT_LLM_BASE_URL = "http://edge-nd1.isti.cnr.it:11435"
ALLOWED_COMPARATORS = (
    ExtendedComparator.EQ,
    ExtendedComparator.NE,
    ExtendedComparator.GT,
    ExtendedComparator.GTE,
    ExtendedComparator.LT,
    ExtendedComparator.LTE,
    ExtendedComparator.CONTAIN,
    ExtendedComparator.FTS,
    ExtendedComparator.IN,
    ExtendedComparator.NIN,
)
ALLOWED_OPERATORS = (
    Operator.AND,
    Operator.OR,
    Operator.NOT,
)
PROMPT_TEMPLATE = PromptTemplate.from_template(
    """\
<< TemporalQueryNode Construction Schema >>
When responding use a markdown code snippet with a JSON object formatted as follows:

```json
{{{{
  "query": {{{{
    "item": string | [query_node, ...],
    "filter": string,
    "aggregation_type": "temporal" | "rrf",
    "window_seconds": number | [number, ...],
    "also_backwards_in_time": boolean,
    "k": integer
  }}}}
}}}}
```

Rules:
- A leaf node has a string `item` and may have a `filter`. Use `NO_FILTER` when no filter is needed.
- A composite node has a list `item` containing child query nodes and must specify `aggregation_type`.
- Use `aggregation_type: "temporal"` for ordered events in time.
- Use `aggregation_type: "rrf"` when combining alternative evidence for the same event, such as text plus an `image:` URL.
- Keep each leaf `item` purely semantic. Put metadata constraints only in `filter`.
- Keep image references exactly as `image:<url>` in the `item` field.
- Use `window_seconds` only for temporal compositions.
- A filter is a logical condition statement composed of comparison and logical operations.
- A comparison statement takes the form `comp(attr, val)` where `comp` is one of {allowed_comparators}.
- A logical operation takes the form `op(statement1, statement2, ...)` where `op` is one of {allowed_operators}.
- Only use attributes from the provided data source schema.
- If a natural-language constraint maps cleanly to metadata, encode it in `filter` instead of the semantic text.
- Return only the JSON code snippet and no extra prose.
"""
)
EXAMPLES = [
    (
        "Find moments where I am riding a bicycle.",
        {
            "query": {
                "item": "I am riding a bicycle",
                "filter": "NO_FILTER",
            }
        },
    ),
    (
        "Find moments in Dublin after lunch where I am inside a cafe.",
        {
            "query": {
                "item": "I am inside a cafe",
                "filter": 'and(gt("hour", 13), eq("city", "Dublin"))',
            }
        },
    ),
    (
        "Find a moment in a supermarket and use this reference image too: image:https://example.com/store.jpg",
        {
            "query": {
                "item": [
                    {
                        "item": "I am inside a supermarket",
                        "filter": "NO_FILTER",
                    },
                    {
                        "item": "image:https://example.com/store.jpg",
                        "filter": "NO_FILTER",
                    },
                ],
                "aggregation_type": "rrf",
            }
        },
    ),
    (
        "I was in a hardware store in Dublin after lunch (additional image of the store at image:https://url_of_a_store). Within the next 50 seconds, a person arrives in front of me.",
        {
            "query": {
                "item": [
                    {
                        "item": [
                            {
                                "item": "I was in a hardware store",
                                "filter": 'and(gt("hour", 13), fts("new_semantic_name", "Dublin"))',
                            },
                            {
                                "item": "image:https://url_of_a_store",
                                "filter": "NO_FILTER",
                            },
                        ],
                        "aggregation_type": "rrf",
                    },
                    {
                        "item": "There is a person in front of me",
                        "filter": "NO_FILTER",
                    },
                ],
                "window_seconds": 50,
                "aggregation_type": "temporal",
            }
        },
    ),
]


class NaturalLanguageQueryRequest(BaseModel):
    query: str = Field(..., description="Natural-language query to convert into a TemporalQueryNode payload.")
    model: Optional[str] = Field(
        default=None,
        description="Optional embedding model for leaf query nodes. Defaults to the configured CLIP model.",
    )
    leaf_k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Optional candidate limit applied to leaf and non-root composite nodes.",
    )
    final_k: Optional[int] = Field(
        default=None,
        ge=1,
        description="Optional candidate limit applied to the root query node.",
    )


def _filter_directive_to_dict(filter_directive: FilterDirective) -> dict[str, Any]:
    if isinstance(filter_directive, Comparison):
        return {
            "comparator": filter_directive.comparator.value,
            "attribute": filter_directive.attribute,
            "value": filter_directive.value,
        }
    if isinstance(filter_directive, Operation):
        return {
            "operator": filter_directive.operator.value,
            "arguments": [_filter_directive_to_dict(argument) for argument in filter_directive.arguments],
        }
    raise TypeError(f"Unsupported filter directive type: {type(filter_directive)!r}")


class TemporalQueryNodeOutputParser(BaseOutputParser[TemporalQueryNode]):
    default_model: str
    leaf_k: int
    final_k: int
    ast_parse: Callable[[str], FilterDirective]

    def __init__(
        self,
        *,
        default_model: str,
        leaf_k: int,
        final_k: int,
        allowed_comparators: Sequence[Comparator],
        allowed_operators: Sequence[Operator],
        allowed_attributes: Sequence[str],
    ) -> None:
        ast_parse = get_parser(
            allowed_comparators=allowed_comparators,
            allowed_operators=allowed_operators,
            allowed_attributes=allowed_attributes,
        ).parse
        super().__init__(
            default_model=default_model,
            leaf_k=leaf_k,
            final_k=final_k,
            ast_parse=ast_parse,
        )

    @property
    def _type(self) -> str:
        return "temporal_query_node_output_parser"

    def parse(self, text: str) -> TemporalQueryNode:
        try:
            parsed = parse_and_check_json_markdown(text, ["query"])
            normalized_query = self._normalize_node(parsed["query"], is_root=True)
            return TemporalQueryNode.model_validate(normalized_query)
        except ValidationError as exc:
            raise OutputParserException(f"Parsed output is not a valid TemporalQueryNode: {exc}") from exc
        except Exception as exc:
            raise OutputParserException(f"Parsing text\n{text}\nraised following error:\n{exc}") from exc

    def _normalize_node(self, node: Any, *, is_root: bool) -> dict[str, Any]:
        if not isinstance(node, dict):
            raise ValueError("Each query node must be an object.")

        item = node.get("item")
        if item is None:
            raise ValueError("Each query node must contain an 'item' field.")

        normalized: dict[str, Any] = {}
        if isinstance(item, list):
            normalized["item"] = [self._normalize_node(child, is_root=False) for child in item]
            normalized["aggregation_type"] = node.get("aggregation_type", "temporal" if is_root else "rrf")
            normalized["k"] = int(node.get("k", self.final_k if is_root else self.leaf_k))

            if "window_seconds" in node:
                normalized["window_seconds"] = node["window_seconds"]
            elif normalized["aggregation_type"] == "temporal" and is_root:
                normalized["window_seconds"] = 30

            if "also_backwards_in_time" in node:
                normalized["also_backwards_in_time"] = node["also_backwards_in_time"]
            return normalized

        if not isinstance(item, str) or not item.strip():
            raise ValueError("Leaf query items must be non-empty strings.")

        normalized["item"] = item.strip()
        normalized["model"] = node.get("model", self.default_model)
        normalized["k"] = int(node.get("k", self.leaf_k))

        raw_filter = node.get("filter", "NO_FILTER")
        if raw_filter not in (None, "", "NO_FILTER"):
            normalized["filters"] = _filter_directive_to_dict(self.ast_parse(raw_filter))
        return normalized


def _get_llm_query_config(request: Request) -> dict[str, Any]:
    cfg = getattr(getattr(request.app.state, "config", None), "llm_query", None)
    return {
        "model": getattr(cfg, "model", DEFAULT_LLM_MODEL),
        "base_url": getattr(cfg, "base_url", DEFAULT_LLM_BASE_URL),
        "temperature": getattr(cfg, "temperature", 0),
        "default_model": getattr(cfg, "default_model", DEFAULT_MODEL_NAME),
        "leaf_k": getattr(cfg, "leaf_k", DEFAULT_LEAF_K),
        "final_k": getattr(cfg, "final_k", DEFAULT_FINAL_K),
    }


def _resolve_default_embedding_model(request: Request, requested_model: Optional[str]) -> str:
    available_models = getattr(request.app.state, "available_models", [])
    if requested_model:
        if requested_model not in available_models:
            raise HTTPException(status_code=400, detail=f"Unknown model: {requested_model}")
        return requested_model

    llm_cfg = _get_llm_query_config(request)
    configured_default = llm_cfg["default_model"]
    if configured_default in available_models:
        return configured_default
    if DEFAULT_MODEL_NAME in available_models:
        return DEFAULT_MODEL_NAME
    if available_models:
        return available_models[0]
    raise HTTPException(status_code=500, detail="No embedding models are available on the server.")


def _build_query_constructor(request: Request, *, default_model: str, leaf_k: int, final_k: int):
    metadata_field_info = request.app.state.loader.get_attribute_info()
    allowed_attributes = [attribute.name for attribute in metadata_field_info]
    llm_cfg = _get_llm_query_config(request)
    llm = OllamaLLM(
        model=llm_cfg["model"],
        temperature=llm_cfg["temperature"],
        base_url=llm_cfg["base_url"],
    )
    constructor_prompt = get_query_constructor_prompt(
        DOCUMENT_CONTENT_DESCRIPTION,
        metadata_field_info,
        examples=EXAMPLES,
        allowed_comparators=ALLOWED_COMPARATORS,
        allowed_operators=ALLOWED_OPERATORS,
        schema_prompt=PROMPT_TEMPLATE,
    )
    output_parser = TemporalQueryNodeOutputParser(
        default_model=default_model,
        leaf_k=leaf_k,
        final_k=final_k,
        allowed_comparators=ALLOWED_COMPARATORS,
        allowed_operators=ALLOWED_OPERATORS,
        allowed_attributes=allowed_attributes,
    )
    return constructor_prompt | llm | output_parser


@router.post("/llm-query", response_model=TemporalQueryNode)
async def llm_query_endpoint(payload: NaturalLanguageQueryRequest, request: Request):
    default_model = _resolve_default_embedding_model(request, payload.model)
    llm_cfg = _get_llm_query_config(request)
    leaf_k = int(payload.leaf_k or llm_cfg["leaf_k"])
    final_k = int(payload.final_k or llm_cfg["final_k"])
    query_constructor = _build_query_constructor(
        request,
        default_model=default_model,
        leaf_k=leaf_k,
        final_k=final_k,
    )

    try:
        temporal_query = query_constructor.invoke({"query": payload.query})
    except HTTPException:
        raise
    except OutputParserException as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM query construction failed: {exc}") from exc

    return temporal_query
