import { findResultsArray, extractImageInfo } from "../utils/results";

function normalizeTupleArray(item) {
  if (!Array.isArray(item)) return null;
  // Keep null/'' placeholder slots in place (a partial/relaxed temporal
  // match: e.g. step 1 found no frame in the window, so the backend sends
  // [null, "frameId"] for that row) instead of filtering them out — doing
  // so used to shrink a 2-slot tuple down to a bare length-1 array before
  // tupleSize/tupleMemberIndex were computed from it, making the surviving
  // frame look like it wasn't part of any tuple at all (no badge shown,
  // instead of correctly showing e.g. "2/2"). Only bail out to null (no
  // tuple at all) when EVERY slot is empty.
  const hasAnyMember = item.some((entry) => entry != null && entry !== '');
  return hasAnyMember ? item : null;
}

function extractTupleMemberId(entry) {
  if (entry && typeof entry === 'object') {
    return String(entry?.id || entry?.imgId || entry?.imageId || '').trim();
  }
  return String(entry || '').trim();
}

function tupleGroupKeyFrom(tupleItems, fallbackIndex) {
  if (!Array.isArray(tupleItems) || tupleItems.length === 0) return `tuple-${fallbackIndex}`;
  const ids = tupleItems.map(extractTupleMemberId).filter(Boolean).sort();
  return ids.length > 0 ? ids.join('|') : `tuple-${fallbackIndex}`;
}

function expandTupleAwareItems(arr) {
  const expanded = [];

  // The backend's temporal chain-building INNER JOINs every step together,
  // then dedups a chain that visits the same frame id twice (one frame
  // satisfying more than one step) by collapsing it down to that frame's
  // single distinct id — with NO null placeholder and no marker of which
  // step(s) it represents (see pg_async_store.py's _atemporal_join_search:
  // _deduped/_chains). So a temporal query's results can legitimately mix
  // full N-length rows with shorter collapsed rows, and there is nothing in
  // the payload itself saying "this is a temporal search with N steps".
  // We infer N as the longest array seen across this whole result set: for
  // a non-temporal search every row is already array-length 1 (so this is a
  // no-op), and for a temporal search the true full-length matches vastly
  // outnumber the rare collapsed ones, so the max is N with high
  // confidence. A row shorter than that max is then known to have satisfied
  // EVERY step (that's the only way its chain could exist at all) — exact
  // for the common N=2 case; for N>2 this can't recover exactly *which*
  // steps a partially-collapsed row matched (that information is destroyed
  // by the backend's DISTINCT-on-id dedup), so it's shown as having matched
  // all of them, a reasonable best-effort label rather than a missing one.
  const maxTupleLength = arr.reduce((max, rawItem) => (
    Array.isArray(rawItem) ? Math.max(max, rawItem.length) : max
  ), 1);

  arr.forEach((rawItem, tupleRank) => {
    const tupleItems = normalizeTupleArray(rawItem);
    if (!tupleItems) {
      expanded.push({
        rawItem,
        tupleItems: null,
        tupleSize: 1,
        tupleRank,
        tupleMemberIndex: 0,
        matchedTupleMemberIndexes: null,
        tupleGroupKey: null
      });
      return;
    }

    const tupleGroupKey = tupleGroupKeyFrom(tupleItems, tupleRank);
    const isCollapsedMatch = maxTupleLength > 1 && tupleItems.length < maxTupleLength;
    const tupleSize = isCollapsedMatch ? maxTupleLength : tupleItems.length;
    const collapsedMatchIndexes = isCollapsedMatch
      ? Array.from({ length: tupleSize }, (_, i) => i)
      : null;

    // This one tuple's own steps can legitimately match the same frame more
    // than once (e.g. one image satisfies both step 1 and step 2 of this
    // exact sequence). Collapse those into a single flattened entry carrying
    // every member index it matched (matchedTupleMemberIndexes), scoped
    // strictly to members of THIS tuple — not to be confused with the
    // separate, unrelated cross-tuple imgId dedup in searchController.js's
    // dedupeByTopRank, which drops coincidental imgId collisions between
    // otherwise-unrelated tuples and must NOT merge those (they aren't the
    // same sequence match).
    const expandedIndexByMemberId = new Map();
    tupleItems.forEach((member, memberIndex) => {
      // An empty/null slot (unmatched step of a partial tuple) has no frame
      // to render — skip it, but memberIndex above still reflects its real,
      // original position in the tuple, which the surviving members below
      // keep (tupleSize also still reflects the tuple's true, un-filtered
      // length), so their badge shows the correct step number.
      if (member == null || member === '') return;

      const memberId = extractTupleMemberId(member);
      const existingIndex = memberId ? expandedIndexByMemberId.get(memberId) : undefined;
      if (existingIndex !== undefined) {
        const existingEntry = expanded[existingIndex];
        const priorMatches = existingEntry.matchedTupleMemberIndexes || [existingEntry.tupleMemberIndex];
        existingEntry.matchedTupleMemberIndexes = Array.from(new Set([...priorMatches, memberIndex])).sort((a, b) => a - b);
        return;
      }

      if (memberId) expandedIndexByMemberId.set(memberId, expanded.length);
      expanded.push({
        rawItem: member,
        tupleItems,
        tupleSize,
        tupleRank,
        tupleMemberIndex: memberIndex,
        matchedTupleMemberIndexes: collapsedMatchIndexes,
        tupleGroupKey
      });
    });
  });

  return expanded;
}

function getSubmittedRecord(submittedLookup, imgId) {
  const key = String(imgId || '').trim();
  if (!key || !submittedLookup) return null;
  if (typeof submittedLookup.get === 'function') return submittedLookup.get(key) || null;
  if (typeof submittedLookup.has === 'function') return submittedLookup.has(key) ? { imgId: key } : null;
  return null;
}

function applySubmittedState(item, submittedLookup) {
  const submittedRecord = getSubmittedRecord(submittedLookup, item?.imgId);
  if (!submittedRecord) return item;
  return {
    ...item,
    submitted: true,
    submissionVerdict: submittedRecord.submissionVerdict ?? item?.submissionVerdict ?? ''
  };
}

// src/services/transformers.js
export function transformSearchResults(resultSet, submittedLookup = new Set()) {
  const arr = findResultsArray(resultSet) ?? [];
  const expanded = expandTupleAwareItems(arr);

  return expanded.map((entry, index) => {
    const info = extractImageInfo(entry.rawItem, index);
    const raw = info.raw && typeof info.raw === 'object' ? info.raw : {};
    const scoreSource = Number(raw.score ?? raw.similarity ?? raw.distance ?? raw.confidence);
    
    return applySubmittedState({
      ...info,
      index,
      submitted: false,
      matchScore: Number.isFinite(scoreSource) ? scoreSource : 0,
      tupleRank: entry.tupleRank,
      tupleMemberIndex: entry.tupleMemberIndex,
      matchedTupleMemberIndexes: entry.matchedTupleMemberIndexes,
      tupleGroupKey: entry.tupleGroupKey,
      
      // Timecodes are resolved per-frame via getMiddleTimestamp API
      // (do NOT copy raw timestamp/time/frame_time — they may not be video timecodes)
      raw,
      tupleItems: entry.tupleItems,
      tupleSize: entry.tupleSize
    }, submittedLookup);
  });
}

export function transformVideoKeyframes(rawFrames, videoId, submittedLookup = new Set()) {
  return rawFrames.map((item, index) => {
    const imgId = typeof item === 'string'
      ? item
      : (item?.imgId || item?.id || item?.content || item);

    const rawImgId = String(imgId || '');
    const itemVideoId = typeof item === 'object' && item
      ? String(item.videoId || videoId || '')
      : String(videoId || '');
    const vid = itemVideoId;

    const explicitThumb = typeof item === 'object' && item
      ? String(item.thumbnailUrl || item.imageUrl || item.url || '').trim()
      : '';
    const url = explicitThumb || null;

    const rawTs = typeof item === 'object' && item ? Number(item.timestamp) : NaN;
    const timestamp = Number.isFinite(rawTs) ? rawTs : null;

    return applySubmittedState({
      index,
      imgId: rawImgId,
      videoId: vid,
      url,
      title: rawImgId,
      submitted: false,
      timestamp,
      date: timestamp,
      // Timecodes are resolved per-frame via getMiddleTimestamp API in ResultsGrid.
      // Do NOT estimate timestamps here — wrong estimates block the accurate API call.
      raw: item
    }, submittedLookup);
  });
}
