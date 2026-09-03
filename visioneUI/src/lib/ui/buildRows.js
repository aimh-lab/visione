// src/lib/ui/buildRows.js
import { resolveGroupByConfig, isVideoLikeGroupByMetadata } from '$lib/groupByConfig.js';
import { resolveEpochMs, toIntOrNull, buildHourGroupKey as resolveHourGroupKey } from '$lib/epochResolution.js';

export function buildRows(items, {
  viewMode,
  sortMode = 'relevance',
  resultsPerGroup,
  resultsPerRow,
  resultsAutoFit,
  runtimeProfile = {},
  showLocalTimeInTitles = true,
  timeBadgeTimezoneOverride = 'profile'
}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const NO_GROUP_VIRTUAL_ROW_SIZE = 48;

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const groupBy = resolveGroupByConfig(viewMode, runtimeProfile);
  const mode = String(groupBy?.mode || viewMode || 'byrank');
  const kind = String(groupBy?.kind || '').trim().toLowerCase();
  const metadataField = String(groupBy?.metadata || '').trim();
  const isHourMetadataGrouping = kind === 'metadata' && isVideoLikeGroupByMetadata(metadataField);
  const perRow = Math.max(1, Number(resultsPerGroup ?? resultsPerRow) || 5);
  const auto = !!resultsAutoFit;

  const getEpochSortMs = (item) => resolveEpochMs(item, runtimeProfile) ?? 0;

  const sortByDate = (arr, direction = 'asc') =>
    [...arr].sort((a, b) => {
      const dateA = getEpochSortMs(a);
      const dateB = getEpochSortMs(b);
      return direction === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const normalizedSortMode = String(sortMode || '').trim().toLowerCase();
  const isTimeSortMode = normalizedSortMode === 'time' || normalizedSortMode === 'time_asc' || normalizedSortMode === 'time_desc';
  const timeSortDirection = normalizedSortMode === 'time_desc' ? 'desc' : 'asc';
  const sortedItems = isTimeSortMode ? sortByDate(items, timeSortDirection) : items;

  if (mode === "byrank" || kind === "rank") {
    return chunk(sortedItems, NO_GROUP_VIRTUAL_ROW_SIZE).map((row) => {
      row.__visioneNoGroupChunk = true;
      return row;
    });
  }

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

  const buildHourGroupKey = (item) => resolveHourGroupKey(item, runtimeProfile);

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
        if (isVideoLikeGroupByMetadata(field)) {
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

  const getGroupSortMs = (row) => {
    const key = String(row?.__visioneGroupKey || '').trim();
    const dateMatch = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      return Date.UTC(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3])
      );
    }

    const hourMatch = key.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})/);
    if (hourMatch) {
      return Date.UTC(
        Number(hourMatch[1]),
        Number(hourMatch[2]) - 1,
        Number(hourMatch[3]),
        Number(hourMatch[4])
      );
    }

    const rowTimes = Array.isArray(row)
      ? row.map(getEpochSortMs).filter((value) => value > 0)
      : [];
    return rowTimes.length ? Math.min(...rowTimes) : Number.MAX_SAFE_INTEGER;
  };

  const sortGroupedRowsByTime = (rows) => {
    if (!isTimeSortMode || !Array.isArray(rows)) return rows;
    return rows
      .map((row, index) => ({ row, index, time: getGroupSortMs(row) }))
      .sort((a, b) => {
        const delta = timeSortDirection === 'desc' ? b.time - a.time : a.time - b.time;
        return delta || (a.index - b.index);
      })
      .map(({ row }) => row);
  };

  const groupedRows =
    kind === 'video'
      ? groupByVideo(items)
      : (kind === 'metadata' && metadataField
        ? groupByMetadata(items, metadataField)
        : null);

  const dateGroupedRows = mode === 'bydate' ? groupByDateDay(items) : null;
  const orderedGroupedRows = sortGroupedRowsByTime(groupedRows);
  const orderedDateGroupedRows = sortGroupedRowsByTime(dateGroupedRows);
  const cappedGroupedRows = orderedGroupedRows
    ? orderedGroupedRows.map((row) => {
        const capped = row.slice(0, perRow);
        capped.__visioneGroupKey = row.__visioneGroupKey;
        return capped;
      })
    : null;
  const dateCappedRows = orderedDateGroupedRows
    ? orderedDateGroupedRows.map((row) => {
        const capped = row.slice(0, perRow);
        capped.__visioneGroupKey = row.__visioneGroupKey;
        return capped;
      })
    : null;

  if (auto) {
    if (orderedGroupedRows) {
      if (isHourMetadataGrouping) return cappedGroupedRows || [];
      // One logical group can span multiple visual rows, capped by per-group size.
      return splitGroupedRows(orderedGroupedRows);
    }

    if (mode === "bydate" && orderedDateGroupedRows) {
      return dateCappedRows || [];
    }
  }

  if (mode === "bydate" && orderedDateGroupedRows) return dateCappedRows || [];

  // Grouped modes (video or metadata): respect per-group cap.
  if (isHourMetadataGrouping && cappedGroupedRows) return cappedGroupedRows;
  if (orderedGroupedRows) return splitGroupedRows(orderedGroupedRows);

  return chunk(items, perRow);
}
