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

  /**
   * Collect imgIds from search + similarity results that belong to `videoId`.
   */
  function getHighlightedKeyframesForVideo(videoId) {
    if (!videoId) return [];
    const vid = String(videoId).padStart(5, '0');

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
    const vid = String(videoId ?? String(imgId).split('-')[0]).padStart(5, '0');
    const highlighted = getHighlightedKeyframesForVideo(vid);

    if (typeof startAt === 'number') {
      return {
        url: visioneAPI.getVideoUrl(vid, 'medium'),
        startTime: Math.max(0, startAt),
        title: `${vid}`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }

    try {
      const middle = await visioneAPI.getMiddleTimestamp(imgId);
      return {
        url: visioneAPI.getVideoUrl(vid, 'medium'),
        startTime: Math.max(0, middle),
        title: `${vid} @ ${middle.toFixed(2)}s`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    } catch {
      return {
        url: visioneAPI.getVideoUrl(vid, 'medium'),
        startTime: 0,
        title: `${vid}`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }
  }

  return { buildPlayerData, getHighlightedKeyframesForVideo };
}
