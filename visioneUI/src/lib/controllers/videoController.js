// src/lib/controllers/videoController.js
import { warnFallback } from '../fallbackWarn.js';

export function createVideoController({
  api,                      // visioneAPI
  transformVideoKeyframes,
  transformSearchResults,
  tick,

  getSubmittedIds,          // () => Set<string>
  getResultK = () => 7200,

  // state sinks
  setVideoState             // ({ loading?, error?, frames?, videoId?, selectedImgId? }) => void
}) {
  let reqId = 0;
  const KEYFRAME_ELEMENT_URL_CONCURRENCY = 6;

  async function mapWithConcurrency(list, limit, worker) {
    const safeLimit = Math.max(1, Math.min(limit || 1, list.length || 1));
    const results = new Array(list.length);
    let cursor = 0;

    async function runWorker() {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(list[index], index);
      }
    }

    const workers = Array.from({ length: safeLimit }, () => runWorker());
    await Promise.all(workers);
    return results;
  }

  async function fetchVideoKeyframes(videoId) {
    if (!videoId) return [];
    const rawFrames = await api.getVideoKeyframes(videoId);

    const ids = rawFrames
      .map((entry) => String(entry?.imgId || entry?.id || entry?.content || entry || '').trim())
      .filter(Boolean);
    const urlRows = await api.getElementUrlsBatch(ids, ['images', 'thumbnails']);
    const urlById = new Map(
      (Array.isArray(urlRows) ? urlRows : [])
        .map((row) => [
          String(row?.id || '').trim(),
          {
            imageUrl: String(row?.images || '').trim() || null,
            thumbnailUrl: String(row?.thumbnails || '').trim() || null
          }
        ])
        .filter(([id]) => !!id)
    );

    const enrichedFrames = rawFrames.map((entry) => {
      const imgId = String(entry?.imgId || entry?.id || entry?.content || entry || '').trim();
      if (!imgId) return entry;

      const resolved = urlById.get(imgId) || {};
      const thumbnailUrl = String(resolved?.thumbnailUrl || '').trim() || null;
      const imageUrl = String(resolved?.imageUrl || '').trim() || null;
      return {
        ...(typeof entry === 'object' && entry ? entry : { imgId }),
        imgId,
        thumbnailUrl,
        imageUrl
      };
    });

    return transformVideoKeyframes(enrichedFrames, videoId, getSubmittedIds());
  }

  async function enrichFramesWithElementUrls(frames) {
    const source = Array.isArray(frames) ? frames : [];
    const ids = source
      .map((entry) => String(entry?.imgId || entry?.id || entry?.content || entry || '').trim())
      .filter(Boolean);
    if (ids.length === 0) return source;

    const urlRows = await api.getElementUrlsBatch(ids, ['images', 'thumbnails']);
    const urlById = new Map(
      (Array.isArray(urlRows) ? urlRows : [])
        .map((row) => [
          String(row?.id || '').trim(),
          {
            imageUrl: String(row?.images || '').trim() || null,
            thumbnailUrl: String(row?.thumbnails || '').trim() || null
          }
        ])
        .filter(([id]) => !!id)
    );

    return source.map((entry) => {
      const imgId = String(entry?.imgId || entry?.id || entry?.content || entry || '').trim();
      const resolved = urlById.get(imgId) || {};
      const imageUrl = String(resolved?.imageUrl || entry?.imageUrl || '').trim() || null;
      const thumbnailUrl = String(resolved?.thumbnailUrl || entry?.thumbnailUrl || entry?.url || '').trim() || null;
      return {
        ...(typeof entry === 'object' && entry ? entry : { imgId }),
        imgId,
        imageUrl,
        thumbnailUrl,
        url: thumbnailUrl || imageUrl || entry?.url || null
      };
    });
  }

  function toInt(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }

  async function resolveDayPartsFromFrame(imgId) {
    const safeImgId = String(imgId || '').trim();
    if (!safeImgId) return null;

    const metadata = await api.getField(safeImgId, ['year', 'month', 'day']);
    const year = toInt(metadata?.year);
    const month = toInt(metadata?.month);
    const day = toInt(metadata?.day);
    if (year == null || month == null || day == null) return null;
    return { year, month, day };
  }

  async function fetchDayKeyframes({ year, month, day }) {
    const resultSet = await api.searchFramesByDay({ year, month, day, k: getResultK() });
    const frames = transformSearchResults(resultSet, getSubmittedIds());
    return enrichFramesWithElementUrls(frames);
  }

  async function openVideoSummary(videoId, highlightImgId = null, scope = 'hour') {
    if (!videoId) return;

    const req = ++reqId;

    const requestedVideoId = String(videoId);
    const rawScope = String(scope || 'hour').trim().toLowerCase();
    if (rawScope && rawScope !== 'hour' && rawScope !== 'day') {
      warnFallback('videoController.openVideoSummary', `Unrecognized context scope "${scope}", using "hour".`, { scope });
    }
    const requestedScope = rawScope === 'day' ? 'day' : 'hour';
    // Preserve raw imgId (including extensions) to keep selection/anchor
    // aligned with transformed keyframe ids.
    const selectedImgId = highlightImgId ? String(highlightImgId) : null;

    setVideoState({
      loading: true,
      error: null,
      frames: null,
      videoId: requestedVideoId,
      selectedImgId,
      contextScope: requestedScope,
      contextDay: null
    });

    try {
      await tick();

      const dayParts = requestedScope === 'day'
        ? await resolveDayPartsFromFrame(selectedImgId)
        : null;
      if (requestedScope === 'day' && !dayParts) {
        throw new Error('Unable to resolve day metadata for this frame');
      }

      const frames = requestedScope === 'day'
        ? await fetchDayKeyframes(dayParts)
        : await fetchVideoKeyframes(requestedVideoId);
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: null,
        frames,
        videoId: requestedVideoId,
        selectedImgId,
        contextScope: requestedScope,
        contextDay: dayParts
      });
    } catch (err) {
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: err?.message ?? String(err),
        frames: null,
        videoId: requestedVideoId,
        selectedImgId: null,
        contextScope: requestedScope,
        contextDay: null
      });
    }
  }

  return { fetchVideoKeyframes, openVideoSummary };
}
