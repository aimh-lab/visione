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

  const normalizeVideoId = (value) => {
    const raw = String(value || '').trim().replace(/\.mp4$/i, '');
    if (!raw) return '';
    return /^\d+$/.test(raw) ? raw.padStart(5, '0') : raw;
  };

  async function fetchVideoKeyframes(videoId) {
    if (!videoId) return [];
    const rawFrames = await api.getVideoKeyframes(videoId);

    const enrichedFrames = await mapWithConcurrency(
      rawFrames,
      KEYFRAME_ELEMENT_URL_CONCURRENCY,
      async (entry) => {
        const imgId = String(entry?.imgId || entry?.id || entry?.content || entry || '').trim();
        if (!imgId) return entry;

        try {
          const urls = await api.getElementUrls(imgId, ['images', 'thumbnails', 'resized-videos-tiny']);
          const thumbnailUrl = String(urls?.thumbnails || '').trim() || api.getThumbnailUrlByImgId(imgId, videoId) || null;
          const imageUrl = String(urls?.images || '').trim() || null;
          return {
            ...(typeof entry === 'object' && entry ? entry : { imgId }),
            imgId,
            thumbnailUrl,
            imageUrl
          };
        } catch {
          return {
            ...(typeof entry === 'object' && entry ? entry : { imgId }),
            imgId,
            thumbnailUrl: api.getThumbnailUrlByImgId(imgId, videoId) || null
          };
        }
      }
    );

    return transformVideoKeyframes(enrichedFrames, videoId, getSubmittedIds());
  }

  async function openVideoSummary(videoId, highlightImgId = null) {
    if (!videoId) return;

    const req = ++reqId;

    const padded = normalizeVideoId(videoId);
    const selectedImgId = highlightImgId ? String(highlightImgId).replace(/\.jpg$/i, "") : null;

    setVideoState({
      loading: true,
      error: null,
      frames: null,
      videoId: padded,
      selectedImgId
    });

    try {
      await tick();

      const frames = await fetchVideoKeyframes(padded);
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: null,
        frames,
        videoId: padded,
        selectedImgId
      });
    } catch (err) {
      if (req !== reqId) return;

      setVideoState({
        loading: false,
        error: err?.message ?? String(err),
        frames: null,
        videoId: padded,
        selectedImgId: null
      });
    }
  }

  return { fetchVideoKeyframes, openVideoSummary };
}
