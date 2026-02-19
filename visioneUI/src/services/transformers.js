import { findResultsArray, extractImageInfo } from "../utils/results";

// src/services/transformers.js
export function transformSearchResults(resultSet, submittedIds = new Set()) {
  const arr = findResultsArray(resultSet) ?? [];
  if (arr.length > 0) {
  }
  return arr.map((item, index) => {
    const info = extractImageInfo(item, index);
    
    return {
      ...info,
      index,
      submitted: submittedIds.has(info.imgId),
      matchScore: item.score || item.similarity || item.distance || item.confidence || 0,
      
      // ✅ DATI TEMPORALI
      // L'API VISIONE potrebbe fornire questi campi:
      timestamp: item.timestamp || item.time || item.frame_time || 0,
      videoDuration: item.videoDuration || item.video_duration || item.duration || 0,
      
      // Se l'API non fornisce videoDuration, prova a derivarlo dal videoId
      // oppure usa un valore di fallback
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
      
      // ✅ DATI TEMPORALI
      timestamp: item.timestamp || item.time || item.frame_time || 0,
      videoDuration: item.videoDuration || item.video_duration || item.duration || 0,
      
      // ✅ SIMILARITY SCORE (se disponibile)
      similarityScore: item.score || item.similarity || item.distance || 0,
      
      raw: item
    };
  });
}

export function transformVideoKeyframes(rawFrames, videoId, submittedIds = new Set()) {
  // ✅ Calcola durata video dal massimo timestamp (se disponibile)
  let videoDuration = 0;
  
  // Se rawFrames contiene oggetti con timestamp
  if (rawFrames.length > 0 && typeof rawFrames[0] === 'object') {
    const timestamps = rawFrames
      .map(f => f.timestamp || f.time || 0)
      .filter(t => t > 0);
    
    if (timestamps.length > 0) {
      videoDuration = Math.max(...timestamps);
    }
  }
  
  // Fallback: stima dalla lunghezza (es. 1 frame ogni 2 secondi)
  if (videoDuration === 0) {
    videoDuration = rawFrames.length * 2;
  }
  
  return rawFrames.map((item, index) => {
    // Se item è una stringa (solo imgId)
    const imgId = typeof item === 'string' ? item : (item.imgId || item.id || item);
    const vid = String(imgId).split("-")[0].padStart(5, "0");
    const normalizedImgId = String(imgId).replace(/\.jpg$/i, "");
    const url = `https://visione.isti.cnr.it/frames/tiny/${vid}/${normalizedImgId}.jpg`;
    
    // ✅ Timestamp dal frame o stima progressiva
    let timestamp = 0;
    if (typeof item === 'object' && (item.timestamp || item.time)) {
      timestamp = item.timestamp || item.time;
    } else {
      // Stima: distribuisci uniformemente i frame nel video
      timestamp = (index / rawFrames.length) * videoDuration;
    }
    
    return {
      index,
      imgId: normalizedImgId,
      videoId: vid,
      url,
      title: normalizedImgId,
      submitted: submittedIds.has(normalizedImgId),
      
      // ✅ DATI TEMPORALI
      timestamp,
      videoDuration,
      
      raw: item
    };
  });
}
