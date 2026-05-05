import { findResultsArray, extractImageInfo } from "../utils/results";

function normalizeTupleArray(item) {
  if (!Array.isArray(item)) return null;
  const tuple = item.filter((entry) => entry != null && entry !== '');
  return tuple.length > 0 ? tuple : null;
}

function tupleGroupKeyFrom(tupleItems, fallbackIndex) {
  if (!Array.isArray(tupleItems) || tupleItems.length === 0) return `tuple-${fallbackIndex}`;
  const ids = tupleItems
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        return String(entry?.id || entry?.imgId || entry?.imageId || '').trim();
      }
      return String(entry || '').trim();
    })
    .filter(Boolean)
    .sort();
  return ids.length > 0 ? ids.join('|') : `tuple-${fallbackIndex}`;
}

function expandTupleAwareItems(arr) {
  const expanded = [];

  arr.forEach((rawItem, tupleRank) => {
    const tupleItems = normalizeTupleArray(rawItem);
    if (!tupleItems) {
      expanded.push({
        rawItem,
        tupleItems: null,
        tupleSize: 1,
        tupleRank,
        tupleMemberIndex: 0,
        tupleGroupKey: null
      });
      return;
    }

    const tupleGroupKey = tupleGroupKeyFrom(tupleItems, tupleRank);
    tupleItems.forEach((member, memberIndex) => {
      expanded.push({
        rawItem: member,
        tupleItems,
        tupleSize: tupleItems.length,
        tupleRank,
        tupleMemberIndex: memberIndex,
        tupleGroupKey
      });
    });
  });

  return expanded;
}

// src/services/transformers.js
export function transformSearchResults(resultSet, submittedIds = new Set()) {
  const arr = findResultsArray(resultSet) ?? [];
  const expanded = expandTupleAwareItems(arr);

  return expanded.map((entry, index) => {
    const info = extractImageInfo(entry.rawItem, index);
    const raw = info.raw && typeof info.raw === 'object' ? info.raw : {};
    const scoreSource = Number(raw.score ?? raw.similarity ?? raw.distance ?? raw.confidence);
    
    return {
      ...info,
      index,
      submitted: submittedIds.has(info.imgId),
      matchScore: Number.isFinite(scoreSource) ? scoreSource : 0,
      tupleRank: entry.tupleRank,
      tupleMemberIndex: entry.tupleMemberIndex,
      tupleGroupKey: entry.tupleGroupKey,
      
      // Timecodes are resolved per-frame via getMiddleTimestamp API
      // (do NOT copy raw timestamp/time/frame_time — they may not be video timecodes)
      raw,
      tupleItems: entry.tupleItems,
      tupleSize: entry.tupleSize
    };
  });
}

export function transformSimilarityResults(resultSet, submittedIds = new Set()) {
  const arr = findResultsArray(resultSet) || [];
  const expanded = expandTupleAwareItems(arr);

  return expanded.map((entry, index) => {
    const info = extractImageInfo(entry.rawItem, index);
    const raw = info.raw && typeof info.raw === 'object' ? info.raw : {};
    const scoreSource = Number(raw.score ?? raw.similarity ?? raw.distance);
    
    return {
      index,
      title: info.imgId ?? `Image ${index + 1}`,
      videoId: info.videoId,
      imgId: info.imgId,
      url: info.url,
      imageUrl: info.imageUrl,
      thumbnailUrl: info.thumbnailUrl,
      videoUrl: info.videoUrl,
      timestamp: info.timestamp,
      date: info.timestamp,
      size: info.size ?? null,
      resolution: info.resolution ?? null,
      tags: info.tags ?? [],
      submitted: submittedIds.has(info.imgId),
      tupleRank: entry.tupleRank,
      tupleMemberIndex: entry.tupleMemberIndex,
      tupleGroupKey: entry.tupleGroupKey,
      
      // Timecodes are resolved per-frame via getMiddleTimestamp API
      // (do NOT copy raw timestamp/time/frame_time — they may not be video timecodes)
      
      // Similarity score (se disponibile)
      similarityScore: Number.isFinite(scoreSource) ? scoreSource : 0,
      
      raw,
      tupleItems: entry.tupleItems,
      tupleSize: entry.tupleSize
    };
  });
}

export function transformVideoKeyframes(rawFrames, videoId, submittedIds = new Set()) {
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

    return {
      index,
      imgId: rawImgId,
      videoId: vid,
      url,
      title: rawImgId,
      submitted: submittedIds.has(rawImgId),
      timestamp,
      date: timestamp,
      // Timecodes are resolved per-frame via getMiddleTimestamp API in ResultsGrid.
      // Do NOT estimate timestamps here — wrong estimates block the accurate API call.
      raw: item
    };
  });
}
