// src/lib/controllers/videoController.js
export function createVideoController({
  api,                      // visioneAPI
  transformVideoKeyframes,
  tick,

  getSubmittedIds,          // () => Set<string>

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
    let urlById = new Map();

    try {
      const urlRows = await api.getElementUrlsBatch(ids, ['images', 'thumbnails']);
      urlById = new Map(
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
    } catch {
      // Keep fallback URLs below when batch lookup fails.
    }

    const enrichedFrames = rawFrames.map((entry) => {
      const imgId = String(entry?.imgId || entry?.id || entry?.content || entry || '').trim();
      if (!imgId) return entry;

      const resolved = urlById.get(imgId) || {};
      const thumbnailUrl = String(resolved?.thumbnailUrl || '').trim() || api.getThumbnailUrlByImgId(imgId, videoId) || null;
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

  async function openVideoSummary(videoId, highlightImgId = null) {
    if (!videoId) return;

    const req = ++reqId;

    const requestedVideoId = String(videoId);
    // Preserve raw imgId (including extensions) to keep selection/anchor
    // aligned with transformed keyframe ids.
    const selectedImgId = highlightImgId ? String(highlightImgId) : null;

    setVideoState({
      loading: true,
      error: null,
      frames: null,
      videoId: requestedVideoId,
      selectedImgId
    });

    try {
      await tick();

      const frames = await fetchVideoKeyframes(requestedVideoId);
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: null,
        frames,
        videoId: requestedVideoId,
        selectedImgId
      });
    } catch (err) {
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: err?.message ?? String(err),
        frames: null,
        videoId: requestedVideoId,
        selectedImgId: null
      });
    }
  }

  return { fetchVideoKeyframes, openVideoSummary };
}
