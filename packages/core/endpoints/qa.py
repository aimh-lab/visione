"""/qa endpoint – Agentic QA over lifelog data.

Uses LangGraph to orchestrate a plan-then-execute loop: the agent first
creates a plan, then iterates with a ``search_frames`` tool that queries the
same vector-store used by ``/search``.  Results are streamed to the client
as Server-Sent Events (SSE) with typed tags so the UI can separate reasoning,
tool output, and the final answer.

SSE event types
---------------
- ``thinking``    – chain-of-thought / reasoning text from the LLM
- ``plan``        – the initial plan produced by the planning step
- ``tool_call``   – JSON with tool name + arguments the agent is about to invoke
- ``tool_result`` – JSON array of search results returned by the tool
- ``answer``      – the final natural-language answer
- ``sources``     – deduplicated source list (sent once, after ``answer``)
- ``error``       – an error message if something goes wrong
"""

from __future__ import annotations

import base64
import json
import operator
from typing import Any, Dict, List, Literal, Optional, Annotated

import aiohttp
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from endpoints.search import convert_filters_to_pg

router = APIRouter()

# ── Request / Response models ──────────────────────────────────────────────
class QARequest(BaseModel):
    question: str = Field(..., description="Natural-language question about the lifelog.")
    max_iterations: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Optional override for max search iterations; defaults to config value.",
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
    plan: str
    total_images_sent: int
    iteration_count: int
    all_sources: Annotated[list, operator.add]


# ── Helpers ─────────────────────────────────────────────────────────────────
def _get_qa_config(request: Request) -> Dict[str, Any]:
    """Read required QA config from the ``qa`` section; fail if missing/invalid."""
    qa_cfg = getattr(getattr(request.app.state, "config", None), "qa", None)
    print(f"[QA DEBUG] Loaded QA config: {qa_cfg}")

    if qa_cfg is None:
        raise HTTPException(status_code=500, detail="Missing required 'qa' configuration section.")

    def _require(attr: str) -> Any:
        val = getattr(qa_cfg, attr, None)
        if val is None:
            raise HTTPException(
                status_code=500,
                detail=f"Missing required 'qa.{attr}' configuration value.",
            )
        return val

    try:
        cfg = {
            "model": str(_require("model")),
            "base_url": str(_require("base_url")),
            "temperature": float(_require("temperature")),
            "max_iterations": int(_require("max_iterations")),
            "max_total_images": int(_require("max_total_images")),
            "max_images_per_call": int(_require("max_images_per_call")),
            "default_embedding_model": str(_require("default_model")),
            "debug": bool(_require("debug")),
        }
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Invalid 'qa' configuration value: {exc}") from exc

    if cfg["max_iterations"] < 1 or cfg["max_iterations"] > 10:
        raise HTTPException(
            status_code=500,
            detail="Invalid 'qa.max_iterations': must be between 1 and 10.",
        )
    if cfg["max_total_images"] < 0:
        raise HTTPException(
            status_code=500,
            detail="Invalid 'qa.max_total_images': must be >= 0.",
        )
    if cfg["max_images_per_call"] < 0:
        raise HTTPException(
            status_code=500,
            detail="Invalid 'qa.max_images_per_call': must be >= 0.",
        )

    return cfg


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


def _build_system_prompt(attribute_info: list, max_total_images: int, max_images_per_call: int) -> str:
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
| `query` | string | Possibly rich semantic description of the visual scene to find, which carefully includes all the details asked in the query. Can be "" if only filters should be applied. |
| `k` | int | Number of metadata results to return. Default 50. |
| `num_images` | int | How many of the TOP results should include the actual image for you to see. Max per call: {max_images_per_call}. Budget: ~{max_total_images} images total across the whole conversation. Set 0 when metadata alone suffices. |
| `filters` | object or null | Optional metadata filter. See examples below. |
| `metadata_to_retrieve` | list of strings | List of metadata fields to include in the results. |

### Filter syntax
Filters use comparator/operator JSON objects.
Comparators: eq, ne, gt, lt, like.
Operators: and, or, not.
NOT ALLOWED: lte, gte (use lt or gt instead).
TIPS: always use "like" with wildcards (e.g., "%Text%") for string matching. Use eq only for numeric fields.

**Single filter:**
```json
{{"comparator": "like", "attribute": "city", "value": "%Dublin%"}}
```

**Search by year, month, day:**
```json
{{"operator": "and", "arguments": [
    {{"comparator": "eq", "attribute": "year", "value": 2019}},
    {{"comparator": "eq", "attribute": "month", "value": 1}},
    {{"comparator": "eq", "attribute": "day", "value": 10}}
]}}
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

**Look at a specific image (in this case, do not specify the textual query)**
```
{{"comparator": "eq", "attribute": "image_name", "value": "20190110_101531_000.jpg"}}
```

### Available metadata fields
{attrs}

### Reasoning strategies
1. **Start broad**: search with a semantic query, moderate k (40-50), 1-2 images.
2. **Temporal succession**: to find what happened AFTER a result, issue a new search \
with epoch filters: gt(epoch, prev_epoch) and lt(epoch, prev_epoch + window). \
Same for a query including what happened BEFORE, but using lt(epoch, prev_epoch) and gt(epoch, prev_epoch - window).
A reasonable window is 60-3600 s depending on context.
3. **Counting & aggregation**: large k (1000). Then group by `hour_id` or \
by day (same year+month+day from epoch). Consecutive frames within the same hour belong \
to the same moment. For multi-day events (conferences, trips), group contiguous days as \
ONE event.
4. **Deduplication**: same `hour_id` → same moment. Epoch gap < 3600 s → likely same \
event.
5. **Visual verification**: request large number of images (num_images=5-8) when you need \
to see the scenes. You can also request image by their ids. Important: rather than trying to infer results by using different queries, \
use a broader query and then visually verify the top results.
(filter on `image_name`) by leaving the query empty to verify specific moments.
6. **Refinement**: if results are too broad, add metadata filters (city, epoch range, etc.) and start again with a narrower query.

Also:
- Notice that you can use "filters" alone to use only conditions on metadata. 
- Do not ask questions back to the user. Use the tools, the images and the metadata to infer the answer.
- If not sure about the answer, do not surrender. Try to call again the tool with a refined query or filters, also asking for images. Do not hallucinate, \
find evidence in the data or declare that the output is not reliable. Do not infer activities based on biases, instead LOOK at the images first.
- Before saying that metadata cannot confirm an hypothesis, ask for images to verify.
- Consider that the search_frames tool can also sometimes return erroneous results (for example, zero results or irrelevant results). If the results are empty, try to reformulate the query or ask for images to verify.
- Do not say things like "I will now search...". Just continue calling the tool without explicitly saying so.
- Always give a clear, definitive natural-language answer at the end. Show your reasoning briefly.
- When providing the final answer, DO NOT repeat the full list of results or metadata. Summarise the evidence briefly."""


def _build_planning_prompt() -> str:
    return """\
Based on the user's question and the system instructions above, create a brief \
step-by-step plan for how you will answer this question. Consider:
1. What searches you need to perform (queries, filters, number of results).
2. Whether you need images or metadata is sufficient.
3. How you might refine or verify results.
4. Any temporal reasoning or counting strategies required.

Output ONLY the plan as a numbered list. Do NOT execute any tool calls yet."""


# ── Agent builder ───────────────────────────────────────────────────────────
def _build_agent(request: Request, qa_cfg: Dict[str, Any], max_iterations: int):
    """Return ``(compiled_graph, system_prompt)``."""
    debug = qa_cfg["debug"]

    # Resolve default embedding model
    default_model = qa_cfg["default_embedding_model"]
    available = [m["name"] for m in getattr(request.app.state, "available_models", [])]
    if default_model not in available:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Configured qa.default_model '{default_model}' is not available. "
                f"Available models: {available}"
            ),
        )

    attribute_info = request.app.state.loader.get_attribute_info()
    system_prompt = _build_system_prompt(
        attribute_info,
        max_total_images=qa_cfg["max_total_images"],
        max_images_per_call=qa_cfg["max_images_per_call"],
    )

    # ── Search tool (closure over *request* and *default_model*) ────────
    @tool
    def search_frames(
        query: str,
        metadata_to_retrieve: List[str],
        k: int = 50,
        num_images: int = 0,
        filters: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Search the lifelog for frames matching a semantic query.

        Args:
            query: Possibly rich semantic description of the visual scene to find, which carefully includes all the details asked in the query.
            metadata_to_retrieve: List of metadata fields to include in the results
            k: Number of metadata results to return.
            num_images: How many top results to include images for.
            filters: Optional metadata filter object (comparator/operator).

        Returns:
            JSON array of results with id, score, and metadata.
        """
        num_img = min(max(num_images, 0), qa_cfg["max_images_per_call"])

        node: Dict[str, Any] = {"item": query, "model": default_model, "k": k}
        if filters:
            node["filters"] = filters
        node_pg = convert_filters_to_pg(node)

        try:
            docs = request.app.state.vector_store.similarity_search(
                node_pg, k=k, filter=None, fetch_k=min(k * 10, 1000),
                metadata_to_retrieve=metadata_to_retrieve,
            )
        except Exception as exc:
            return json.dumps({"error": str(exc)})

        results: List[Dict[str, Any]] = []
        for idx, doc in enumerate(docs):
            meta = {mk: mv for mk, mv in doc.metadata.items() if mk != "score"}
            entry: Dict[str, Any] = {
                "id": doc.page_content,
                # "score": round(float(doc.metadata.get("score", 0)), 4),
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
    async def plan_node(state: AgentState) -> Dict[str, Any]:
        """Ask the LLM to produce a plan before executing any tool calls."""
        planning_messages = list(state["messages"]) + [
            HumanMessage(content=_build_planning_prompt()),
        ]
        response = await llm_no_tools.ainvoke(planning_messages)
        plan_text = response.content if isinstance(response.content, str) else str(response.content)
        if debug:
            _debug_print_message("plan → LLM response", response)
        # Inject the plan into the conversation so the agent can follow it
        return {
            "messages": [
                AIMessage(content=f"**Plan:**\n{plan_text}"),
            ],
            "plan": plan_text,
        }

    async def agent_node(state: AgentState) -> Dict[str, Any]:
        response = await llm.ainvoke(state["messages"])
        if debug:
            _debug_print_message("agent → LLM response", response)
        return {"messages": [response]}

    async def custom_tool_node(
        state: AgentState,
        handle_tool_errors: bool = True,
    ) -> Dict[str, Any]:
        """Execute tool calls, optionally fetch images, return ToolMessages."""
        last_msg = state["messages"][-1]
        total_images = state.get("total_images_sent", 0)
        new_sources: List[Dict[str, Any]] = []
        new_messages: list = []

        for tc in last_msg.tool_calls:
            try:
                result_str = await search_frames.ainvoke(tc["args"])
            except Exception as exc:
                if not handle_tool_errors:
                    raise
                error_text = f"{type(exc).__name__}: {exc}"
                new_messages.append(ToolMessage(content=error_text, tool_call_id=tc["id"]))
                continue

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
                    if img_url and total_images < qa_cfg["max_total_images"]:
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
    graph.add_node("plan", plan_node)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", custom_tool_node)
    graph.add_node("final_answer", final_answer_node)
    graph.add_edge(START, "plan")
    graph.add_edge("plan", "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "final_answer": "final_answer", "__end__": END},
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("final_answer", END)

    return graph.compile(), system_prompt


# ── SSE helpers ─────────────────────────────────────────────────────────────
def _sse_event(event: str, data: Any) -> str:
    """Format a single Server-Sent Event."""
    payload = json.dumps(data, default=str) if not isinstance(data, str) else data
    return f"event: {event}\ndata: {payload}\n\n"


def _extract_tool_result_text(content: Any) -> Any:
    """Return only the JSON-parseable text portion of a ToolMessage content."""
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                try:
                    return json.loads(part["text"])
                except json.JSONDecodeError:
                    return part["text"]
    return content


# ── Streaming endpoint ──────────────────────────────────────────────────────
@router.post("/qa")
async def qa_endpoint(payload: QARequest, request: Request):
    """Stream the QA agent reasoning as Server-Sent Events.

    Each SSE carries an ``event`` tag (``plan``, ``thinking``, ``tool_call``,
    ``tool_result``, ``answer``, ``sources``, ``error``) and a JSON ``data``
    payload so the client can render them separately.
    """
    try:
        qa_cfg = _get_qa_config(request)
    except HTTPException as exc:
        # Can't stream yet – return plain error
        raise exc

    debug = qa_cfg["debug"]
    max_iter = payload.max_iterations if payload.max_iterations is not None else qa_cfg["max_iterations"]

    try:
        agent, system_prompt = _build_agent(request, qa_cfg, max_iter)
    except HTTPException as exc:
        raise exc

    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=payload.question),
        ],
        "plan": "",
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

    async def _event_generator():
        """Yield SSE strings as the agent graph executes."""
        try:
            all_sources: List[Dict[str, Any]] = []
            final_answer: Optional[str] = None
            last_agent_text: Optional[str] = None

            async for event in agent.astream(initial_state, stream_mode="updates"):
                # *event* is a dict mapping node-name → state-update produced by that node
                for node_name, update in event.items():
                    messages = update.get("messages", [])

                    # -- Plan node -------------------------------------------------
                    if node_name == "plan":
                        plan_text = update.get("plan", "")
                        if plan_text:
                            yield _sse_event("plan", {"plan": plan_text})

                    # -- Agent node (LLM reasoning / tool-call decisions) ----------
                    elif node_name == "agent":
                        for msg in messages:
                            if isinstance(msg, AIMessage):
                                has_tool_calls = bool(getattr(msg, "tool_calls", None))
                                text = msg.content
                                text_str = (text if isinstance(text, str) else str(text)) if text else ""

                                if has_tool_calls:
                                    # Agent is requesting tool calls – emit thinking
                                    if text_str.strip():
                                        yield _sse_event("thinking", {"content": text_str})
                                    for tc in msg.tool_calls:
                                        yield _sse_event("tool_call", {
                                            "tool": tc.get("name", "search_frames"),
                                            "arguments": tc.get("args", {}),
                                        })
                                    last_agent_text = None
                                else:
                                    # No tool calls – this is either intermediate
                                    # reasoning or the final answer.
                                    if text_str.strip():
                                        yield _sse_event("thinking", {"content": text_str})
                                        last_agent_text = text_str

                    # -- Tool node (search results) --------------------------------
                    elif node_name == "tools":
                        new_sources = update.get("all_sources", [])
                        all_sources.extend(new_sources)

                        # Stream the full sources (with image_url) rather than
                        # the compact ToolMessage content (which strips them).
                        if new_sources:
                            yield _sse_event("tool_result", {"results": new_sources})

                    # -- Final-answer node -----------------------------------------
                    elif node_name == "final_answer":
                        for msg in messages:
                            if isinstance(msg, AIMessage):
                                text = msg.content
                                if text:
                                    final_answer = text if isinstance(text, str) else str(text)

            # If the agent ended naturally (no final_answer node), the last
            # AIMessage without tool_calls is the answer.
            if final_answer is None and last_agent_text:
                final_answer = last_agent_text

            if final_answer:
                yield _sse_event("answer", {"content": final_answer})

            # Deduplicate and emit sources
            seen: set = set()
            unique: List[Dict[str, Any]] = []
            for src in all_sources:
                sid = src.get("id")
                if sid and sid not in seen:
                    seen.add(sid)
                    unique.append(src)
            yield _sse_event("sources", {"sources": unique[:100]})

        except Exception as exc:
            yield _sse_event("error", {"detail": str(exc)})

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Non-streaming endpoint (kept for backward compatibility) ────────────────
@router.post("/qa/sync", response_model=QAResponse)
async def qa_sync_endpoint(payload: QARequest, request: Request):
    """Answer a natural-language question (non-streaming, returns full JSON)."""
    qa_cfg = _get_qa_config(request)
    debug = qa_cfg["debug"]
    max_iter = payload.max_iterations if payload.max_iterations is not None else qa_cfg["max_iterations"]
    agent, system_prompt = _build_agent(request, qa_cfg, max_iter)

    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=payload.question),
        ],
        "plan": "",
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
