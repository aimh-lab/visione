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

/**
 * Builds the "YYYYMMDD_HH" hour-bucket group key for an item, preferring its
 * resolved epoch and falling back to explicit year/month/day/hour metadata
 * fields, then to a raw hour_id (or fallbackVideoId) string. Previously
 * duplicated identically across src/routes/+page.svelte, buildRows.js and
 * ResultsGrid.svelte.
 */
export function buildHourGroupKey(item, runtimeProfile = {}, fallbackVideoId = '') {
  const epochSeconds = resolveEpochSeconds(item, runtimeProfile);
  if (epochSeconds != null) {
    const date = new Date(epochSeconds * 1000);
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    return `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}_${String(h).padStart(2, '0')}`;
  }

  const metadata = getRawMetadata(item);
  const year = toIntOrNull(metadata?.year ?? item?.raw?.year ?? item?.year);
  const month = toIntOrNull(metadata?.month ?? item?.raw?.month ?? item?.month);
  const day = toIntOrNull(metadata?.day ?? item?.raw?.day ?? item?.day);
  const hour = toIntOrNull(metadata?.hour ?? item?.raw?.hour ?? item?.hour);

  if (
    Number.isFinite(year) && year >= 0
    && Number.isFinite(month) && month >= 1 && month <= 12
    && Number.isFinite(day) && day >= 1 && day <= 31
    && Number.isFinite(hour) && hour >= 0 && hour <= 23
  ) {
    return `${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}_${String(hour).padStart(2, '0')}`;
  }

  const rawHourId = String(
    metadata?.hour_id
    ?? item?.raw?.hour_id
    ?? item?.hour_id
    ?? fallbackVideoId
    ?? ''
  ).trim();
  const match = rawHourId.match(/^(\d{8})_(\d{2})/);
  return match ? `${match[1]}_${match[2]}` : rawHourId;
}
