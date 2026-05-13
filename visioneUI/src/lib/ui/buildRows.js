// src/lib/ui/buildRows.js
import { resolveGroupByConfig } from '$lib/groupByConfig.js';

export function buildRows(items, { viewMode, resultsPerRow, resultsAutoFit, runtimeProfile = {} }) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const groupBy = resolveGroupByConfig(viewMode, runtimeProfile);
  const mode = String(groupBy?.mode || viewMode || 'byrank');
  const kind = String(groupBy?.kind || '').trim().toLowerCase();
  const metadataField = String(groupBy?.metadata || '').trim();
  const perRow = Math.max(1, Number(resultsPerRow) || 5);
  const auto = !!resultsAutoFit;

  const toFiniteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getEpochSortMs = (item) => {
    if (!item || typeof item !== 'object') return 0;

    const metadata = item?.raw?.metadata;
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
      ?? item?.raw?.timestamp
      ?? 0;

    const parsed = toFiniteNumber(rawEpoch);
    if (parsed == null || parsed < 0) return 0;

    if (epochUnit === 'seconds') return parsed * 1000;
    if (epochUnit === 'milliseconds') return parsed;
    return parsed > 1e11 ? parsed : parsed * 1000;
  };

  const sortByDateDesc = (arr) =>
    [...arr].sort((a, b) => {
      const dateA = getEpochSortMs(a);
      const dateB = getEpochSortMs(b);
      return dateB - dateA;
    });

  const buildDayGroupKey = (item) => {
    const epochMs = getEpochSortMs(item);
    if (!epochMs) return 'unknown-date';

    const timezone = String(runtimeProfile?.timeBadge?.timezone || 'local').trim().toLowerCase();
    const date = new Date(epochMs);

    const y = timezone === 'utc' ? date.getUTCFullYear() : date.getFullYear();
    const m = (timezone === 'utc' ? date.getUTCMonth() : date.getMonth()) + 1;
    const d = timezone === 'utc' ? date.getUTCDate() : date.getDate();

    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const groupByDateDay = (arr) =>
    groupByKey(arr, (img) => buildDayGroupKey(img), 'date');

  const groupByKey = (arr, keyFn, fallbackPrefix = 'group') => {
    const groups = new Map();
    for (const img of arr) {
      const key = String(keyFn(img) ?? '').trim() || `${fallbackPrefix}-${img?.index}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(img);
    }
    return Array.from(groups.values());
  };

  const groupByVideo = (arr) =>
    groupByKey(arr, (img) => img.videoId, 'vid');

  const groupByMetadata = (arr, field) =>
    groupByKey(
      arr,
      (img) => {
        const metadata = img?.raw?.metadata;
        const rawValue = metadata && typeof metadata === 'object'
          ? metadata[field]
          : (img?.raw?.[field] ?? img?.[field]);
        return String(rawValue ?? '').trim() || 'N/A';
      },
      'meta'
    );

  const groupedRows =
    kind === 'video'
      ? groupByVideo(items)
      : (kind === 'metadata' && metadataField
        ? groupByMetadata(items, metadataField)
        : null);

  const dateGroupedRows = mode === 'bydate' ? groupByDateDay(items) : null;

  if (auto) {
    if (mode === "byrank") return [items];

    if (groupedRows) {
      // One visual container per group; cards wrap inside the same row.
      return groupedRows;
    }

    if (mode === "bydate" && dateGroupedRows) {
      return dateGroupedRows;
    }
  }

  if (mode === "byrank") return chunk(items, perRow);
  if (mode === "bydate" && dateGroupedRows) return dateGroupedRows;

  // Grouped modes (video or metadata): one row per group, independent from resultsPerRow.
  if (groupedRows) return groupedRows;

  return chunk(items, perRow);
}
