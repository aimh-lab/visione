<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import SubmitBadge from "./SubmitBadge.svelte";
  import { visioneAPI } from "../services/api.js";
  import { uiStore } from "../stores/uiStore.js";
  import VideoOverlay from "./VideoOverlay.svelte";
  import { resolveGroupByConfig } from "$lib/groupByConfig.js";
  import { formatGroupDateLabel, formatGroupHourLabel, formatImageDisplayTitle, formatVideoGroupLabel } from "$lib/titleFormatting.js";

  export let items = [];
  export let selectedId = null;
  export let selectedIndex = null;
  export let showVideoSummary = false;
  export let registerContainer = (el) => {};
  export let viewMode = "byrank";
  export let videoBadgeOrientation = "vertical";
  export let isSelectionMode = false;
  export let virtualizeRows = true;
  export let virtualizeThreshold = 40;
  export let justifyResultRows = false;
  export let tupleIndicatorMode = "badge+bar";
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let rfPositive = [];
  export let rfNegative = [];
  export let runtimeProfile = {};
  export let showLocalTimeInTitles = true;
  export let resultsetBadgeLabelMode = "both";

  $: timeBadgeTimezoneOverride = String($uiStore?.timeBadgeTimezoneOverride || 'profile').trim().toLowerCase();

  function getVideoBadgeModeOverride() {
    if (resultsetBadgeLabelMode === 'id') return 'raw';
    if (resultsetBadgeLabelMode === 'date') return 'formatted';
    return 'both';
  }

  function shouldFormatTemporalGroupBadge() {
    const kind = String(activeGroupBy?.kind || '').trim().toLowerCase();
    const metadata = String(activeGroupBy?.metadata || '').trim().toLowerCase();
    return kind === 'video' || (kind === 'metadata' && metadata === 'hour_id');
  }


  $: activeGroupBy = resolveGroupByConfig(viewMode, runtimeProfile);
  $: hasCollectionVideos = runtimeProfile?.media?.hasVideos !== false;

  const safeImgId = (value) => String(value || '').trim();
  $: rfPositiveIds = new Set((Array.isArray(rfPositive) ? rfPositive : []).map((item) => safeImgId(item?.imgId)));
  $: rfNegativeIds = new Set((Array.isArray(rfNegative) ? rfNegative : []).map((item) => safeImgId(item?.imgId)));

  let preview = { imgId: null, videoUrl: null, start: 0, end: 0 };

  const getVideoId = (item) => {
    const vid = item.videoId ?? String(getId(item)).split("-")[0];
    return String(vid);
  };

  const getId = (item) => item.imgId;
  const getIndex = (item) => item.index ?? item.idx ?? -1;
  const getUrl = (item) => item.url;
  const getTitle = (item) => formatImageDisplayTitle(item, runtimeProfile, showLocalTimeInTitles);
  const toValidIndex = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const isSelected = (item) => {
    const idx = toValidIndex(getIndex(item));
    const selectedIdx = toValidIndex(selectedIndex);

    if (selectedIdx != null) {
      return idx != null && idx === selectedIdx;
    }

    return selectedId != null && selectedId === getId(item);
  };

  function getCardRenderKey(item, rowIndex, colIndex) {
    const idx = Number(getIndex(item));
    const id = String(getId(item) ?? 'no-id');
    const tupleRank = Number(item?.tupleRank);
    const tupleMemberIndex = Number(item?.tupleMemberIndex);

    if (Number.isFinite(idx) && idx >= 0) {
      return `idx:${idx}|id:${id}|tr:${Number.isFinite(tupleRank) ? tupleRank : -1}|tm:${Number.isFinite(tupleMemberIndex) ? tupleMemberIndex : -1}`;
    }

    return `row:${rowIndex}|col:${colIndex}|id:${id}|tr:${Number.isFinite(tupleRank) ? tupleRank : -1}|tm:${Number.isFinite(tupleMemberIndex) ? tupleMemberIndex : -1}`;
  }

  const TUPLE_GROUP_COLORS = [
    '#0ea5e9',
    '#14b8a6',
    '#22c55e',
    '#eab308',
    '#f97316',
    '#ef4444',
    '#a855f7'
  ];

  function getTupleSignature(item) {
    const tuple = Array.isArray(item?.tupleItems) ? item.tupleItems : [];
    const ids = tuple
      .map((entry) => String(entry?.id || entry?.imgId || '').trim())
      .filter(Boolean)
      .sort();
    return ids.join('|');
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function getTupleGroupColor(item) {
    const tupleSize = Number(item?.tupleSize || 1);
    if (tupleSize <= 1) return '';

    const explicitKey = String(item?.tupleGroupKey || '').trim();
    const signature = explicitKey || getTupleSignature(item);
    const idx = signature
      ? hashString(signature) % TUPLE_GROUP_COLORS.length
      : Math.max(0, Number(getIndex(item)) || 0) % TUPLE_GROUP_COLORS.length;
    return TUPLE_GROUP_COLORS[idx];
  }

  function hexToRgba(hexColor, alpha) {
    const hex = String(hexColor || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(148,163,184,${alpha})`;
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getTupleAccentStyle(item) {
    const color = getTupleGroupColor(item);
    if (!color) return '';
    return `background-color: ${hexToRgba(color, 0.78)};`;
  }

  function getTupleBadgeStyle(item) {
    const color = getTupleGroupColor(item);
    if (!color) return '';
    return [
      `background-color: ${hexToRgba(color, 0.16)};`,
      `border-color: ${hexToRgba(color, 0.45)};`,
      `color: ${hexToRgba(color, 0.96)};`
    ].join(' ');
  }

  function getTupleA11yLabel(item) {
    const tupleSize = Number(item?.tupleSize || 1);
    if (tupleSize <= 1) return '';
    const member = Number.isFinite(Number(item?.tupleMemberIndex)) ? Number(item.tupleMemberIndex) + 1 : '?';
    return `${member}/${tupleSize}`;
  }

  function getRankBadgeLabel(item, rowIndex, colIndex) {
    const idx = Number(getIndex(item));
    if (Number.isFinite(idx) && idx >= 0) return `# ${idx + 1}`;

    const fallbackRank = Number(rowIndex) * 1000 + Number(colIndex) + 1;
    return `# ${fallbackRank}`;
  }

  function showTupleBar() {
    return tupleIndicatorMode === 'badge+bar';
  }

  function showTupleBadge() {
    return tupleIndicatorMode === 'badge+bar' || tupleIndicatorMode === 'badge';
  }

  let fetchedTimecodes = new Map();
  let requestedTimecodeIds = new Set();
  const TIMECODE_FETCH_CONCURRENCY = 8;
  const timecodeQueue = [];
  let activeTimecodeFetches = 0;
  const pendingTimecodes = new Map();
  let timecodeFlushRaf = 0;

  function toFiniteNumber(value) {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseClockString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.includes(':')) return null;

    const parts = trimmed.split(':').map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  function toSecondsValue(value) {
    const clock = parseClockString(value);
    if (clock != null) return clock;
    return toFiniteNumber(value);
  }

  function pickBestTimeValue(candidates) {
    const numeric = candidates
      .map(toSecondsValue)
      .filter((v) => v != null);

    const positive = numeric.find((v) => v > 0);
    if (positive != null) return positive;

    return numeric.find((v) => v === 0) ?? null;
  }

  function getFrameSeconds(item) {
    if (!item) return null;

    const duration = pickBestTimeValue([
      item.videoDuration,
      item.video_duration,
      item.duration,
      item.raw?.videoDuration,
      item.raw?.video_duration,
      item.raw?.duration
    ]);

    let seconds = pickBestTimeValue([
      item.middle_timestamp,
      item.middleTimestamp,
      item.middle_time,
      item.frame_time,
      item.frameTime,
      item.time,
      item.timestamp,
      item.raw?.middle_timestamp,
      item.raw?.middleTimestamp,
      item.raw?.middle_time,
      item.raw?.frame_time,
      item.raw?.frameTime
      // NOTE: item.raw?.time and item.raw?.timestamp intentionally excluded —
      // these generic fields may represent dates, scores, or other non-timecode values
    ]);

    if (seconds == null || seconds < 0) return null;

    if (duration && duration > 0) {
      if (seconds > duration * 5 && seconds / 1000 <= duration * 5) {
        seconds = seconds / 1000;
      }
      if (seconds > duration * 5) return null;
    } else {
      if (seconds > 12 * 3600 && seconds / 1000 <= 12 * 3600) {
        seconds = seconds / 1000;
      }
      if (seconds > 12 * 3600) return null;
    }

    return Math.floor(seconds);
  }

  function getMiddleTimeSeconds(item) {
    if (!item || typeof item !== 'object') return null;

    const value = toSecondsValue(
      item?.hour_msb_middletime
      ?? item?.raw?.hour_msb_middletime
      ?? item?.raw?.metadata?.hour_msb_middletime
    );

    if (value == null || value < 0) return null;
    return value;
  }

  function getRawMetadata(item) {
    if (!item || typeof item !== 'object') return {};
    const metadata = item?.raw?.metadata;
    return metadata && typeof metadata === 'object' ? metadata : {};
  }

  function getGroupValueForItem(item) {
    if (!item || typeof item !== 'object') return '';

    if (activeGroupBy?.kind === 'video') {
      return String(getVideoId(item));
    }

    if (activeGroupBy?.kind === 'metadata') {
      const metadataField = String(activeGroupBy?.metadata || '').trim();
      if (!metadataField) return String(getVideoId(item));

      if (metadataField.toLowerCase() === 'hour_id') {
        return buildHourGroupKey(item) || 'N/A';
      }

      const metadata = getRawMetadata(item);
      const rawValue = metadata?.[metadataField] ?? item?.raw?.[metadataField] ?? item?.[metadataField];
      const normalized = String(rawValue ?? '').trim();
      return normalized || 'N/A';
    }

    return String(getVideoId(item));
  }

  function getGroupDisplayLabel(rowInfo) {
    const prefix = String(rowInfo?.groupLabel || 'Group').trim();
    const value = String(rowInfo?.label || '').trim();
    return value ? `${prefix} ${value}` : prefix;
  }

  function getNoGroupDateBadgeLabel(item) {
    if (String(activeGroupBy?.kind || '').trim().toLowerCase() !== 'rank') return '';
    if (!item || typeof item !== 'object') return '';

    const metadata = getRawMetadata(item);
    const year = toIntOrNull(metadata?.year ?? item?.raw?.year ?? item?.year);
    const month = toIntOrNull(metadata?.month ?? item?.raw?.month ?? item?.month);
    const day = toIntOrNull(metadata?.day ?? item?.raw?.day ?? item?.day);
    const dayKey = (
      Number.isFinite(year) && year >= 0
      && Number.isFinite(month) && month >= 1 && month <= 12
      && Number.isFinite(day) && day >= 1 && day <= 31
    )
      ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : '';

    return formatGroupDateLabel(dayKey, item, runtimeProfile, showLocalTimeInTitles);
  }

  function useSlideshowFromProfile() {
    const hasCollectionVideos = runtimeProfile?.media?.hasVideos !== false;
    if (!hasCollectionVideos) return true;
    const mode = String(runtimeProfile?.videoPlayer?.modal || 'video').trim().toLowerCase();
    return mode === 'slideshow';
  }

  function getVideoPlayerStartFromProfile(item) {
    if (!item || typeof item !== 'object') return null;

    const metadata = getRawMetadata(item);
    const source = String(runtimeProfile?.videoPlayer?.startSource || 'hour_msb_middletime').trim();

    if (source === 'epoch') {
      const epoch = toFiniteNumber(
        metadata?.epoch
        ?? item?.raw?.epoch
        ?? item?.epoch
        ?? item?.timestamp
      );
      if (epoch == null || epoch < 0) return null;
      return epoch > 1e11 ? epoch / 1000 : epoch;
    }

    if (source === 'hour_msb_middletime') {
      return getMiddleTimeSeconds(item);
    }

    // Default/fallback: classic frame-time based flow
    const frame = getFrameSeconds(item);
    return frame != null && frame >= 0 ? frame : null;
  }

  async function resolveTimecodeByItem(item) {
    const imgId = getId(item);
    if (!imgId) return;

    const parsed = getFrameSeconds(item);
    if (parsed != null && parsed >= 0) {
      pendingTimecodes.set(imgId, Math.floor(parsed));
      scheduleTimecodeFlush();
      return;
    }

    // Inline value is missing/unusable: resolve from API video_offset_seconds.
    try {
      const seconds = await visioneAPI.getMiddleTimestamp(imgId);
      if (Number.isFinite(seconds) && seconds >= 0) {
        pendingTimecodes.set(imgId, Math.floor(seconds));
        scheduleTimecodeFlush();
      }
    } catch {
      // Ignore single-item failures to keep the UI responsive.
    }
  }

  function scheduleTimecodeFlush() {
    if (timecodeFlushRaf) return;
    timecodeFlushRaf = requestAnimationFrame(() => {
      timecodeFlushRaf = 0;
      if (pendingTimecodes.size === 0) return;

      const next = new Map(fetchedTimecodes);
      for (const [imgId, ts] of pendingTimecodes.entries()) {
        next.set(imgId, ts);
      }
      pendingTimecodes.clear();
      fetchedTimecodes = next;
    });
  }

  function pumpTimecodeQueue() {
    while (activeTimecodeFetches < TIMECODE_FETCH_CONCURRENCY && timecodeQueue.length > 0) {
      const item = timecodeQueue.shift();
      if (!item) continue;

      activeTimecodeFetches += 1;
      resolveTimecodeByItem(item)
        .catch(() => {
          // Ignore single-item failures; UI remains responsive
        })
        .finally(() => {
          activeTimecodeFetches = Math.max(0, activeTimecodeFetches - 1);
          pumpTimecodeQueue();
        });
    }
  }

  function enqueueTimecodeFetch(item) {
    const imgId = getId(item);
    if (!imgId) return;
    if (fetchedTimecodes.has(imgId)) return;
    if (requestedTimecodeIds.has(imgId)) return;
    const badgeSource = String(runtimeProfile?.timeBadge?.source || 'epoch').trim().toLowerCase();
    if (badgeSource === 'epoch') return;
    const inlineSeconds = getFrameSeconds(item);
    if (inlineSeconds != null && inlineSeconds >= 0) return;

    requestedTimecodeIds.add(imgId);
    timecodeQueue.push(item);
  }

  function formatTimecode(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getEpochSeconds(item) {
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
      ?? item?.epoch;

    const parsed = toFiniteNumber(rawEpoch);
    if (parsed == null || parsed < 0) return null;

    if (epochUnit === 'seconds') return parsed;
    if (epochUnit === 'milliseconds') return parsed / 1000;
    // auto
    return parsed > 1e11 ? parsed / 1000 : parsed;
  }

  function toIntOrNull(value) {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildHourGroupKey(item) {
    const epochSeconds = getEpochSeconds(item);
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
      ?? ''
    ).trim();
    const match = rawHourId.match(/^(\d{8})_(\d{2})/);
    return match ? `${match[1]}_${match[2]}` : rawHourId;
  }

  function getUtcOffsetHours(item) {
    const metadata = getRawMetadata(item);
    const timeBadgeCfg = runtimeProfile?.timeBadge;
    const imageTitleCfg = runtimeProfile?.titleFormatting?.imageTitle;
    const offsetField = String(
      timeBadgeCfg?.utcOffsetField
      || imageTitleCfg?.utcOffsetField
      || 'utc_offset_hours'
    ).trim() || 'utc_offset_hours';

    const rawOffset =
      metadata?.[offsetField]
      ?? item?.raw?.[offsetField]
      ?? item?.[offsetField]
      ?? metadata?.utc_offset_hours
      ?? item?.raw?.utc_offset_hours
      ?? item?.utc_offset_hours;

    const parsed = toFiniteNumber(rawOffset);
    return parsed == null ? 0 : parsed;
  }

  function formatEpochHHmm(item, epochSeconds) {
    if (!Number.isFinite(epochSeconds)) return null;

    const timezone = getEffectiveTimeBadgeTimezone();
    const date = new Date(Math.max(0, epochSeconds) * 1000);

    // Honor explicit timeBadge timezone preference first.
    if (timezone === 'utc') {
      return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    }

    const useMetadataOffset = timezone === 'local';

    if (useMetadataOffset) {
      const offsetHours = getUtcOffsetHours(item);
      const adjustedDate = new Date(Math.max(0, epochSeconds + offsetHours * 3600) * 1000);
      return `${String(adjustedDate.getUTCHours()).padStart(2, '0')}:${String(adjustedDate.getUTCMinutes()).padStart(2, '0')}`;
    }

    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function getEffectiveTimeBadgeTimezone() {
    const configuredTimezone = String(runtimeProfile?.timeBadge?.timezone || 'local').trim().toLowerCase();
    return timeBadgeTimezoneOverride === 'utc'
      ? 'utc'
      : timeBadgeTimezoneOverride === 'local'
        ? 'local'
        : (showLocalTimeInTitles ? configuredTimezone : 'utc');
  }

  function getBadgeLabel(item, tcMap = fetchedTimecodes) {
    const badgeSource = String(runtimeProfile?.timeBadge?.source || 'epoch').trim().toLowerCase();
    const badgeFormat = String(runtimeProfile?.timeBadge?.format || 'HH:mm').trim();

    if (badgeSource === 'epoch') {
      const epochSeconds = getEpochSeconds(item);
      if (epochSeconds == null) return null;
      if (badgeFormat === 'HH:mm') return formatEpochHHmm(item, epochSeconds);
      return formatTimecode(epochSeconds);
    }

    if (badgeSource === 'hour_msb_middletime') {
      if (badgeFormat === 'HH:mm') {
        const epochSeconds = getEpochSeconds(item);
        if (epochSeconds != null) return formatEpochHHmm(item, epochSeconds);
      }

      const middle = getMiddleTimeSeconds(item);
      if (middle == null) return null;
      return formatTimecode(middle);
    }

    return getTimecodeLabel(item, tcMap);
  }

  function getTimecodeLabel(item, tcMap = fetchedTimecodes) {
    const imgId = getId(item);
    if (imgId && tcMap.has(imgId)) {
      const fetched = tcMap.get(imgId);
      return fetched == null ? null : formatTimecode(fetched);
    }

    const totalSeconds = getFrameSeconds(item);
    if (totalSeconds != null && totalSeconds >= 0) {
      return formatTimecode(totalSeconds);
    }

    return null;
  }

  const dispatch = createEventDispatcher();

  const handleOpen = (item) => {
    if (isSelectionMode) {
      // In modalità selezione, dispatch selectImage
      dispatch("selectImage", item);
    } else {
      // Standard modal open
      dispatch("open", { index: getIndex(item), img: item, frame: item });
    }
  };
  function handleOpenVideoPlayer(e, item) {
    e.preventDefault();
    e.stopPropagation();
    const imgId = getId(item);
    const videoId = getVideoId(item);
    const startAt = useSlideshowFromProfile() ? null : getVideoPlayerStartFromProfile(item);
    dispatch("openVideoPlayer", { img: item, imgId, videoId, startAt });
  }

  function handleOpenVideoPlayerFromStart(e, item) {
    e.preventDefault();
    e.stopPropagation();
    const imgId = getId(item);
    const videoId = getVideoId(item);
    dispatch("openVideoPlayer", { img: item, imgId, videoId, startAt: 0 });
  }

  const handleVideoSummary = (item, e) => { e.stopPropagation(); dispatch("videoSummary", { img: item }); };
  const handleSimilarity = (item, e) => { e.stopPropagation(); dispatch("similarity", { imgId: getId(item), frame: item }); };
  const handleRFPositive = (item, e) => { e.stopPropagation(); dispatch("rfPositive", { index: getIndex(item), img: item }); };
  const handleRFNegative = (item, e) => { e.stopPropagation(); dispatch("rfNegative", { index: getIndex(item), img: item }); };
  const handleSubmit = (item, e) => { e.stopPropagation(); dispatch("submit", { index: getIndex(item), img: item }); };
  $: isQaChallenge = String(challengeType ?? 'KIS').toUpperCase() === 'Q&A';
  $: allowFrameSubmit = showSubmitUI;

  function handleFrameDragStart(event, item) {
    if (!event.dataTransfer) return;

    const payload = {
      imgId: getId(item),
      url: getUrl(item),
      title: getTitle(item)
    };

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-visione-frame", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", payload.imgId || payload.title || "frame");
  }

  let containerEl;
  let lastRegisteredContainer = null;
  let observedContainer = null;
  let containerResizeObserver = null;
  let imagePreloadObserver = null;
  let scrollRaf = 0;

  const OVERSCAN_ROWS = 6;
  const FALLBACK_ROW_HEIGHT = 240;

  let scrollTop = 0;
  let viewportHeight = 0;
  let containerWidth = 0;
  const FAB_SCROLL_THRESHOLD = 400;
  $: showFab = scrollTop > FAB_SCROLL_THRESHOLD;
  let virtualizationEnabled = false;
  let visibleStart = 0;
  let visibleEnd = 0;
  let topSpacer = 0;
  let bottomSpacer = 0;
  let visibleRows = [];
  const measuredRowHeights = new Map();
  const eagerImageIds = new Set();
  let eagerVersion = 0;
  let lastItemsLength = 0;
  let lastItemsFingerprint = '';

  $: if (containerEl && containerEl !== lastRegisteredContainer) {
    registerContainer(containerEl);
    lastRegisteredContainer = containerEl;
  }

  $: if (containerEl && containerEl !== observedContainer) {
    if (containerResizeObserver && observedContainer) {
      containerResizeObserver.disconnect();
    }

    observedContainer = containerEl;
    viewportHeight = containerEl.clientHeight || 0;
    containerWidth = containerEl.clientWidth || 0;
    scrollTop = containerEl.scrollTop || 0;

    if (typeof ResizeObserver !== "undefined") {
      containerResizeObserver = new ResizeObserver(() => {
        viewportHeight = containerEl?.clientHeight || 0;
        containerWidth = containerEl?.clientWidth || 0;
        recomputeVirtualWindow();
      });
      containerResizeObserver.observe(containerEl);
    }

    if (typeof IntersectionObserver !== "undefined") {
      if (imagePreloadObserver) imagePreloadObserver.disconnect();
      imagePreloadObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const node = entry.target;
            const imgId = node?.dataset?.imgId;
            if (!imgId || eagerImageIds.has(imgId)) continue;
            eagerImageIds.add(imgId);
            eagerVersion += 1;
            imagePreloadObserver?.unobserve(node);
          }
        },
        { root: containerEl, rootMargin: '600px 0px', threshold: 0.01 }
      );
    }

    recomputeVirtualWindow();
  }

  async function handleContextPreview(e, item) {
    if (!hasCollectionVideos) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const imgId = getId(item);
      const videoId = getVideoId(item);
      let timestamp = getVideoPlayerStartFromProfile(item);
      if (timestamp == null && imgId && visioneAPI.supportsVideos) {
        try {
          const metadata = await visioneAPI.getField(imgId, ['hour_msb_middletime', 'video_offset_seconds']);
          const middle = toSecondsValue(metadata?.hour_msb_middletime);
          const offset = toSecondsValue(metadata?.video_offset_seconds);
          if (middle != null && middle >= 0) timestamp = middle;
          else if (offset != null && offset >= 0) timestamp = offset;
        } catch {
          // Ignore and keep fallback chain below.
        }
      }
      if (timestamp == null && imgId && visioneAPI.supportsVideos) {
        try {
          const middle = await visioneAPI.getMiddleTimestamp(imgId);
          if (Number.isFinite(middle) && middle >= 0) {
            timestamp = middle;
          }
        } catch {
          // Ignore and keep fallback chain below.
        }
      }
      if (timestamp == null) {
        timestamp = getFrameSeconds(item) ?? 0;
      }
      const start = Math.max(0, timestamp - 2);
      const end = timestamp + 2;
      const explicitVideoUrl = item?.videoUrl || item?.raw?.metadata?.videos || null;
      preview = { imgId, videoUrl: explicitVideoUrl || visioneAPI.getVideoUrl(videoId, "medium"), start, end };
    } catch (err) {
      console.error("Preview error", err);
    }
  }

  const rowInfoCache = new Map();

  $: {
    // Badge labels depend on these settings; clear cache so UI updates immediately.
    void resultsetBadgeLabelMode;
    void showLocalTimeInTitles;
    void timeBadgeTimezoneOverride;
    rowInfoCache.clear();
  }

  // Helper to build row header info
  function getRowInfo(row, rowIndex = -1) {
    if (!row || row.length === 0) return null;
    const firstItem = row[0];
    const rowChunkBoundary = !!row?.__visioneChunkBoundary;
    const cacheKey = `${viewMode}::${resultsetBadgeLabelMode}::${showLocalTimeInTitles ? 1 : 0}::${timeBadgeTimezoneOverride}::${rowIndex}::${firstItem?.imgId ?? firstItem?.index ?? "row"}::${row.length}::${rowChunkBoundary ? 1 : 0}`;
    if (rowInfoCache.has(cacheKey)) return rowInfoCache.get(cacheKey);
    
    let info = null;
    
    if (activeGroupBy?.kind === 'video' || activeGroupBy?.kind === 'metadata') {
      const groupValue = getGroupValueForItem(firstItem);
      const prevRow = rowIndex > 0 && Array.isArray(items[rowIndex - 1]) ? items[rowIndex - 1] : null;
      const prevFirstItem = prevRow && prevRow.length > 0 ? prevRow[0] : null;
      const prevGroupValue = prevFirstItem ? getGroupValueForItem(prevFirstItem) : null;
      const nextRow = rowIndex >= 0 && rowIndex < items.length - 1 && Array.isArray(items[rowIndex + 1]) ? items[rowIndex + 1] : null;
      const nextFirstItem = nextRow && nextRow.length > 0 ? nextRow[0] : null;
      const nextGroupValue = nextFirstItem ? getGroupValueForItem(nextFirstItem) : null;
      const prevChunkBoundary = !!prevRow?.__visioneChunkBoundary;
      const nextChunkBoundary = !!nextRow?.__visioneChunkBoundary;
      const sameAsPrev = !rowChunkBoundary && !prevChunkBoundary && prevGroupValue === groupValue;
      const sameAsNext = !rowChunkBoundary && !nextChunkBoundary && nextGroupValue === groupValue;
      let continuationRows = 0;

      if (sameAsNext) {
        for (let index = rowIndex + 1; index < items.length; index += 1) {
          const candidateRow = Array.isArray(items[index]) ? items[index] : null;
          const candidateFirstItem = candidateRow && candidateRow.length > 0 ? candidateRow[0] : null;
          if (candidateRow?.__visioneChunkBoundary) break;
          if (!candidateFirstItem || getGroupValueForItem(candidateFirstItem) !== groupValue) break;
          continuationRows += 1;
        }
      }

      let precedingRows = 0;
      if (sameAsPrev) {
        for (let index = rowIndex - 1; index >= 0; index -= 1) {
          const candidateRow = Array.isArray(items[index]) ? items[index] : null;
          const candidateFirstItem = candidateRow && candidateRow.length > 0 ? candidateRow[0] : null;
          if (candidateRow?.__visioneChunkBoundary) break;
          if (!candidateFirstItem || getGroupValueForItem(candidateFirstItem) !== groupValue) break;
          precedingRows += 1;
        }
      }

      const groupRowCount = precedingRows + 1 + continuationRows;
      const groupLabelRowIndex = Math.floor(groupRowCount / 2);

      const displayGroupValue = (
        String(activeGroupBy?.kind || '').trim().toLowerCase() === 'video'
        || (
          String(activeGroupBy?.kind || '').trim().toLowerCase() === 'metadata'
          && String(activeGroupBy?.metadata || '').trim().toLowerCase() === 'hour_id'
        )
      )
          ? formatGroupHourLabel(groupValue, firstItem, runtimeProfile, showLocalTimeInTitles)
          : (shouldFormatTemporalGroupBadge()
            ? formatVideoGroupLabel(groupValue, firstItem, runtimeProfile, showLocalTimeInTitles, getVideoBadgeModeOverride())
            : `${groupValue}`);

      info = {
        type: 'grouped',
        groupKind: activeGroupBy.kind,
        groupLabel: activeGroupBy.label || 'Group',
        label: displayGroupValue,
        item: firstItem,
        showVideoBadge: !sameAsPrev,
        isVideoGroupStart: !sameAsPrev,
        isVideoGroupEnd: !sameAsNext,
        continuesFromPreviousRow: sameAsPrev,
        continuesToNextRow: sameAsNext,
        continuationRows,
        groupRowCount,
        groupRowOffset: precedingRows,
        showGroupLabelOnThisRow: precedingRows === groupLabelRowIndex
      };
      rowInfoCache.set(cacheKey, info);
      return info;
    }
    
    if (activeGroupBy?.kind === 'date') {
      const explicitDayKey = String(row?.__visioneGroupKey || '').trim();
      const explicitDateLabel = explicitDayKey
        ? formatGroupDateLabel(explicitDayKey, firstItem, runtimeProfile, showLocalTimeInTitles)
        : '';

      if (explicitDateLabel) {
        info = {
          type: 'grouped',
          groupKind: 'date',
          groupLabel: activeGroupBy.label || 'Date',
          label: explicitDateLabel,
          item: firstItem,
          showVideoBadge: true,
          isVideoGroupStart: true,
          isVideoGroupEnd: true,
          continuesFromPreviousRow: false,
          continuesToNextRow: false,
          continuationRows: 0,
          groupRowCount: 1,
          groupRowOffset: 0,
          showGroupLabelOnThisRow: true
        };
        rowInfoCache.set(cacheKey, info);
        return info;
      }

      const epochSeconds = getEpochSeconds(firstItem);
      const fallbackRaw = toFiniteNumber(firstItem?.timestamp ?? firstItem?.raw?.timestamp ?? 0);
      const fallbackSeconds = Number.isFinite(fallbackRaw)
        ? (fallbackRaw > 1e11 ? fallbackRaw / 1000 : fallbackRaw)
        : 0;
      const safeEpochSeconds = epochSeconds ?? fallbackSeconds;
      const date = safeEpochSeconds > 0 ? new Date(safeEpochSeconds * 1000) : new Date();
      const timezone = getEffectiveTimeBadgeTimezone();

      const dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: timezone === 'utc' ? 'UTC' : undefined
      });
      
      info = {
        type: 'grouped',
        groupKind: 'date',
        groupLabel: activeGroupBy.label || 'Date',
        label: dateLabel,
        item: firstItem,
        showVideoBadge: true,
        isVideoGroupStart: true,
        isVideoGroupEnd: true,
        continuesFromPreviousRow: false,
        continuesToNextRow: false,
        continuationRows: 0,
        groupRowCount: 1,
        groupRowOffset: 0,
        showGroupLabelOnThisRow: true
      };
      rowInfoCache.set(cacheKey, info);
      return info;
    }
    
    rowInfoCache.set(cacheKey, null);
    return null; // No header for byrank
  }

  function getVideoRowShellClass(rowInfo, rowIndex) {
    if (rowInfo?.type !== 'grouped') return '';

    const palette = 'bg-white border-slate-300/70 shadow-none';

    const radius = rowInfo.isVideoGroupStart && rowInfo.isVideoGroupEnd
      ? 'rounded-xl'
      : rowInfo.isVideoGroupStart
        ? 'rounded-t-xl rounded-b-none'
        : rowInfo.isVideoGroupEnd
          ? 'rounded-t-none rounded-b-xl'
          : 'rounded-none';

    const margin = rowInfo.isVideoGroupEnd ? 'mb-1' : 'mb-0';
    const joinTop = rowInfo.continuesFromPreviousRow ? 'border-t-0 -mt-px' : '';
    const joinBottom = rowInfo.continuesToNextRow ? 'border-b-0' : '';
    const groupChrome = '';

    return `relative ml-2 mr-2.5 ${margin} border ${groupChrome} ${palette} ${radius} ${joinTop} ${joinBottom}`;
  }

  function getVerticalVideoBadgeClass(rowInfo) {
    if (rowInfo?.type !== 'grouped') return '';

    const radius = rowInfo.isVideoGroupStart && rowInfo.isVideoGroupEnd
      ? 'rounded-md'
      : rowInfo.isVideoGroupStart
        ? 'rounded-t-md rounded-b-none'
        : rowInfo.isVideoGroupEnd
          ? 'rounded-t-none rounded-b-md'
          : 'rounded-none';

    const top = rowInfo.isVideoGroupStart ? 'top-2' : 'top-0';
    const bottom = rowInfo.isVideoGroupEnd ? 'bottom-2' : 'bottom-0';
    const joinTop = rowInfo.continuesFromPreviousRow ? 'border-t-0 -mt-[2px]' : '';
    const joinBottom = rowInfo.continuesToNextRow ? 'border-b-0' : '';

    return `ui-video-badge group/video absolute left-1.5 ${top} ${bottom} z-20 w-5 inline-flex flex-col items-center justify-center gap-1 border transition-colors ${radius} ${joinTop} ${joinBottom}`;
  }

  function getEstimatedColumns(rowInfo) {
    if (!containerWidth || containerWidth <= 0) return 1;

    let minCardWidth = 140;
    if (typeof window !== 'undefined') {
      const rootStyles = getComputedStyle(document.documentElement);
      const cssMin = Number.parseFloat(rootStyles.getPropertyValue('--min-card-w'));
      if (Number.isFinite(cssMin) && cssMin > 0) minCardWidth = cssMin;
    }

    const gap = rowInfo?.type === 'grouped' ? 12 : 16;
    const horizontalPadding = rowInfo?.type === 'grouped'
      ? (videoBadgeOrientation === 'vertical' ? 40 : 20)
      : 20;
    const usableWidth = Math.max(0, containerWidth - horizontalPadding);

    return Math.max(1, Math.floor((usableWidth + gap) / (minCardWidth + gap)));
  }

  function shouldJustifyRow(row, rowInfo) {
    if (!justifyResultRows) return false;
    if (!Array.isArray(row) || row.length === 0) return false;

    const estimatedColumns = getEstimatedColumns(rowInfo);

    // Avoid stretching rows that are "almost full" (e.g. 5 items when 6 fit).
    return row.length >= estimatedColumns;
  }

  $: {
    if (rowInfoCache.size > 1000) rowInfoCache.clear();
  }

  $: {
    // Detect dataset identity changes (not just length) to avoid stale timecode caches
    const fp = items.length > 0
      ? `${items.length}:${getId(items[0])}:${getId(items[items.length - 1])}`
      : '0';
    const lengthChanged = items.length !== lastItemsLength;
    const datasetChanged = fp !== lastItemsFingerprint;

    if (datasetChanged) {
      measuredRowHeights.clear();
      prefixHeights = null;
      eagerImageIds.clear();
      eagerVersion += 1;
      timecodeQueue.length = 0;
      requestedTimecodeIds.clear();
      pendingTimecodes.clear();
      if (timecodeFlushRaf) {
        cancelAnimationFrame(timecodeFlushRaf);
        timecodeFlushRaf = 0;
      }
      fetchedTimecodes = new Map();
      lastItemsFingerprint = fp;
    }

    if (lengthChanged || datasetChanged) {
      lastItemsLength = items.length;
      recomputeVirtualWindow();
    }
  }

  function enqueueTimecodeForVisibleRows() {
    for (const bucket of visibleRows) {
      const row = bucket?.row;
      if (!Array.isArray(row)) continue;
      for (const item of row) {
        enqueueTimecodeFetch(item);
      }
    }
    if (timecodeQueue.length > 0) pumpTimecodeQueue();
  }

  $: if (visibleRows) {
    enqueueTimecodeForVisibleRows();
  }

  // Reactive badge labels map — driven by runtimeProfile.
  // Using a $: block guarantees Svelte tracks it as a template dependency.
  $: _tcLabels = (() => {
    void runtimeProfile;
    void showLocalTimeInTitles;
    void timeBadgeTimezoneOverride;

    const labels = new Map();
    for (const bucket of visibleRows) {
      const row = bucket?.row;
      if (!Array.isArray(row)) continue;
      for (const item of row) {
        const imgId = getId(item);
        if (!imgId) continue;

        const label = getBadgeLabel(item, fetchedTimecodes);
        if (label) labels.set(imgId, label);
      }
    }
    return labels;
  })();

  $: {
    const threshold = Math.max(10, Number(virtualizeThreshold) || 40);
    virtualizationEnabled = !!virtualizeRows && items.length > threshold;
    recomputeVirtualWindow();
  }

  function sumHeights(start, end) {
    if (!prefixHeights || prefixHeights.length !== items.length + 1) rebuildPrefixHeights();
    return prefixHeights[end] - prefixHeights[start];
  }

  function findRowIndexAtOffset(offset) {
    if (!prefixHeights || prefixHeights.length !== items.length + 1) rebuildPrefixHeights();
    const target = Math.max(0, offset);
    if (items.length === 0) return 0;
    if (target >= prefixHeights[items.length]) return Math.max(0, items.length - 1);
    let lo = 0, hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (prefixHeights[mid + 1] <= target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  let prefixHeights = null;

  function rebuildPrefixHeights() {
    const n = items.length;
    prefixHeights = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      prefixHeights[i + 1] = prefixHeights[i] + (measuredRowHeights.get(i) ?? FALLBACK_ROW_HEIGHT);
    }
  }

  function recomputeVirtualWindow() {
    if (!Array.isArray(items) || items.length === 0) {
      visibleStart = 0;
      visibleEnd = 0;
      topSpacer = 0;
      bottomSpacer = 0;
      visibleRows = [];
      return;
    }

    if (!virtualizationEnabled) {
      visibleStart = 0;
      visibleEnd = items.length;
      topSpacer = 0;
      bottomSpacer = 0;
      visibleRows = items.map((row, rowIndex) => ({ row, rowIndex }));
      return;
    }

    const viewportBottom = scrollTop + Math.max(viewportHeight, FALLBACK_ROW_HEIGHT);
    const firstVisible = findRowIndexAtOffset(scrollTop);
    const lastVisible = findRowIndexAtOffset(viewportBottom);

    visibleStart = Math.max(0, firstVisible - OVERSCAN_ROWS);
    visibleEnd = Math.min(items.length, lastVisible + OVERSCAN_ROWS + 1);

    topSpacer = sumHeights(0, visibleStart);
    const visibleHeight = sumHeights(visibleStart, visibleEnd);
    const totalHeight = sumHeights(0, items.length);
    bottomSpacer = Math.max(0, totalHeight - topSpacer - visibleHeight);

    visibleRows = items
      .slice(visibleStart, visibleEnd)
      .map((row, offset) => ({ row, rowIndex: visibleStart + offset }));
  }

  function handleScroll() {
    if (!containerEl) return;
    if (scrollRaf) return;

    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      scrollTop = containerEl.scrollTop || 0;
      recomputeVirtualWindow();
      enqueueTimecodeForVisibleRows();
    });
  }

  function observeCardForPreload(node, item) {
    const imgId = getId(item);
    if (!imgId) return;
    if (!imagePreloadObserver) return;
    node.dataset.imgId = String(imgId);
    imagePreloadObserver.observe(node);

    return {
      update(nextItem) {
        const nextId = getId(nextItem);
        if (!nextId) return;
        node.dataset.imgId = String(nextId);
        imagePreloadObserver?.observe(node);
      },
      destroy() {
        imagePreloadObserver?.unobserve(node);
      }
    };
  }

  function isEager(item) {
    const id = getId(item);
    return !!id && eagerImageIds.has(id);
  }

  function measureRow(node, rowIndex) {
    let currentRowIndex = rowIndex;
    let observer;

    const updateHeight = () => {
      const next = Math.max(80, Math.round(node.getBoundingClientRect().height));
      const prev = measuredRowHeights.get(currentRowIndex);
      if (prev !== next) {
        measuredRowHeights.set(currentRowIndex, next);
        prefixHeights = null;
        recomputeVirtualWindow();
      }
    };

    if (virtualizationEnabled) {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(updateHeight);
        observer.observe(node);
      }
      updateHeight();
    }

    return {
      update(nextRowIndex) {
        currentRowIndex = nextRowIndex;
        if (virtualizationEnabled) updateHeight();
      },
      destroy() {
        if (observer) observer.disconnect();
      }
    };
  }

  onDestroy(() => {
    if (containerResizeObserver) containerResizeObserver.disconnect();
    if (imagePreloadObserver) imagePreloadObserver.disconnect();
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    if (timecodeFlushRaf) cancelAnimationFrame(timecodeFlushRaf);
  });
</script>

<div class="relative h-full">
<div bind:this={containerEl} class="h-full overflow-y-auto overflow-x-hidden custom-scrollbar" on:scroll={handleScroll}>
  {#if topSpacer > 0}
    <div style={`height: ${topSpacer}px;`} aria-hidden="true"></div>
  {/if}

  {#each visibleRows as { row, rowIndex } (rowIndex)}
    {@const rowInfo = getRowInfo(row, rowIndex)}
    
    <div
      use:measureRow={rowIndex}
      class="w-full {rowInfo?.type === 'grouped' || row?.__visioneNoGroupChunk ? '' : rowIndex % 2 === 0 ? 'bg-gradient-to-r from-white to-gray-50' : 'bg-gradient-to-r from-gray-50 to-white'}"
    >
      
        <!-- Row header (solo per byvideo e bydate) -->
        {#if rowInfo}
          {#if rowInfo.type === 'date'}
            <div class="sticky top-0 z-30 px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-300 flex items-center justify-between shadow-sm">
              <div class="flex items-center space-x-3">
                <div class="p-1.5 bg-blue-100 rounded-lg">
                  <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>

                <div>
                  <h3 class="text-sm font-bold text-gray-800">{rowInfo.label}</h3>
                  <p class="text-xs text-gray-500">{rowInfo.subtitle}</p>
                </div>
              </div>
            </div>
          {/if}
        {/if}

      
      <!-- Frames grid -->
      <div
        class="flex flex-wrap w-full p-2.5 {shouldJustifyRow(row, rowInfo) ? 'justify-between' : ''} {getVideoRowShellClass(rowInfo, rowIndex)} {rowInfo?.type === 'grouped' ? (videoBadgeOrientation === 'vertical' ? 'pt-2 pb-2 pl-8 pr-2' : 'pt-8 pb-2 px-2') : ''}"
        style={`gap: ${rowInfo?.type === 'grouped' ? '12px' : 'var(--grid-gap, 16px)'};`}
      >
        {#if rowInfo?.type === 'grouped' && videoBadgeOrientation === 'horizontal' && rowInfo?.continuesFromPreviousRow}
          <div class="pointer-events-none absolute left-2 top-1.5 z-10 inline-flex items-center rounded-full border border-slate-300/80 bg-white/92 px-1.5 py-1 text-slate-600 shadow-sm backdrop-blur-sm" aria-hidden="true">
            <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 7h14" />
              <path d="M12 7v8" />
              <path d="M8.5 11.5L12 15l3.5-3.5" />
              <path d="M5 19h14" />
            </svg>
          </div>
        {/if}

        {#if rowInfo?.type === 'grouped' && videoBadgeOrientation === 'vertical'}
          {#if rowInfo.groupKind === 'video'}
            <button
              on:click={(e) => handleOpenVideoPlayerFromStart(e, rowInfo.item)}
              class={`${getVerticalVideoBadgeClass(rowInfo)} hover:from-slate-600 hover:to-slate-800`}
              title={`Open ${getGroupDisplayLabel(rowInfo)}`}
            >
              {#if rowInfo.showGroupLabelOnThisRow}
                <svg class="w-2.5 h-2.5 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                <span class="text-[10px] font-semibold leading-none [writing-mode:vertical-rl] rotate-180 tracking-[0.02em]">{rowInfo.label}</span>
              {/if}
            </button>
          {:else}
            <div class={getVerticalVideoBadgeClass(rowInfo)} title={getGroupDisplayLabel(rowInfo)}>
              {#if rowInfo.showGroupLabelOnThisRow}
                {#if rowInfo.groupKind === 'date'}
                  <svg class="w-2.5 h-2.5 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                {:else}
                  <svg class="w-2.5 h-2.5 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="4" width="16" height="16" rx="3" ry="3"/>
                    <path d="M8 9h8M8 13h8M8 17h5"/>
                  </svg>
                {/if}
                <span class="text-[10px] font-semibold leading-none [writing-mode:vertical-rl] rotate-180 tracking-[0.02em]">{rowInfo.label}</span>
              {/if}
            </div>
          {/if}
        {/if}

        {#if rowInfo?.type === 'grouped' && rowInfo?.showVideoBadge && videoBadgeOrientation === 'horizontal'}
          {#if rowInfo.groupKind === 'video'}
            <button
              on:click={(e) => handleOpenVideoPlayerFromStart(e, rowInfo.item)}
              class="ui-video-badge group/video absolute left-2 top-1.5 z-20 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors overflow-visible"
              title={`Open ${getGroupDisplayLabel(rowInfo)}`}
            >
              <svg class="w-3 h-3 shrink-0 opacity-90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
              <span class="text-[11px] font-semibold leading-none tracking-[0.02em]">{rowInfo.label}</span>
              {#if rowInfo?.continuesToNextRow}
                <span
                  class="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-slate-100"
                  aria-label={`${getGroupDisplayLabel(rowInfo)} continues for ${rowInfo.continuationRows} more row${rowInfo.continuationRows === 1 ? '' : 's'}`}
                >
                  <svg class="w-2.5 h-2.5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v12" />
                    <path d="M7 12l5 5 5-5" />
                  </svg>
                  <span>+{rowInfo.continuationRows}</span>
                </span>
              {/if}
            </button>
          {:else}
            <div
              class="ui-video-badge group/video absolute left-2 top-1.5 z-20 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 overflow-visible"
              title={getGroupDisplayLabel(rowInfo)}
            >
              {#if rowInfo.groupKind === 'date'}
                <svg class="w-3 h-3 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              {:else}
                <svg class="w-3 h-3 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="4" width="16" height="16" rx="3" ry="3"/>
                  <path d="M8 9h8M8 13h8M8 17h5"/>
                </svg>
              {/if}
              <span class="text-[11px] font-semibold leading-none tracking-[0.02em]">{rowInfo.label}</span>
              {#if rowInfo?.continuesToNextRow}
                <span
                  class="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-slate-100"
                  aria-label={`${getGroupDisplayLabel(rowInfo)} continues for ${rowInfo.continuationRows} more row${rowInfo.continuationRows === 1 ? '' : 's'}`}
                >
                  <svg class="w-2.5 h-2.5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v12" />
                    <path d="M7 12l5 5 5-5" />
                  </svg>
                  <span>+{rowInfo.continuationRows}</span>
                </span>
              {/if}
            </div>
          {/if}
        {/if}

        {#each row as item, colIndex (getCardRenderKey(item, rowIndex, colIndex))}
          {@const noGroupDateBadgeLabel = getNoGroupDateBadgeLabel(item)}
          <div class="flex flex-col gap-1">
            {#if noGroupDateBadgeLabel}
              <div
                class="inline-flex max-w-full items-center gap-1.5 self-start rounded-md border px-2 py-1 text-[10px] font-semibold leading-none tracking-[0.02em] shadow-sm"
                style="background: var(--ui-video-badge-bg); border-color: var(--ui-video-badge-border); color: var(--ui-video-badge-text); box-shadow: var(--ui-video-badge-shadow);"
              >
                <svg class="w-3 h-3 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span class="truncate">{noGroupDateBadgeLabel}</span>
              </div>
            {/if}
            <div
              use:observeCardForPreload={item}
              data-index={getIndex(item)}
              data-img-id={getId(item)}
              data-frame-id={getId(item)}
              draggable="true"
              class="group relative rounded-xl overflow-hidden flex items-center justify-center
                    cursor-pointer transition-all duration-200 focus:outline-none
                    {isSelectionMode 
                      ? 'ring-4 ring-green-500 hover:ring-green-600 shadow-lg shadow-green-500/30 hover:scale-105' 
                      : isSelected(item)
                        ? 'border border-sky-500/80 ring-2 ring-sky-300/45 shadow-md shadow-sky-500/15'
                        : 'border border-slate-300/70 hover:border-slate-400/80 hover:shadow-sm'}"
              style="height: var(--kf-size, 160px); min-width: var(--min-card-w, 140px);"
              title={isSelectionMode ? `✓ Click to select: ${getTitle(item)}` : getTitle(item)}
              role="button"
              tabindex="0"
              on:click={() => handleOpen(item)}
              on:keydown={(e) => e.key === 'Enter' && handleOpen(item)}
              on:contextmenu={(e) => !isSelectionMode && hasCollectionVideos && handleContextPreview(e, item)}
              on:dragstart={(e) => handleFrameDragStart(e, item)}
            >
              {#if Number(item?.tupleSize || 1) > 1 && showTupleBar()}
                <div class="absolute left-0 top-0 bottom-0 z-5 w-1.5 rounded-l-xl pointer-events-none" style={getTupleAccentStyle(item)}></div>
              {/if}

              <div class="absolute left-2 top-2 z-30 pointer-events-none inline-flex items-center gap-1">
                <div class="rounded-md border border-slate-500/65 bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-100 backdrop-blur-sm">
                  {getRankBadgeLabel(item, rowIndex, colIndex)}
                </div>
                {#if Number(item?.tupleSize || 1) > 1 && showTupleBadge()}
                  <div class="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-sm" style={getTupleBadgeStyle(item)}>
                    {getTupleA11yLabel(item)}
                  </div>
                {/if}
              </div>

              <!-- Badge in selection mode -->
              {#if isSelectionMode}
                <div class="absolute top-10 left-2 z-30 bg-green-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg flex items-center space-x-1.5 animate-pulse">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>CLICK TO SELECT</span>
                </div>
              {/if}
              {#if preview.imgId === getId(item)}
                <VideoOverlay
                  videoUrl={preview.videoUrl}
                  start={preview.start}
                  end={preview.end}
                  on:close={() => (preview = { imgId: null, videoUrl: null, start: 0, end: 0 })}
                />
              {/if}


              <div class="image-overlay absolute inset-0 z-10 transition-all duration-200 pointer-events-none"></div>

              <div class="absolute inset-0 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button
                    class="w-12 h-12 rounded-full bg-slate-200/85 text-slate-900 shadow-xl flex items-center justify-center border border-slate-300/80 ring-1 ring-black/5 transition-transform duration-150 hover:scale-110 hover:bg-slate-100 active:scale-95 pointer-events-auto"
                    style="--play-size: clamp(36px, calc(var(--kf-size, 160px) * 0.28), 72px); width: var(--play-size); height: var(--play-size);"
                    title="Play video"
                    aria-label="Play video"
                    on:click={(e) => handleOpenVideoPlayer(e, item)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      class="text-slate-900"
                      style="width: calc(var(--play-size) * 0.46); height: calc(var(--play-size) * 0.46);"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
                <!-- Barra bottom stile YouTube -->
                <div class="absolute bottom-0.5 left-2 right-2 flex items-center justify-between bg-black/75 backdrop-blur-md rounded-md px-2 py-1 h-9 shadow-xl">
                  <!-- Left group: video actions -->
                  <div class="flex items-center space-x-1">
                    {#if showVideoSummary}
                      <button
                        class="p-1 hover:bg-white/20 rounded transition-colors"
                        title="Context view"
                        aria-label="Open context view"
                        on:click={(e) => handleVideoSummary(item, e)}
                      >
                        <img src="/icons/context-view.svg" alt="" class="w-4 h-4" aria-hidden="true" />
                      </button>
                    {/if}

                    <button
                      class="p-1 hover:bg-white/20 rounded transition-colors"
                      title="Image similarity"
                      aria-label="Run image similarity"
                      on:click={(e) => handleSimilarity(item, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </button>
                  </div>

                  <!-- Right group: feedback actions -->
                  <div class="flex items-center space-x-1">
                    <button
                      class="p-1 rounded transition-colors {rfPositiveIds.has(safeImgId(getId(item))) ? 'bg-emerald-600/70 ring-1 ring-emerald-300/70' : 'hover:bg-green-500/30'}"
                      title={rfPositiveIds.has(safeImgId(getId(item))) ? 'Positive feedback selected' : 'Positive feedback'}
                      aria-label={rfPositiveIds.has(safeImgId(getId(item))) ? 'Positive feedback selected' : 'Add positive feedback'}
                      on:click={(e) => handleRFPositive(item, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 {rfPositiveIds.has(safeImgId(getId(item))) ? 'text-white' : 'text-green-400'}" fill="currentColor">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                      </svg>
                    </button>

                    <button
                      class="p-1 rounded transition-colors {rfNegativeIds.has(safeImgId(getId(item))) ? 'bg-rose-600/70 ring-1 ring-rose-300/70' : 'hover:bg-red-500/30'}"
                      title={rfNegativeIds.has(safeImgId(getId(item))) ? 'Negative feedback selected' : 'Negative feedback'}
                      aria-label={rfNegativeIds.has(safeImgId(getId(item))) ? 'Negative feedback selected' : 'Add negative feedback'}
                      on:click={(e) => handleRFNegative(item, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 {rfNegativeIds.has(safeImgId(getId(item))) ? 'text-white' : 'text-red-400'}" fill="currentColor">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Submit button: top-right, solo se NON submitted -->
                {#if allowFrameSubmit && !item.submitted}
                  <div
                    role="button"
                    tabindex="0"
                    class="absolute top-2 right-2 z-40 p-2 bg-green-600/80 hover:bg-green-600 backdrop-blur-sm rounded-lg transition-all shadow-lg cursor-pointer"
                    title={isQaChallenge ? 'Submit answer' : 'Submit'}
                    aria-label={isQaChallenge ? 'Submit answer' : 'Submit frame'}
                    on:click={(e) => handleSubmit(item, e)}
                    on:keydown={(e) => e.key === 'Enter' && handleSubmit(item, e)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M12 19V7M5 12l7-7 7 7"/>
                    </svg>
                  </div>
                {/if}
              </div>

              {#if allowFrameSubmit}
                <SubmitBadge submitted={!!item.submitted} verdict={item?.submissionVerdict} />
              {/if}

              {#if _tcLabels.get(getId(item))}
                <div class="absolute bottom-2 left-2 z-30 inline-flex items-center px-1.5 py-0.5 rounded-md border border-slate-300/35 bg-slate-700/95 text-slate-100 text-[10px] font-semibold tracking-wide shadow-md pointer-events-none transition-all duration-200 group-hover:bottom-11">
                  {_tcLabels.get(getId(item))}
                </div>
              {/if}

              {#if rfPositiveIds.has(safeImgId(getId(item))) || rfNegativeIds.has(safeImgId(getId(item)))}
                <div
                  class="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5 pointer-events-none"
                >
                  {#if rfPositiveIds.has(safeImgId(getId(item)))}
                    <div class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-100/70 bg-emerald-600 text-white shadow-md" title="Positive feedback">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-3 h-3" fill="currentColor" aria-hidden="true">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                      </svg>
                    </div>
                  {/if}
                  {#if rfNegativeIds.has(safeImgId(getId(item)))}
                    <div class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-100/70 bg-rose-600 text-white shadow-md" title="Negative feedback">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-3 h-3" fill="currentColor" aria-hidden="true">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                      </svg>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if getUrl(item)}
                <img
                  src={getUrl(item)}
                  alt={getTitle(item)}
                  loading={eagerVersion >= 0 && isEager(item) ? "eager" : "lazy"}
                  decoding="async"
                  fetchpriority={eagerVersion >= 0 && isEager(item) ? "high" : "auto"}
                  class="block"
                  style="height: 100%; width: auto; object-fit: contain;"
                />
              {:else}
                <div class="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                    <span class="text-xs text-gray-500 font-medium">{getTitle(item)}</span>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

  {#if bottomSpacer > 0}
    <div style={`height: ${bottomSpacer}px;`} aria-hidden="true"></div>
  {/if}
</div>

{#if showFab}
  <button
    class="fab-scroll-top"
    on:click={() => containerEl?.scrollTo({ top: 0, behavior: 'smooth' })}
    title="Scroll to top"
    aria-label="Scroll to top"
  >
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  </button>
{/if}
</div>

<style>
  .image-overlay {
    background-color: rgba(0, 0, 0, 0);
    pointer-events: none;
    transition: background-color 0.2s ease;
  }
  
  .group:hover .image-overlay {
    background-color: rgba(0, 0, 0, 0.15);
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.4);
    border-radius: 5px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.6);
  }

  .fab-scroll-top {
    position: absolute;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 40;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background: rgba(59, 130, 246, 0.85);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
    opacity: 0.8;
  }
  .fab-scroll-top:hover {
    opacity: 1;
    background: rgba(59, 130, 246, 1);
    transform: scale(1.1);
  }
</style>
