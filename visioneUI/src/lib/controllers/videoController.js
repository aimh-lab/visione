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

  async function fetchVideoKeyframes(videoId) {
    if (!videoId) return [];
    const rawFrames = await api.getVideoKeyframes(videoId);
    return transformVideoKeyframes(rawFrames, videoId, getSubmittedIds());
  }

  async function openVideoSummary(videoId, highlightImgId = null) {
    if (!videoId) return;

    const req = ++reqId;

    const vid = String(videoId).split(/[-_]/)[0];
    const padded = String(vid).padStart(5, "0");
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
