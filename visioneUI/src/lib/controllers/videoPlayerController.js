// src/lib/controllers/videoPlayerController.js
//
// Builds the data needed to open the video-player modal
// (URL, startTime, highlighted keyframes).

import { visioneAPI } from '../../services/api.js';
import { parseVideoIdFromImgId } from '../videoIdentity.js';
import { resolveVideoTimeReferenceSeconds } from '../videoTimeReference.js';

/**
 * @param {Object} deps
 * @param {() => Array} deps.getImages           – current search results
 * @param {() => Object} [deps.getRuntimeProfile] – current dataset's runtime profile
 */
export function createVideoPlayerController({ getImages, getRuntimeProfile = () => ({}) }) {
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
   * Collect imgIds from search results that belong to `videoId`.
   */
  function getHighlightedKeyframesForVideo(videoId) {
    if (!videoId) return [];
    const vid = normalizeVideoId(videoId);

    const searchKf = getImages()
      .filter(img => img.videoId === vid)
      .map(img => img.imgId);

    return [...new Set(searchKf)];
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
    const matched = getImages().find((img) => img?.imgId === imgId) || null;
    const explicitVideoUrl = matched?.videoUrl || matched?.raw?.metadata?.videos || null;
    const urlSource = getRuntimeProfile()?.videoPlayer?.urlSource;
    const resolvedVideoUrl = explicitVideoUrl || await visioneAPI.getPlayableVideoUrl(vid, { urlSource, quality: 'medium' });
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

    // Prefer the dataset's own live-declared time reference (e.g. V3C/V3C12's
    // /discovery "item_time" -> "start_time_seconds") over the LSC-shaped
    // heuristics below — covers callers that don't pre-resolve startAt
    // themselves (e.g. opening the player from ImageModal or VideoSummaryModal).
    const declaredStart = resolveVideoTimeReferenceSeconds(matched, visioneAPI.videoTimeReferenceFields);
    if (declaredStart != null) {
      return {
        url: resolvedVideoUrl,
        startTime: Math.max(0, declaredStart),
        title: `${vid} @ ${declaredStart.toFixed(2)}s`,
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

    // visioneAPI.getMiddleTimestamp() (used a few lines below as the final
    // fallback) already tries the dataset's own declared time reference first,
    // then LSC-style fields only when the active dataset actually declares
    // them — no need to duplicate that logic (and its field-name assumptions)
    // here as a separate hardcoded step.

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
