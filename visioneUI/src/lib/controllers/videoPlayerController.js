// src/lib/controllers/videoPlayerController.js
//
// Builds the data needed to open the video-player modal
// (URL, startTime, highlighted keyframes).

import { visioneAPI } from '../../services/api.js';
import { parseVideoIdFromImgId } from '../videoIdentity.js';

/**
 * @param {Object} deps
 * @param {() => Array} deps.getImages           – current search results
 * @param {() => Array} deps.getSimilarityImages  – current similarity results
 */
export function createVideoPlayerController({ getImages, getSimilarityImages }) {
  const normalizeVideoId = (value) => {
    return String(value || '');
  };

  const extractVideoIdFromImageId = (imgId) => parseVideoIdFromImgId(imgId).videoId;

  const toFiniteNumber = (value) => {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const pickMiddleTimeSeconds = (matched) => {
    if (!matched || typeof matched !== 'object') return null;
    const metadata = matched?.raw?.metadata && typeof matched.raw.metadata === 'object'
      ? matched.raw.metadata
      : {};

    const middle = toFiniteNumber(
      matched?.hour_msb_middletime
      ?? matched?.raw?.hour_msb_middletime
      ?? metadata?.hour_msb_middletime
    );
    if (middle != null && middle >= 0) return middle;

    const offset = toFiniteNumber(
      matched?.middle_timestamp
      ?? matched?.middleTimestamp
      ?? matched?.middle_time
      ?? matched?.frame_time
      ?? matched?.frameTime
      ?? matched?.raw?.video_offset_seconds
      ?? metadata?.video_offset_seconds
    );
    return offset != null && offset >= 0 ? offset : null;
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

    const fromMatchedMiddle = pickMiddleTimeSeconds(matched);
    if (Number.isFinite(fromMatchedMiddle) && fromMatchedMiddle >= 0) {
      return {
        url: resolvedVideoUrl,
        startTime: Math.max(0, fromMatchedMiddle),
        title: `${vid} @ ${fromMatchedMiddle.toFixed(2)}s`,
        videoId: vid,
        highlightedKeyframes: highlighted
      };
    }

    if (imgId && visioneAPI.supportsVideos) {
      try {
        const metadata = await visioneAPI.getField(imgId, ['hour_msb_middletime', 'video_offset_seconds']);
        const middle = toFiniteNumber(metadata?.hour_msb_middletime);
        const offset = toFiniteNumber(metadata?.video_offset_seconds);
        const resolved = middle != null && middle >= 0 ? middle : (offset != null && offset >= 0 ? offset : null);
        if (resolved != null) {
          return {
            url: resolvedVideoUrl,
            startTime: Math.max(0, resolved),
            title: `${vid} @ ${resolved.toFixed(2)}s`,
            videoId: vid,
            highlightedKeyframes: highlighted
          };
        }
      } catch {
        // Ignore and continue with fallback chain.
      }
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
      if (!visioneAPI.supportsVideos) {
        return {
          url: resolvedVideoUrl,
          startTime: 0,
          title: `${vid}`,
          videoId: vid,
          highlightedKeyframes: highlighted
        };
      }
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
