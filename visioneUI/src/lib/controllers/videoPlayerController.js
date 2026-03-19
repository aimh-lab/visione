// src/lib/controllers/videoPlayerController.js
//
// Builds the data needed to open the video-player modal
// (URL, startTime, highlighted keyframes).

import { visioneAPI } from '../../services/api.js';

/**
 * @param {Object} deps
 * @param {() => Array} deps.getImages           – current search results
 * @param {() => Array} deps.getSimilarityImages  – current similarity results
 */
export function createVideoPlayerController({ getImages, getSimilarityImages }) {
  const normalizeVideoId = (value) => {
    const vid = String(value || '').trim();
    if (!vid) return '';
    return /^\d+$/.test(vid) ? vid.padStart(5, '0') : vid;
  };

  const extractVideoIdFromImageId = (imgId) => {
    const raw = String(imgId || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{8}_\d{2})\d{4}_\d{3}(?:\.jpg)?$/i);
    if (match) return match[1];
    return raw.split('-')[0] || '';
  };


  /**
   * Collect imgIds from search + similarity results that belong to `videoId`.
   */
  function getHighlightedKeyframesForVideo(videoId) {
    if (!videoId) return [];
    const vid = normalizeVideoId(videoId);

    const searchKf = getImages()
      .filter(img => img.videoId === vid)
      .map(img => img.imgId);

    const simKf = getSimilarityImages()
      .filter(img => img.videoId === vid)
      .map(img => img.imgId);

    return [...new Set([...searchKf, ...simKf])];
  }

  /**
   * Build the data object for VideoPlayerModal.
   * If `startAt` is a number it's used directly; otherwise the middle
   * timestamp is fetched from the API.
   *
   * @returns {Promise<{ url: string, startTime: number, title: string, videoId: string, highlightedKeyframes: string[] }>}
   */
  async function buildPlayerData(imgId, videoId, startAt) {
    const fallbackVid = videoId ?? extractVideoIdFromImageId(imgId);
    const vid = normalizeVideoId(fallbackVid);
    const matched = getImages().find((img) => img?.imgId === imgId)
      || getSimilarityImages().find((img) => img?.imgId === imgId)
      || null;
    const explicitVideoUrl = matched?.videoUrl || matched?.raw?.metadata?.videos || null;
    const resolvedVideoUrl = explicitVideoUrl || visioneAPI.getVideoUrl(vid, 'medium');
    const parsedTimestamp = Number(matched?.timestamp);
    const hasResultsetTimestamp = Number.isFinite(parsedTimestamp) && parsedTimestamp >= 0;
    const highlighted = getHighlightedKeyframesForVideo(vid);

    if (typeof startAt === 'number') {
      return {
        url: resolvedVideoUrl,
        startTime: Math.max(0, startAt),
        title: `${vid}`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }

    if (hasResultsetTimestamp) {
      return {
        url: resolvedVideoUrl,
        startTime: Math.max(0, parsedTimestamp),
        title: `${vid} @ ${parsedTimestamp.toFixed(2)}s`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }

    try {
      const middle = await visioneAPI.getMiddleTimestamp(imgId);
      return {
        url: resolvedVideoUrl,
        startTime: Math.max(0, middle),
        title: `${vid} @ ${middle.toFixed(2)}s`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    } catch {
      return {
        url: resolvedVideoUrl,
        startTime: 0,
        title: `${vid}`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }
  }

  return { buildPlayerData, getHighlightedKeyframesForVideo };
}
