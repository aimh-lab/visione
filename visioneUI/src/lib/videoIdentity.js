// src/lib/videoIdentity.js
//
// Single source of truth for deriving "which video does this keyframe belong
// to" when the backend hasn't already told us via an explicit videoId/video_id
// field. Previously this fallback chain was reimplemented independently in
// ~12 places: src/utils/results.ts, src/utils/ui.ts, src/components/ResultsGrid.svelte,
// src/components/ImageModal.svelte, src/lib/controllers/dresController.js,
// src/lib/controllers/videoPlayerController.js, src/routes/+page.svelte.
//
// Order of preference:
//   1. An explicit videoId already resolved elsewhere (e.g. read from backend
//      metadata) — always wins, never guessed.
//   2. LSC-style photo filename: YYYYMMDD_HH + 4-digit MMSS + "_" + 3-digit
//      sequence (e.g. "20190101_121948_000.jpg") -> hour bucket "20190101_12".
//   3. Generic "<prefix>-<n>-<m>" keyframe naming (e.g. shot/frame ids).
//   4. Generic "<videoId>_<sceneNumber>" naming, both purely numeric (e.g.
//      V3C/V3C12's "14575_3" -> "14575") — mirrors how the loader itself
//      derives the id (video_id + "_" + scene number), so this needs no
//      metadata round-trip to recover.
//   5. Last resort: everything before the first "-". This only produces a
//      correct videoId for dash-separated naming conventions — it is NOT a
//      safe assumption for every dataset's keyframe naming, which is exactly
//      why call sites that matter (DRES submission) should watch the
//      returned `source`.

const LSC_HOUR_BUCKET_PATTERN = /^(\d{8}_\d{2})\d{4}_\d{3}(?:\.[^./]+)?$/i;
const DASH_PAIR_PATTERN = /-(\d+)-(\d+)(?:\.[^./]+)?$/i;
const UNDERSCORE_ID_SCENE_PATTERN = /^(\d+)_\d+(?:\.[^./]+)?$/i;

/**
 * Parse a videoId out of a raw image/keyframe id string alone (no metadata
 * available). Returns { videoId, source } so callers can decide whether to
 * warn when only the last-resort strategy matched.
 * @param {string} rawImgId
 * @returns {{ videoId: string, source: 'none' | 'lscHourBucket' | 'dashPair' | 'underscorePair' | 'fallbackSplit' }}
 */
export function parseVideoIdFromImgId(rawImgId) {
  const raw = String(rawImgId || '').trim();
  if (!raw) return { videoId: '', source: 'none' };

  const lscMatch = raw.match(LSC_HOUR_BUCKET_PATTERN);
  if (lscMatch) return { videoId: lscMatch[1], source: 'lscHourBucket' };

  const dashPairMatch = raw.match(DASH_PAIR_PATTERN);
  if (dashPairMatch) return { videoId: dashPairMatch[1], source: 'dashPair' };

  const underscorePairMatch = raw.match(UNDERSCORE_ID_SCENE_PATTERN);
  if (underscorePairMatch) return { videoId: underscorePairMatch[1], source: 'underscorePair' };

  return { videoId: raw.split('-')[0] || '', source: 'fallbackSplit' };
}

/**
 * Resolve the videoId for an item: prefer an already-known videoId (e.g. from
 * backend metadata, via src/utils/results.ts#extractImageInfo), else parse it
 * from the imgId string.
 * @param {string | number | null | undefined} imgId
 * @param {string | number | null | undefined} [explicitVideoId]
 * @returns {{ videoId: string, source: 'explicit' | 'none' | 'lscHourBucket' | 'dashPair' | 'fallbackSplit' }}
 */
export function resolveVideoId(imgId, explicitVideoId = null) {
  const explicit = explicitVideoId != null ? String(explicitVideoId).trim() : '';
  if (explicit) return { videoId: explicit, source: 'explicit' };
  return parseVideoIdFromImgId(imgId);
}
