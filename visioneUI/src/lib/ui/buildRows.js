// src/lib/ui/buildRows.js
import { resolveGroupByConfig } from '$lib/groupByConfig.js';

export function buildRows(items, {
  viewMode,
  resultsPerGroup,
  resultsPerRow,
  resultsAutoFit,
  runtimeProfile = {},
  showLocalTimeInTitles = true,
  timeBadgeTimezoneOverride = 'profile'
}) {
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
  const isHourMetadataGrouping = kind === 'metadata' && metadataField.toLowerCase() === 'hour_id';
  const perRow = Math.max(1, Number(resultsPerGroup ?? resultsPerRow) || 5);
  const auto = !!resultsAutoFit;

  if (mode === "byrank") return chunk(items, perRow);

  const toFiniteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toIntOrNull = (value) => {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number.parseInt(String(value), 10);
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
    const metadata = item?.raw?.metadata && typeof item.raw.metadata === 'object' ? item.raw.metadata : {};
    const year = toIntOrNull(metadata?.year ?? item?.raw?.year ?? item?.year);
    const month = toIntOrNull(metadata?.month ?? item?.raw?.month ?? item?.month);
    const day = toIntOrNull(metadata?.day ?? item?.raw?.day ?? item?.day);

    if (
      Number.isFinite(year) && year >= 0
      && Number.isFinite(month) && month >= 1 && month <= 12
      && Number.isFinite(day) && day >= 1 && day <= 31
    ) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const epochMs = getEpochSortMs(item);
    if (!epochMs) {
      const uniqueFallback = String(item?.imgId ?? item?.index ?? Math.random()).trim() || 'na';
      return `unknown-date-${uniqueFallback}`;
    }

    const configuredTimezone = String(runtimeProfile?.timeBadge?.timezone || 'local').trim().toLowerCase();
    const overrideTimezone = String(timeBadgeTimezoneOverride || 'profile').trim().toLowerCase();
    const timezone = overrideTimezone === 'utc'
      ? 'utc'
      : overrideTimezone === 'local'
        ? 'local'
        : (showLocalTimeInTitles ? configuredTimezone : 'utc');
    const date = new Date(epochMs);

    const y = timezone === 'utc' ? date.getUTCFullYear() : date.getFullYear();
    const m = (timezone === 'utc' ? date.getUTCMonth() : date.getMonth()) + 1;
    const d = timezone === 'utc' ? date.getUTCDate() : date.getDate();

    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const buildHourGroupKey = (item) => {
    const epochMs = getEpochSortMs(item);
    if (epochMs) {
      const date = new Date(epochMs);
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      const h = date.getUTCHours();
      return `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}_${String(h).padStart(2, '0')}`;
    }

    const metadata = item?.raw?.metadata && typeof item.raw.metadata === 'object' ? item.raw.metadata : {};
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
      ?? ''
    ).trim();
    const match = rawHourId.match(/^(\d{8})_(\d{2})/);
    return match ? `${match[1]}_${match[2]}` : rawHourId;
  };

  const groupByDateDay = (arr) =>
    groupByKey(arr, (img) => buildDayGroupKey(img), 'date');

  const groupByKey = (arr, keyFn, fallbackPrefix = 'group') => {
    const groups = new Map();
    for (let index = 0; index < arr.length; index += 1) {
      const img = arr[index];
      const key = String(keyFn(img, index) ?? '').trim() || `${fallbackPrefix}-${img?.index ?? index}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(img);
    }

    return Array.from(groups.entries()).map(([key, row]) => {
      row.__visioneGroupKey = key;
      return row;
    });
  };

  const groupByVideo = (arr) =>
    groupByKey(arr, (img) => img.videoId, 'vid');

  const splitGroupedRows = (rows) =>
    rows.flatMap((row) => {
      const parts = chunk(row, perRow);
      if (parts.length <= 1) return parts;

      return parts.map((part) => {
        part.__visioneChunkBoundary = true;
        part.__visioneGroupKey = row.__visioneGroupKey;
        return part;
      });
    });

  const groupByMetadata = (arr, field) =>
    groupByKey(
      arr,
      (img) => {
        if (String(field || '').trim().toLowerCase() === 'hour_id') {
          return buildHourGroupKey(img) || 'N/A';
        }

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
  const cappedGroupedRows = groupedRows
    ? groupedRows.map((row) => {
        const capped = row.slice(0, perRow);
        capped.__visioneGroupKey = row.__visioneGroupKey;
        return capped;
      })
    : null;
  const dateCappedRows = dateGroupedRows
    ? dateGroupedRows.map((row) => {
        const capped = row.slice(0, perRow);
        capped.__visioneGroupKey = row.__visioneGroupKey;
        return capped;
      })
    : null;

  if (auto) {
    if (groupedRows) {
      if (isHourMetadataGrouping) return cappedGroupedRows || [];
      // One logical group can span multiple visual rows, capped by per-group size.
      return splitGroupedRows(groupedRows);
    }

    if (mode === "bydate" && dateGroupedRows) {
      return dateCappedRows || [];
    }
  }

  if (mode === "bydate" && dateGroupedRows) return dateCappedRows || [];

  // Grouped modes (video or metadata): respect per-group cap.
  if (isHourMetadataGrouping && cappedGroupedRows) return cappedGroupedRows;
  if (groupedRows) return splitGroupedRows(groupedRows);

  return chunk(items, perRow);
}
