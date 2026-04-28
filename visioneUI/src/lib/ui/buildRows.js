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

  const sortByDateDesc = (arr) =>
    [...arr].sort((a, b) => {
      const dateA = a.timestamp || a.raw?.timestamp || 0;
      const dateB = b.timestamp || b.raw?.timestamp || 0;
      return dateB - dateA;
    });

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

  if (auto) {
    if (mode === "byrank") return [items];

    if (groupedRows) {
      // One visual container per group; cards wrap inside the same row.
      return groupedRows;
    }

    if (mode === "bydate") {
      return [sortByDateDesc(items)];
    }
  }

  if (mode === "byrank") return chunk(items, perRow);
  if (mode === "bydate") return chunk(sortByDateDesc(items), perRow);

  // Grouped modes (video or metadata): one row per group, independent from resultsPerRow.
  if (groupedRows) return groupedRows;

  return chunk(items, perRow);
}
