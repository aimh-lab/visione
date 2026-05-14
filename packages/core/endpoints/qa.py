"""/qa endpoint – Agentic QA over lifelog data.

Uses LangGraph to orchestrate a plan-then-execute loop: the agent first
creates a plan, then iterates with a ``search_frames`` tool that queries the
same vector-store used by ``/search``.  Results are streamed to the client
as Server-Sent Events (SSE) with typed tags so the UI can separate reasoning,
tool output, and the final answer.

SSE event types
---------------
- ``plan``        – the initial plan produced by the planning step
- ``plan_review`` – critical review / correction of the plan
- ``thinking``    – chain-of-thought / reasoning text from the LLM
- ``tool_call``   – JSON with tool name + arguments the agent is about to invoke
- ``tool_result`` – JSON array of search results returned by the tool
- ``evaluation``  – plausibility assessment of current conclusionst to invoke
- ``tool_result`` – JSON array of search results returned by the tool
- ``evaluation``  – plausibility assessment of current conclusions
- ``answer``      – the final natural-language answer
- ``answer_submit`` – concise final answer intended for DRES text submission
- ``sources``     – deduplicated source list (sent once, after ``answer``)
- ``error``       – an error message if something goes wrong
"""

from __future__ import annotations

import base64
import json
import operator
import re
import asyncio
import uuid
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
    plan_count: int
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
| `reorder_by` | list of strings or null | Optional list of metadata fields to reorder results by (e.g., ["epoch", "day"]). If null, results are returned in default relevance order. To be used with empty semantic queries. |

### Filter syntax
Filters use comparator/operator JSON objects.
Comparators: eq, ne, gt, gte lt, lte, ilike.
Operators: and, or, not.

**Single filter:**
```json
{{"comparator": "ilike", "attribute": "city", "value": "%Dublin%"}}
```

**Search by year, month, day:**
```json
{{"operator": "and", "arguments": [
    {{"comparator": "eq", "attribute": "year", "value": 2019}},
    {{"comparator": "eq", "attribute": "month", "value": 1}},
    {{"comparator": "eq", "attribute": "day", "value": 10}}
]}}
```

**Search across months (e.g., from 15 Jan to 7 Feb):**
```json
{{"operator": "or", "arguments": [
    {{"operator": "and", "arguments": [
        {{"comparator": "eq", "attribute": "month", "value": 1}},
        {{"comparator": "gte", "attribute": "day", "value": 15}}
    ]}},
    {{"operator": "and", "arguments": [
        {{"comparator": "eq", "attribute": "month", "value": 2}},
        {{"comparator": "lt", "attribute": "day", "value": 7}}
    ]}}
]}}
```

**Combined filters:**
```json
{{"operator": "and", "arguments": [
    {{"comparator": "ilike", "attribute": "city", "value": "%Dublin%"}},
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
3. **Counting & aggregation**: large k (in the order of 400-600). Then group by `hour_id` or \
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

Important:
- Notice that you can use "filters" alone to use only conditions on metadata. 
- Do not ask questions back to the user. Use the tools, the images and the metadata to infer the answer.
- If using only filter without a semantic query, use the reorder_by parameter to order results by a specific attribute (e.g., epoch if you want results returned in chronological order). Otherwise, results will be likely returned in a random order.
- If not sure about the answer, do not surrender. Try to call again the tool with a refined query or filters, also asking for images. Do not hallucinate, \
find evidence in the data or declare that the output is not reliable. Do not infer activities based on biases, instead LOOK at the images first.
- Before saying that metadata cannot confirm an hypothesis, ask for images to verify.
- Always use "ilike" with wildcards (e.g., "%Text%") for string matching. Use eq only for numeric fields.
- Consider that the search_frames tool can also sometimes return erroneous results (for example, zero results or irrelevant results). 
- If the results are empty, try to reformulate the query by checking if you are using the right operator (most likely you are using eq instead of ilike or filtering on the wrong metadata) or ask for images to verify.
- In the semantic query, do not use logic operators or keyword-like terms. Instead, write natural language descriptions.
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


def _build_plan_review_prompt() -> str:
    return """\
Critically review the original plan. Check for:
1. **Feasibility**: Can each step actually be performed with the search_frames tool?
2. **Completeness**: Are there steps missing that are needed to answer the question?
3. **Correctness**: Are the proposed filters, queries, and strategies appropriate?

If the plan is sound, output it unchanged with a brief "Plan approved." prefix.
If there are problems, output a corrected plan as a numbered list, prefixed with \
"Revised plan:" and a brief note on what was wrong.

Do NOT execute any tool calls yet."""


def _build_evaluation_prompt() -> str:
    return """\
Evaluate the conclusions reached so far. Consider:
1. **Evidence strength**: Are the conclusions well-supported by the search results and images?
2. **Consistency**: Do the results agree with each other, or are there contradictions?
3. **Completeness**: Has enough evidence been gathered to answer the question confidently?
4. **Plausibility**: Are the conclusions reasonable given the context?

Respond with a JSON object (and nothing else) with exactly two keys:
- "verdict": one of "confident", "uncertain", or "implausible"
- "reasoning": a brief explanation of your assessment

Examples:
{"verdict": "confident", "reasoning": "Multiple results consistently show the same location and time."}
{"verdict": "uncertain", "reasoning": "Only one result found and metadata is ambiguous; need images to verify."}
{"verdict": "implausible", "reasoning": "The top results contradict each other and none match the query well."}"""


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
        reorder_by: Optional[List[str]] = None,
    ) -> str:
        """Search the lifelog for frames matching a semantic query.

        Args:
            query: Possibly rich semantic description of the visual scene to find, which carefully includes all the details asked in the query.
            metadata_to_retrieve: List of metadata fields to include in the results
            k: Number of metadata results to return.
            num_images: How many top results to include images for.
            filters: Optional metadata filter object (comparator/operator).
            reorder_by: Optional list of metadata fields to reorder results by (e.g., ["epoch", "day"]). To be used with empty semantic queries.

        Returns:
            JSON array of results with id, score, and metadata.
        """
        num_img = min(max(num_images, 0), qa_cfg["max_images_per_call"])

        node: Dict[str, Any] = {"item": query, "model": default_model, "k": k}
        if filters:
            node["filters"] = filters
        node_pg = convert_filters_to_pg(node)
        if reorder_by and (not query or not query.strip()):
            node_pg["reorder_by"] = reorder_by

        try:
            doc_groups = request.app.state.vector_store.similarity_search(
                node_pg, k=k, filter=None, fetch_k=min(k * 10, 1000),
                metadata_to_retrieve=metadata_to_retrieve,
            )
        except Exception as exc:
            return json.dumps({"error": str(exc)})

        results: List[Dict[str, Any]] = []
        for idx, group in enumerate(doc_groups):
            doc = group[0]
            meta = {mk: mv for mk, mv in doc.metadata.items() if mk != "score"}
            entry: Dict[str, Any] = {
                "id": doc.page_content,
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
    MAX_PLAN_CYCLES = 3  # hard cap to avoid infinite replanning loops

    async def plan_node(state: AgentState) -> Dict[str, Any]:
        """Ask the LLM to produce a plan before executing any tool calls."""
        planning_messages = list(state["messages"]) + [
            HumanMessage(content=_build_planning_prompt()),
        ]
        response = await llm_no_tools.ainvoke(planning_messages)
        plan_text = response.content if isinstance(response.content, str) else str(response.content)
        if debug:
            _debug_print_message("plan → LLM response", response)
        return {
            "messages": [
                AIMessage(content=f"**Plan:**\n{plan_text}"),
            ],
            "plan": plan_text,
        }

    async def plan_review_node(state: AgentState) -> Dict[str, Any]:
        """Critically review the plan and correct inconsistencies."""
        review_messages = list(state["messages"]) + [
            HumanMessage(content=_build_plan_review_prompt()),
        ]
        response = await llm_no_tools.ainvoke(review_messages)
        review_text = response.content if isinstance(response.content, str) else str(response.content)
        if debug:
            _debug_print_message("plan_review → LLM response", response)
        return {
            "messages": [
                AIMessage(content=f"**Plan Review:**\n{review_text}"),
            ],
            "plan": review_text,
            "plan_count": state.get("plan_count", 0) + 1,
        }

    async def agent_node(state: AgentState) -> Dict[str, Any]:
        response = await llm.ainvoke(state["messages"])
        if debug:
            _debug_print_message("agent → LLM response", response)
        return {"messages": [response]}

    async def evaluate_node(state: AgentState) -> Dict[str, Any]:
        """Evaluate the plausibility of current conclusions."""
        eval_messages = list(state["messages"]) + [
            HumanMessage(content=_build_evaluation_prompt()),
        ]
        response = await llm_no_tools.ainvoke(eval_messages)
        eval_text = response.content if isinstance(response.content, str) else str(response.content)
        if debug:
            _debug_print_message("evaluate → LLM response", response)

        # Parse the verdict
        verdict = "confident"
        reasoning = eval_text
        try:
            parsed = json.loads(eval_text)
            if isinstance(parsed, dict):
                verdict = parsed.get("verdict", "confident")
                reasoning = parsed.get("reasoning", eval_text)
        except json.JSONDecodeError:
            # If LLM didn't produce valid JSON, treat as uncertain
            lower = eval_text.lower()
            if "implausible" in lower:
                verdict = "implausible"
            elif "uncertain" in lower:
                verdict = "uncertain"

        return {
            "messages": [
                AIMessage(content=f"**Evaluation ({verdict}):** {reasoning}"),
            ],
        }

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

    def should_continue(state: AgentState) -> Literal["tools", "final_answer", "evaluate"]:
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            if state.get("iteration_count", 0) >= max_iterations:
                return "final_answer"
            return "tools"
        # Agent finished reasoning – go to evaluation
        return "evaluate"

    def should_continue_after_eval(state: AgentState) -> Literal["plan", "__end__"]:
        """After evaluation, replan if uncertain/implausible (within budget)."""
        last_msg = state["messages"][-1]
        text = ""
        if isinstance(last_msg, AIMessage):
            text = last_msg.content if isinstance(last_msg.content, str) else str(last_msg.content)

        needs_replan = "(uncertain)" in text.lower() or "(implausible)" in text.lower()
        can_replan = state.get("plan_count", 1) < MAX_PLAN_CYCLES

        if needs_replan and can_replan:
            return "plan"
        return "__end__"

    # ── Compile graph ──────────────────────────────────────────────────
    graph = StateGraph(AgentState)
    graph.add_node("plan", plan_node)
    graph.add_node("plan_review", plan_review_node)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", custom_tool_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("final_answer", final_answer_node)
    graph.add_edge(START, "plan")
    graph.add_edge("plan_review", "agent")
    graph.add_edge("plan", "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "final_answer": "final_answer", "evaluate": "evaluate"},
    )
    graph.add_edge("tools", "agent")
    graph.add_conditional_edges(
        "evaluate",
        should_continue_after_eval,
        {"plan": "plan_review", "__end__": END},
    )
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


def _extract_submit_candidate(text: str) -> str:
    """Extract a concise answer candidate suitable for DRES text submit."""
    raw = str(text or "").strip()
    if not raw:
        return ""

    # 1) Prefer explicit entities highlighted in markdown bold.
    bold_matches = re.findall(r"\*\*([^*]+)\*\*", raw)
    if bold_matches:
        candidate = bold_matches[0].strip().strip(' "\'`')
        if candidate:
            return candidate

    # 2) Prefer quoted entities.
    quote_matches = re.findall(r"[\"']([^\"']{2,80})[\"']", raw)
    if quote_matches:
        candidate = quote_matches[0].strip().strip(' "\'`')
        if candidate:
            return candidate

    # Remove common markdown wrappers and fenced code blocks.
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    filtered: List[str] = []
    in_fence = False
    for ln in lines:
        if ln.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if ln.lower().startswith(("plan", "reasoning", "evidence", "sources")):
            continue
        filtered.append(ln)

    candidate = " ".join(filtered).strip() or raw

    # 3) Extract entity from common answer templates.
    patterns = [
        r"(?:located at|is|was|were|named|called)\s+(.+?)(?:\s+in\s+|\s+on\s+|\s+at\s+|,|\.|$)",
        r"(?:answer is|answer:|it is)\s+(.+?)(?:,|\.|$)",
    ]
    for pattern in patterns:
        m = re.search(pattern, candidate, flags=re.IGNORECASE)
        if not m:
            continue
        extracted = m.group(1).strip().strip(' "\'`')
        extracted = re.sub(r"^(the)\s+", "", extracted, flags=re.IGNORECASE).strip()
        if extracted:
            return extracted

    # 4) Fallback: first sentence/chunk, cleaned.
    for sep in [". ", "\n", ";"]:
        if sep in candidate:
            candidate = candidate.split(sep, 1)[0].strip()
            break

    candidate = candidate.strip(' "\'`')
    candidate = re.sub(r"^(the)\s+", "", candidate, flags=re.IGNORECASE).strip()
    return candidate


def _get_qa_runtime_registry(request: Request) -> Dict[str, Dict[str, Any]]:
    """Ensure and return in-memory registry for active QA streaming requests."""
    runtime = getattr(request.app.state, "qa_runtime", None)
    if not isinstance(runtime, dict):
        runtime = {"tasks": {}, "cancel_events": {}}
        request.app.state.qa_runtime = runtime

    runtime.setdefault("tasks", {})
    runtime.setdefault("cancel_events", {})
    return runtime


# ── Streaming endpoint ──────────────────────────────────────────────────────
@router.post("/qa")
async def qa_endpoint(payload: QARequest, request: Request):
    """Stream the QA agent reasoning as Server-Sent Events.

    Each SSE carries an ``event`` tag (``plan``, ``plan_review``, ``thinking``,
    ``tool_call``, ``tool_result``, ``evaluation``, ``answer``, ``sources``,
    ``error``) and a JSON ``data`` payload so the client can render them
    separately.
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
        "plan_count": 0,
        "all_sources": [],
    }

    if debug:
        print("=" * 80)
        print(f"[QA DEBUG] Starting QA agent  |  question: {payload.question}")
        print(f"[QA DEBUG] max_iterations={max_iter}")
        print("=" * 80)
        for msg in initial_state["messages"]:
            _debug_print_message("initial", msg)

    request_id = uuid.uuid4().hex
    runtime = _get_qa_runtime_registry(request)
    cancel_event = asyncio.Event()
    runtime["cancel_events"][request_id] = cancel_event
    current_task = asyncio.current_task()
    if current_task is not None:
        runtime["tasks"][request_id] = current_task

    async def _event_generator():
        """Yield SSE strings as the agent graph executes."""
        try:
            yield _sse_event("request_id", {"request_id": request_id})

            all_sources: List[Dict[str, Any]] = []
            final_answer: Optional[str] = None
            last_agent_text: Optional[str] = None

            async for event in agent.astream(initial_state, stream_mode="updates"):
                if cancel_event.is_set():
                    yield _sse_event("cancelled", {"request_id": request_id})
                    return

                # *event* is a dict mapping node-name → state-update produced by that node
                for node_name, update in event.items():
                    if cancel_event.is_set():
                        yield _sse_event("cancelled", {"request_id": request_id})
                        return

                    messages = update.get("messages", [])

                    # -- Plan node -------------------------------------------------
                    if node_name == "plan":
                        plan_text = update.get("plan", "")
                        if plan_text:
                            yield _sse_event("plan", {"plan": plan_text})

                    # -- Plan review node ------------------------------------------
                    elif node_name == "plan_review":
                        plan_text = update.get("plan", "")
                        if plan_text:
                            yield _sse_event("plan_review", {"review": plan_text})

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

                    # -- Evaluate node ---------------------------------------------
                    elif node_name == "evaluate":
                        for msg in messages:
                            if isinstance(msg, AIMessage):
                                text = msg.content
                                text_str = (text if isinstance(text, str) else str(text)) if text else ""
                                if text_str.strip():
                                    yield _sse_event("evaluation", {"content": text_str})

            # If the agent ended naturally (no final_answer node), the last
            # AIMessage without tool_calls is the answer.
            if final_answer is None and last_agent_text:
                final_answer = last_agent_text

            if final_answer:
                yield _sse_event("answer", {"content": final_answer})
                submit_candidate = _extract_submit_candidate(final_answer)
                if submit_candidate:
                    yield _sse_event("answer_submit", {"content": submit_candidate})

            # Deduplicate and emit sources
            seen: set = set()
            unique: List[Dict[str, Any]] = []
            for src in all_sources:
                sid = src.get("id")
                if sid and sid not in seen:
                    seen.add(sid)
                    unique.append(src)
            yield _sse_event("sources", {"sources": unique[:100]})

        except asyncio.CancelledError:
            # Request was cancelled via DELETE /qa/{request_id}.
            return
        except Exception as exc:
            yield _sse_event("error", {"detail": str(exc)})
        finally:
            runtime["tasks"].pop(request_id, None)
            runtime["cancel_events"].pop(request_id, None)

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/qa/{request_id}")
async def qa_cancel_endpoint(request_id: str, request: Request):
    """Cancel an in-flight streaming QA request by its request_id."""
    runtime = _get_qa_runtime_registry(request)
    cancel_event = runtime["cancel_events"].get(request_id)
    task = runtime["tasks"].get(request_id)

    if cancel_event is None and task is None:
        return {"cancelled": False, "request_id": request_id, "reason": "not-found"}

    if cancel_event is not None:
        cancel_event.set()

    if task is not None and not task.done():
        task.cancel()

    return {"cancelled": True, "request_id": request_id}


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
        "plan_count": 0,
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
