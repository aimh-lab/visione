// src/lib/videoTimeReference.js
//
// Resolves the exact second to seek a video to, from a dataset's own
// self-described field mapping — the /discovery payload's
// `video_time_reference_attributes` (e.g. for V3C/V3C12:
// { item_time: "start_time_seconds", item_start_time: "start_time_seconds",
//   item_end_time: "end_time_seconds" }) — rather than a hardcoded field name
// or a per-dataset heuristic. A dataset that doesn't declare this map at all
// (e.g. LSC, which has no video concept) resolves to null here, so callers
// fall through untouched to whatever fallback they already had.
//
// The map itself is captured live from /discovery by discoveryConfig.js
// (computeSearchMetadataConfig) and applied to visioneAPI.videoTimeReferenceFields
// by +page.svelte, the same way videoGroupField/itemIdField already are.

import { getRawMetadata, toFiniteNumber } from './epochResolution.js';

/**
 * @param {Object} item
 * @param {Object} videoTimeReferenceFields - map of semantic key ("item_time",
 *   "item_start_time", "item_end_time") to the actual metadata field name that
 *   carries it for the active dataset. Empty/missing means the dataset doesn't
 *   declare this mapping.
 * @param {string} [key] - which semantic time to resolve; defaults to
 *   "item_time" (the single best point to start playback at).
 * @returns {number|null} seconds, or null if not resolvable.
 */
export function resolveVideoTimeReferenceSeconds(item, videoTimeReferenceFields = {}, key = 'item_time') {
  const fieldName = String(videoTimeReferenceFields?.[key] || '').trim();
  if (!fieldName || !item || typeof item !== 'object') return null;

  const metadata = getRawMetadata(item);
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
  const value = metadata?.[fieldName] ?? raw?.[fieldName] ?? item?.[fieldName];

  const seconds = toFiniteNumber(value);
  return seconds != null && seconds >= 0 ? seconds : null;
}
