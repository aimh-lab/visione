"""/qa endpoint – Agentic QA over lifelog data.

Uses LangGraph to orchestrate a ReAct-style loop: the agent calls a
``search_frames`` tool that queries the same vector-store used by ``/search``.
Images are fetched on-demand and injected into the LLM context sparingly
(~1-2 per iteration, ~10 total) while metadata results can be much larger.
"""

from __future__ import annotations

import base64
import json
import operator
from typing import Any, Dict, List, Literal, Optional, Annotated

import aiohttp
from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from endpoints.search import convert_filters_to_pg

router = APIRouter()

# ── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_LLM_MODEL = "ministral-3:8b"
DEFAULT_LLM_BASE_URL = "http://edge-nd1.isti.cnr.it:11435"
DEFAULT_EMBEDDING_MODEL = "openclip_clip_vit_b_32"
MAX_AGENT_ITERATIONS = 5
MAX_TOTAL_IMAGES = 10
MAX_IMAGES_PER_CALL = 2


# ── Request / Response models ──────────────────────────────────────────────
class QARequest(BaseModel):
    question: str = Field(..., description="Natural-language question about the lifelog.")
    max_iterations: Optional[int] = Field(
        default=MAX_AGENT_ITERATIONS,
        ge=1,
        le=10,
        description="Maximum number of search iterations the agent may perform.",
    )


class QAResponse(BaseModel):
    answer: str = Field(..., description="Natural-language answer from the agent.")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Deduplicated search results consulted while answering.",
    )


# ── Agent state ─────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    total_images_sent: int
    iteration_count: int
    all_sources: Annotated[list, operator.add]


# ── Helpers ─────────────────────────────────────────────────────────────────
def _get_qa_config(request: Request) -> Dict[str, Any]:
    """Read QA-specific config from the ``qa`` section, falling back to defaults."""
    qa_cfg = getattr(getattr(request.app.state, "config", None), "qa", None)

    def _pick(attr: str, default):
        val = getattr(qa_cfg, attr, None) if qa_cfg else None
        return val if val is not None else default

    return {
        "model": _pick("model", DEFAULT_LLM_MODEL),
        "base_url": _pick("base_url", DEFAULT_LLM_BASE_URL),
        "temperature": float(_pick("temperature", 0)),
        "max_iterations": int(_pick("max_iterations", MAX_AGENT_ITERATIONS)),
        "max_total_images": int(_pick("max_total_images", MAX_TOTAL_IMAGES)),
        "max_images_per_call": int(_pick("max_images_per_call", MAX_IMAGES_PER_CALL)),
        "default_embedding_model": _pick("default_model", DEFAULT_EMBEDDING_MODEL),
        "debug": bool(_pick("debug", False)),
    }


async def _fetch_image_b64(url: str, timeout: float = 10.0) -> Optional[str]:
    """Download *url* and return its content as a base-64 string, or ``None``."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=timeout),
                ssl=False,
            ) as resp:
                if resp.status == 200:
                    return base64.b64encode(await resp.read()).decode()
    except Exception:
        pass
    return None


def _debug_print_message(label: str, msg) -> None:
    """Pretty-print a single LangChain message to stdout for debugging."""
    kind = type(msg).__name__
    content = getattr(msg, "content", "")
    # Truncate base64 images to keep output readable
    if isinstance(content, list):
        display_parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "image_url":
                display_parts.append({"type": "image_url", "image_url": "<base64 image omitted>"})
            else:
                display_parts.append(part)
        content_str = json.dumps(display_parts, default=str, indent=2)
    elif isinstance(content, str) and len(content) > 2000:
        content_str = content[:2000] + f"... ({len(content)} chars total)"
    else:
        content_str = str(content)
    tool_calls = getattr(msg, "tool_calls", None)
    tool_call_id = getattr(msg, "tool_call_id", None)
    extra = ""
    if tool_calls:
        extra += f"  tool_calls: {json.dumps(tool_calls, default=str)}"
    if tool_call_id:
        extra += f"  tool_call_id: {tool_call_id}"
    print(f"[QA DEBUG] [{label}] {kind}:{extra}\n{content_str}")
    print("─" * 80)


def _build_system_prompt(attribute_info: list) -> str:
    attrs = "\n".join(
        f"  - **{a.name}** ({a.type}): {a.description}" for a in attribute_info
    )
    return f"""\
You are a helpful assistant that answers questions about a user's lifelog – a continuous, \
first-person photo stream captured throughout each day, enriched with metadata.

You have ONE tool: **search_frames**.

### Tool parameters
| param | type | description |
|-------|------|-------------|
| `query` | string | Short semantic description of the visual scene to find (e.g. "conference presentation hall"). |
| `k` | int | Number of metadata results to return. Default 20; use 50-100 for counting / aggregation. |
| `num_images` | int | How many of the TOP results should include the actual image for you to see (0-2). Budget: ~{MAX_TOTAL_IMAGES} images total across the whole conversation. Set 0 when metadata alone suffices. |
| `filters` | object or null | Optional metadata filter. See examples below. |

### Filter syntax
Filters use comparator/operator JSON objects.
Comparators: eq, ne, gt, lt, lt, like.
Operators: and, or, not.

**Single filter:**
```json
{{"comparator": "like", "attribute": "city", "value": "%Dublin%"}}
```

**Combined filters:**
```json
{{"operator": "and", "arguments": [
    {{"comparator": "like", "attribute": "city", "value": "%Dublin%"}},
    {{"comparator": "gt", "attribute": "epoch", "value": 1570000000}}
]}}
```

**Epoch range (temporal succession):**
```json
{{"operator": "and", "arguments": [
    {{"comparator": "gt", "attribute": "epoch", "value": PREV_EPOCH}},
    {{"comparator": "lt", "attribute": "epoch", "value": PREV_EPOCH_PLUS_WINDOW}}
]}}
```

### Available metadata fields
{attrs}

### Reasoning strategies
1. **Start broad**: search with a semantic query, moderate k (40-50), 0-1 images.
2. **Temporal succession**: to find what happened AFTER a result, issue a new search \
with epoch filters: gte(epoch, prev_epoch) and lte(epoch, prev_epoch + window). \
A reasonable window is 60-3600 s depending on context.
3. **Counting & aggregation**: large k (50-150), 0 images. Then group by `hour_id` or \
by day (same year+month+day from epoch). Consecutive frames within the same hour belong \
to the same moment. For multi-day events (conferences, trips), group contiguous days as \
ONE event.
4. **Deduplication**: same `hour_id` → same moment. Epoch gap < 3600 s → likely same \
event. A conference spanning Mon-Wed counts as 1 conference, not 3.
5. **Visual verification**: only request images (num_images=1-2) when you genuinely need \
to see the scene. Most reasoning works with metadata alone.
6. **Refinement**: if results are too broad, add metadata filters (city, epoch range, etc.).

Do not ask questions back to the user. Use the tools and metadata to infer the answer.
Always give a clear, definitive natural-language answer at the end. Show your reasoning briefly."""


# ── Agent builder ───────────────────────────────────────────────────────────
def _build_agent(request: Request, max_iterations: int):
    """Return ``(compiled_graph, system_prompt)``."""
    qa_cfg = _get_qa_config(request)
    debug = qa_cfg["debug"]

    # Resolve default embedding model
    default_model = qa_cfg["default_embedding_model"]
    available = getattr(request.app.state, "available_models", [])
    if default_model not in available:
        if available:
            default_model = available[0]
        else:
            raise HTTPException(status_code=500, detail="No embedding models available.")

    attribute_info = request.app.state.loader.get_attribute_info()
    system_prompt = _build_system_prompt(attribute_info)

    # ── Search tool (closure over *request* and *default_model*) ────────
    @tool
    def search_frames(
        query: str,
        k: int = 20,
        num_images: int = 0,
        filters: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Search the lifelog for frames matching a semantic query.

        Args:
            query: Short semantic description of the visual scene to find.
            k: Number of metadata results to return. Use 50-100 for counting.
            num_images: How many top results to include images for (0-2).
            filters: Optional metadata filter object (comparator/operator).

        Returns:
            JSON array of results with id, score, and metadata.
        """
        num_img = min(max(num_images, 0), MAX_IMAGES_PER_CALL)

        node: Dict[str, Any] = {"item": query, "model": default_model, "k": k}
        if filters:
            node["filters"] = filters
        node_pg = convert_filters_to_pg(node)

        try:
            docs = request.app.state.vector_store.similarity_search(
                node_pg, k=k, filter=None, fetch_k=min(k * 10, 1000),
            )
        except Exception as exc:
            return json.dumps({"error": str(exc)})

        results: List[Dict[str, Any]] = []
        for idx, doc in enumerate(docs):
            meta = {mk: mv for mk, mv in doc.metadata.items() if mk != "score"}
            entry: Dict[str, Any] = {
                "id": doc.page_content,
                "score": round(float(doc.metadata.get("score", 0)), 4),
                "metadata": meta,
            }
            if idx < num_img:
                try:
                    entry["image_url"] = (
                        request.app.state.loader.get_collection_element_url_from_id(
                            doc.page_content, "images",
                        )
                    )
                except Exception:
                    pass
            results.append(entry)
        return json.dumps(results, default=str)

    tools = [search_frames]

    # ── LLM with and without tool binding ──────────────────────────────
    llm = ChatOllama(
        model=qa_cfg["model"],
        base_url=qa_cfg["base_url"],
        temperature=qa_cfg["temperature"],
    ).bind_tools(tools)

    llm_no_tools = ChatOllama(
        model=qa_cfg["model"],
        base_url=qa_cfg["base_url"],
        temperature=qa_cfg["temperature"],
    )

    # ── Graph nodes ────────────────────────────────────────────────────
    async def agent_node(state: AgentState) -> Dict[str, Any]:
        response = await llm.ainvoke(state["messages"])
        if debug:
            _debug_print_message("agent → LLM response", response)
        return {"messages": [response]}

    async def custom_tool_node(state: AgentState) -> Dict[str, Any]:
        """Execute tool calls, optionally fetch images, return ToolMessages."""
        last_msg = state["messages"][-1]
        total_images = state.get("total_images_sent", 0)
        new_sources: List[Dict[str, Any]] = []
        new_messages: list = []

        for tc in last_msg.tool_calls:
            result_str = await search_frames.ainvoke(tc["args"])

            try:
                results = json.loads(result_str)
            except json.JSONDecodeError:
                results = []

            if isinstance(results, list):
                new_sources.extend(results)

            # Fetch images for multimodal context
            image_parts: list = []
            if isinstance(results, list):
                for r in results:
                    img_url = r.get("image_url")
                    if img_url and total_images < MAX_TOTAL_IMAGES:
                        b64 = await _fetch_image_b64(img_url)
                        if b64:
                            image_parts.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                            })
                            total_images += 1

            # Compact text for LLM (strip image URLs to save context)
            if isinstance(results, list):
                compact = [
                    {rk: rv for rk, rv in r.items() if rk != "image_url"}
                    for r in results
                ]
                text = json.dumps(compact, default=str)
            else:
                text = result_str

            if image_parts:
                content: Any = [{"type": "text", "text": text}] + image_parts
            else:
                content = text

            new_messages.append(ToolMessage(content=content, tool_call_id=tc["id"]))

        if debug:
            for tm in new_messages:
                _debug_print_message("tools → ToolMessage", tm)

        return {
            "messages": new_messages,
            "total_images_sent": total_images,
            "iteration_count": state.get("iteration_count", 0) + 1,
            "all_sources": new_sources,
        }

    async def final_answer_node(state: AgentState) -> Dict[str, Any]:
        """When the iteration budget is exhausted, ask the LLM to summarise."""
        messages = list(state["messages"])
        # Replace the last tool-calling AI message with a clean one so the
        # conversation history is valid for the LLM (no dangling tool calls).
        if messages and hasattr(messages[-1], "tool_calls") and messages[-1].tool_calls:
            last = messages[-1]
            messages[-1] = AIMessage(
                content=last.content or "I have gathered enough information.",
            )
        messages.append(
            SystemMessage(
                content=(
                    "You have reached the maximum number of search iterations. "
                    "Based on ALL information gathered so far, provide your final, "
                    "clear natural-language answer to the user's question now."
                ),
            )
        )
        response = await llm_no_tools.ainvoke(messages)
        if debug:
            _debug_print_message("final_answer → LLM response", response)
        return {"messages": [response]}

    def should_continue(state: AgentState) -> Literal["tools", "final_answer", "__end__"]:
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            if state.get("iteration_count", 0) >= max_iterations:
                return "final_answer"
            return "tools"
        return "__end__"

    # ── Compile graph ──────────────────────────────────────────────────
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", custom_tool_node)
    graph.add_node("final_answer", final_answer_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "final_answer": "final_answer", "__end__": END},
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("final_answer", END)

    return graph.compile(), system_prompt


# ── Endpoint ────────────────────────────────────────────────────────────────
@router.post("/qa", response_model=QAResponse)
async def qa_endpoint(payload: QARequest, request: Request):
    """Answer a natural-language question about the lifelog using an agentic search chain."""
    max_iter = payload.max_iterations or MAX_AGENT_ITERATIONS
    agent, system_prompt = _build_agent(request, max_iter)

    qa_cfg = _get_qa_config(request)
    debug = qa_cfg["debug"]

    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=payload.question),
        ],
        "total_images_sent": 0,
        "iteration_count": 0,
        "all_sources": [],
    }

    if debug:
        print("=" * 80)
        print(f"[QA DEBUG] Starting QA agent  |  question: {payload.question}")
        print(f"[QA DEBUG] max_iterations={max_iter}")
        print("=" * 80)
        for msg in initial_state["messages"]:
            _debug_print_message("initial", msg)

    try:
        final_state = await agent.ainvoke(initial_state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QA agent failed: {exc}") from exc

    # Extract the final answer from the last AI message without tool calls
    answer = "I was unable to find an answer to your question."
    for msg in reversed(final_state["messages"]):
        if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
            content = msg.content
            if content:
                answer = content if isinstance(content, str) else str(content)
                break

    # Deduplicate sources by id
    seen: set = set()
    unique: List[Dict[str, Any]] = []
    for src in final_state.get("all_sources", []):
        sid = src.get("id")
        if sid and sid not in seen:
            seen.add(sid)
            unique.append(src)

    return QAResponse(answer=answer, sources=unique[:100])
