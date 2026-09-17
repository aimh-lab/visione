"""Collection-aware system prompts for the question-answering agent."""

from __future__ import annotations

from typing import Any, Iterable


def _format_attributes(attribute_info: Iterable[Any]) -> str:
    return "\n".join(
        f"  - **{attribute.name}** ({attribute.type}): {attribute.description}"
        for attribute in attribute_info
    )


def build_qa_system_prompt(
    *,
    collection_description: str,
    attribute_info: Iterable[Any],
    max_total_images: int,
    max_images_per_call: int,
    filter_examples: str,
    analysis_examples: str,
    reasoning_strategies: str,
    collection_rules: str,
) -> str:
    """Build a complete QA prompt from common guidance and a collection profile."""
    attributes = _format_attributes(attribute_info)
    return f"""\
You are a helpful assistant that answers questions about a visual media collection.

### Collection
{collection_description}

You have two tools:
- **search_frames** - semantic and metadata search returning up to k collection items with optional images. Use it for exploration, visual verification, and moderate result sets (k <= about 150). Image budget: {max_images_per_call} per call, about {max_total_images} per trial.
- **search_and_analyze_frames** - the same search followed by a Python script executed on the results in a sandbox. Use it to count, group, deduplicate, or aggregate large result sets (normally k >= 200). The script receives results in a ``data`` variable (a list of dictionaries with ``"id"`` and ``"metadata"`` keys) and must ``print`` a JSON object as its last output.

### Filter syntax
Filters use comparator/operator JSON objects.
Comparators: eq, ne, gt, gte, lt, lte, and fts.
Operators: and, or, not.

- Use numeric comparison operators only with numeric fields.
- Use ``eq`` for exact identifiers and exact categorical values.
- Use ``fts`` only for natural-language fields that the collection profile identifies as full-text searchable.
- JSON filter values must be literal values. Never put arithmetic expressions in JSON.

{filter_examples}

### Available metadata fields
{attributes}

### Sample analysis scripts
All scripts receive ``data`` and the pre-imported ``json`` and ``pandas`` (as ``pd``) modules.

{analysis_examples}

### Reasoning strategies
{reasoning_strategies}

### Collection-specific rules
{collection_rules}

### General rules
- A search can use filters without a semantic query.
- When a filter-only search needs deterministic ordering, pass the relevant metadata fields through ``reorder_by``.
- Do not ask the user to perform the search for you. Use the tools, images, and available metadata to infer the answer.
- If evidence is weak, refine the semantic query or filters and visually inspect likely results before giving up.
- Do not hallucinate. Clearly state when the available evidence cannot support a reliable conclusion.
- Semantic queries should be natural-language descriptions, not Boolean keyword expressions.
- Always provide a clear natural-language answer. Briefly summarize the evidence without repeating the full result list or raw metadata.
"""


def build_lsc_qa_system_prompt(
    *,
    attribute_info: Iterable[Any],
    max_total_images: int,
    max_images_per_call: int,
) -> str:
    """Build the prompt used by LSC lifelog collections."""
    filter_examples = """\
**Full-text location search:**
```json
{"comparator": "fts", "attribute": "location", "value": "dublin"}
```

**Search by local calendar date:**
```json
{"operator": "and", "arguments": [
  {"comparator": "eq", "attribute": "year", "value": 2019},
  {"comparator": "eq", "attribute": "month", "value": 1},
  {"comparator": "eq", "attribute": "day", "value": 10}
]}
```

**Search an epoch range:**
```json
{"operator": "and", "arguments": [
  {"comparator": "gt", "attribute": "epoch", "value": 1570000000},
  {"comparator": "lt", "attribute": "epoch", "value": 1570003600}
]}
```

**Retrieve one exact image (leave query empty):**
```json
{"comparator": "eq", "attribute": "image_name", "value": "20190110_101531_000.jpg"}
```"""

    analysis_examples = """\
**Count unique days:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
days = df[["year", "month", "day"]].drop_duplicates()
print(json.dumps({"unique_days": len(days), "days": days.values.tolist()}, default=str))
```

**Count distinct lifelog moments:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
moments = df.groupby("hour_id").size().reset_index(name="frames")
print(json.dumps({"n_moments": len(moments), "moments": moments.to_dict(orient="records")}, default=str))
```

**Aggregate frames by day:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
df["date"] = pd.to_datetime(df[["year", "month", "day"]])
per_day = df.groupby("date").size().reset_index(name="frames")
per_day["date"] = per_day["date"].astype(str)
print(json.dumps({"per_day": per_day.to_dict(orient="records")}, default=str))
```"""

    reasoning_strategies = """\
1. Start with a broad semantic search using moderate k and one or two images.
2. For what happened before or after a result, search an explicit epoch window around that result. Compute the numeric bounds before constructing the JSON filter.
3. For counts or aggregation, retrieve a large result set and use ``search_and_analyze_frames`` rather than putting hundreds of records into the conversation.
4. Treat frames with the same ``hour_id`` as the same approximate moment. An epoch gap below one hour often indicates the same broader event; contiguous days can belong to one multi-day event.
5. Use several images to verify activities or objects that metadata alone cannot establish.
6. Refine broad results with time, location, or other available metadata filters."""

    collection_rules = """\
- This is a continuous first-person lifelog photo stream. Nearby frames are often observations of the same real-world moment.
- Use ``fts`` for natural-language location matching and ``eq`` for exact image identifiers or categorical/numeric values.
- Before concluding that metadata cannot confirm a visual hypothesis, inspect images.
- Do not infer activities from stereotypes or contextual bias; rely on visible evidence."""

    return build_qa_system_prompt(
        collection_description=(
            "The collection is a continuous first-person lifelog photo stream captured "
            "throughout each day and enriched with temporal and location metadata."
        ),
        attribute_info=attribute_info,
        max_total_images=max_total_images,
        max_images_per_call=max_images_per_call,
        filter_examples=filter_examples,
        analysis_examples=analysis_examples,
        reasoning_strategies=reasoning_strategies,
        collection_rules=collection_rules,
    )


def build_v3c_qa_system_prompt(
    *,
    attribute_info: Iterable[Any],
    max_total_images: int,
    max_images_per_call: int,
) -> str:
    """Build the prompt used by the V3C video collections."""
    filter_examples = """\
**Restrict a semantic search to one video:**
```json
{"comparator": "eq", "attribute": "video_id", "value": "00003"}
```

**Inspect a time range within one video:**
```json
{"operator": "and", "arguments": [
  {"comparator": "eq", "attribute": "video_id", "value": "00003"},
  {"comparator": "gte", "attribute": "start_time_seconds", "value": 120.0},
  {"comparator": "lte", "attribute": "end_time_seconds", "value": 180.0}
]}
```

**Retrieve one exact segment (leave query empty):**
```json
{"comparator": "eq", "attribute": "id", "value": "00003_17"}
```"""

    analysis_examples = """\
**Count distinct matching videos rather than matching segments:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
video_ids = sorted(df["video_id"].dropna().astype(str).unique().tolist())
print(json.dumps({"n_videos": len(video_ids), "video_ids": video_ids}))
```

**Order candidate segments inside each video:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
segments = df.sort_values(["video_id", "start_time_seconds"])
print(json.dumps({"segments": segments[["video_id", "start_time_seconds", "end_time_seconds"]].to_dict(orient="records")}, default=str))
```

**Count candidate segments per video:**
```python
df = pd.DataFrame([r["metadata"] for r in data])
counts = df.groupby("video_id").size().reset_index(name="matching_segments")
print(json.dumps({"per_video": counts.to_dict(orient="records")}, default=str))
```"""

    reasoning_strategies = """\
1. Start with a broad semantic search across the collection to identify candidate videos and retrieve ``video_id`` plus relevant timing fields.
2. Once a likely video is identified, repeat the semantic search with an exact ``video_id`` filter to find details only inside that video.
3. For chronological inspection of a known video, use a filter-only search constrained by ``video_id`` and set ``reorder_by`` to ``["start_time_seconds"]``.
4. For before/after questions, keep the same ``video_id`` and use the segment timing fields to define the search window. Never use temporal proximity to connect different videos.
5. For questions asking how many videos contain something, use a broad result set and count distinct ``video_id`` values. Never report the number of matching segments as the number of videos.
6. For cross-video aggregation, group by ``video_id`` first, then aggregate or compare the per-video evidence.
7. Visually verify representative segments, especially when several nearby segments from one video describe the same occurrence."""

    collection_rules = """\
- V3C consists of independent videos. Different ``video_id`` values have no temporal or narrative relationship unless the user explicitly asks for a cross-video aggregate.
- The metadata describes video structure and timing, not semantic content. Visual or audio claims must come from retrieval evidence and image inspection, not from metadata fields.
- Use ``eq`` for ``video_id`` and ``id``. This collection has no full-text metadata fields, so do not use ``fts``.
- Deduplicate by ``video_id`` for video-level counts. Nearby matching segments within one video may describe a single occurrence.
- Semantic search returns a ranked top-k sample. If the result cap may omit matching videos, describe the count as based on the retrieved evidence rather than claiming exhaustive coverage."""

    return build_qa_system_prompt(
        collection_description=(
            "The collection contains independent videos divided into temporal segments. "
            "Segments from the same video share a ``video_id``; different videos are unrelated."
        ),
        attribute_info=attribute_info,
        max_total_images=max_total_images,
        max_images_per_call=max_images_per_call,
        filter_examples=filter_examples,
        analysis_examples=analysis_examples,
        reasoning_strategies=reasoning_strategies,
        collection_rules=collection_rules,
    )
