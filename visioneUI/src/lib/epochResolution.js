// src/lib/epochResolution.js
//
// Shared "resolve this item's epoch timestamp" logic, honoring a
// runtimeProfile that may alias the epoch field name and/or declare its unit
// (seconds/milliseconds/auto-detected by magnitude). Previously this exact
// field-lookup-and-unit-conversion logic was independently duplicated in
// src/routes/+page.svelte (getEpochSecondsFromItem) and
// src/lib/ui/buildRows.js (getEpochSortMs) — a real risk, since any future
// change to the field-resolution order or unit rules had to be kept in sync
// by hand across both files to avoid the slideshow title and the result-grid
// grouping/sort disagreeing about an item's time.

export function getRawMetadata(item) {
  if (!item || typeof item !== 'object') return {};
  const metadata = item?.raw?.metadata;
  return metadata && typeof metadata === 'object' ? metadata : {};
}

export function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toIntOrNull(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolves an item's epoch timestamp in milliseconds, or null when no usable
 * value is found.
 */
export function resolveEpochMs(item, runtimeProfile = {}) {
  if (!item || typeof item !== 'object') return null;

  const metadata = getRawMetadata(item);
  const epochField = String(runtimeProfile?.fieldAliases?.epoch || 'epoch').trim() || 'epoch';
  const epochUnit = String(runtimeProfile?.timeBadge?.epochUnit || 'auto').trim().toLowerCase();

  const rawEpoch =
    metadata?.[epochField]
    ?? item?.raw?.[epochField]
    ?? item?.[epochField]
    ?? metadata?.epoch
    ?? item?.raw?.epoch
    ?? item?.epoch
    ?? item?.timestamp
    ?? item?.raw?.timestamp;

  const parsed = toFiniteNumber(rawEpoch);
  if (parsed == null || parsed < 0) return null;

  if (epochUnit === 'seconds') return parsed * 1000;
  if (epochUnit === 'milliseconds') return parsed;
  return parsed > 1e11 ? parsed : parsed * 1000;
}

/** Same as resolveEpochMs, but in seconds. */
export function resolveEpochSeconds(item, runtimeProfile = {}) {
  const ms = resolveEpochMs(item, runtimeProfile);
  return ms == null ? null : ms / 1000;
}
