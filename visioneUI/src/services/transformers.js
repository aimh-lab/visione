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
      imageUrl: info.imageUrl,
      thumbnailUrl: info.thumbnailUrl,
      videoUrl: info.videoUrl,
      timestamp: info.timestamp,
      date: info.timestamp,
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
    const imgId = typeof item === 'string'
      ? item
      : (item?.imgId || item?.id || item?.content || item);

    const rawImgId = String(imgId || '').trim();
    const normalizedImgId = rawImgId.replace(/\.jpg$/i, '');
    const itemVideoId = typeof item === 'object' && item
      ? String(item.videoId || videoId || '').trim().replace(/\.mp4$/i, '')
      : String(videoId || '').trim().replace(/\.mp4$/i, '');
    const vid = /^\d+$/.test(itemVideoId) ? itemVideoId.padStart(5, '0') : itemVideoId;

    const explicitThumb = typeof item === 'object' && item
      ? String(item.thumbnailUrl || item.imageUrl || item.url || '').trim()
      : '';
    const url = explicitThumb || tinyFrameUrl(vid, rawImgId);

    const rawTs = typeof item === 'object' && item ? Number(item.timestamp) : NaN;
    const timestamp = Number.isFinite(rawTs) ? rawTs : null;

    return {
      index,
      imgId: rawImgId,
      videoId: vid,
      url,
      title: rawImgId,
      submitted: submittedIds.has(rawImgId) || submittedIds.has(normalizedImgId),
      timestamp,
      date: timestamp,
      // Timecodes are resolved per-frame via getMiddleTimestamp API in ResultsGrid.
      // Do NOT estimate timestamps here — wrong estimates block the accurate API call.
      raw: item
    };
  });
}
