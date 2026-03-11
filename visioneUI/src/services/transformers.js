import { findResultsArray, extractImageInfo } from "../utils/results";
import { tinyFrameUrl } from '$lib/urlConfig.js';

// src/services/transformers.js
export function transformSearchResults(resultSet, submittedIds = new Set()) {
  const arr = findResultsArray(resultSet) ?? [];
  return arr.map((item, index) => {
    const info = extractImageInfo(item, index);
    
    return {
      ...info,
      index,
      submitted: submittedIds.has(info.imgId),
      matchScore: item.score || item.similarity || item.distance || item.confidence || 0,
      
      // Timecodes are resolved per-frame via getMiddleTimestamp API
      // (do NOT copy raw timestamp/time/frame_time — they may not be video timecodes)
      raw: item
    };
  });
}

export function transformSimilarityResults(resultSet, submittedIds = new Set()) {
  const arr = findResultsArray(resultSet) || [];
  return arr.map((item, index) => {
    const info = extractImageInfo(item, index);
    
    return {
      index,
      title: info.imgId ?? `Image ${index + 1}`,
      videoId: info.videoId,
      imgId: info.imgId,
      url: info.url,
      date: item.date ?? item.timestamp ?? null,
      size: item.size ?? null,
      resolution: item.resolution ?? null,
      tags: item.tags ?? item.labels ?? [],
      submitted: submittedIds.has(info.imgId),
      
      // Timecodes are resolved per-frame via getMiddleTimestamp API
      // (do NOT copy raw timestamp/time/frame_time — they may not be video timecodes)
      
      // ✅ SIMILARITY SCORE (se disponibile)
      similarityScore: item.score || item.similarity || item.distance || 0,
      
      raw: item
    };
  });
}

export function transformVideoKeyframes(rawFrames, videoId, submittedIds = new Set()) {
  return rawFrames.map((item, index) => {
    // Se item è una stringa (solo imgId)
    const imgId = typeof item === 'string' ? item : (item.imgId || item.id || item);
    const vid = String(imgId).split("-")[0].padStart(5, "0");
    const normalizedImgId = String(imgId).replace(/\.jpg$/i, "");
    const url = tinyFrameUrl(vid, normalizedImgId);

    return {
      index,
      imgId: normalizedImgId,
      videoId: vid,
      url,
      title: normalizedImgId,
      submitted: submittedIds.has(normalizedImgId),
      // Timecodes are resolved per-frame via getMiddleTimestamp API in ResultsGrid.
      // Do NOT estimate timestamps here — wrong estimates block the accurate API call.
      raw: item
    };
  });
}
