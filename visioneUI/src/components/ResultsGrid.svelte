<script>
  import { createEventDispatcher, onDestroy } from "svelte";
  import SubmitBadge from "./SubmitBadge.svelte";
  import { visioneAPI } from "../services/api.js";
  import VideoOverlay from "./VideoOverlay.svelte";

  export let items = [];
  export let selectedId = null;
  export let showVideoSummary = false;
  export let registerContainer = (el) => {};
  export let viewMode = "byrank"; // ✅ NUOVA PROP
  export let videoBadgeOrientation = "vertical";
  export let isSelectionMode = false;
  export let virtualizeRows = true;
  export let virtualizeThreshold = 40;
  export let justifyResultRows = false;
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let rfPositive = [];
  export let rfNegative = [];
  export let runtimeProfile = {};

  const safeImgId = (value) => String(value || '').trim();
  $: rfPositiveIds = new Set((Array.isArray(rfPositive) ? rfPositive : []).map((item) => safeImgId(item?.imgId)));
  $: rfNegativeIds = new Set((Array.isArray(rfNegative) ? rfNegative : []).map((item) => safeImgId(item?.imgId)));

  let preview = { imgId: null, videoUrl: null, start: 0, end: 0 };

  const getVideoId = (item) => {
    const vid = item.videoId ?? String(getId(item)).split("-")[0];
    return String(vid).padStart(5, "0");
  };

  const getId = (item) => item.imgId;
  const getIndex = (item) => item.index ?? item.idx ?? -1;
  const getUrl = (item) => item.url;
  const getTitle = (item) => item.title ?? item.imgId ?? `Item ${getIndex(item) + 1}`;
  const isSelected = (item) => selectedId === getId(item);

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

  function formatEpochHHmm(epochSeconds) {
    if (!Number.isFinite(epochSeconds)) return null;
    const timezone = String(runtimeProfile?.timeBadge?.timezone || 'local').trim().toLowerCase();
    const date = new Date(Math.max(0, epochSeconds) * 1000);

    if (timezone === 'utc') {
      return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    }

    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function getBadgeLabel(item, tcMap = fetchedTimecodes) {
    const badgeSource = String(runtimeProfile?.timeBadge?.source || 'epoch').trim().toLowerCase();
    const badgeFormat = String(runtimeProfile?.timeBadge?.format || 'HH:mm').trim();

    if (badgeSource === 'epoch') {
      const epochSeconds = getEpochSeconds(item);
      if (epochSeconds == null) return null;
      if (badgeFormat === 'HH:mm') return formatEpochHHmm(epochSeconds);
      return formatTimecode(epochSeconds);
    }

    if (badgeSource === 'hour_msb_middletime') {
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
      // Normale apertura modal
      dispatch("open", { index: getIndex(item), img: item, frame: item });
    }
  };
  function handleOpenVideoPlayer(e, item) {
    e.preventDefault();
    e.stopPropagation();
    const imgId = getId(item);
    const videoId = getVideoId(item);
    const startAt = getVideoPlayerStartFromProfile(item);
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
  $: allowFrameSubmit = showSubmitUI && String(challengeType ?? 'KIS').toUpperCase() !== 'Q&A';

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
    e.preventDefault();
    e.stopPropagation();
    try {
      const imgId = getId(item);
      const videoId = getVideoId(item);
      let timestamp = getVideoPlayerStartFromProfile(item);
      if (timestamp == null && imgId) {
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
      if (timestamp == null && imgId) {
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

  // ✅ Helper per generare header info
  function getRowInfo(row) {
    if (!row || row.length === 0) return null;
    const firstItem = row[0];
    const cacheKey = `${viewMode}::${firstItem?.imgId ?? firstItem?.index ?? "row"}::${row.length}`;
    if (rowInfoCache.has(cacheKey)) return rowInfoCache.get(cacheKey);
    
    let info = null;
    
    if (viewMode === "byvideo") {
      const videoId = getVideoId(firstItem);
      info = {
        type: 'video',
        label: `${videoId}`,
        item: firstItem
      };
      rowInfoCache.set(cacheKey, info);
      return info;
    }
    
    if (viewMode === "bydate") {
      const timestamp = firstItem.timestamp || firstItem.raw?.timestamp || 0;
      const date = timestamp ? new Date(timestamp * 1000) : new Date();
      
      info = {
        type: 'date',
        label: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        subtitle: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        item: firstItem
      };
      rowInfoCache.set(cacheKey, info);
      return info;
    }
    
    rowInfoCache.set(cacheKey, null);
    return null; // No header for byrank
  }

  function getEstimatedColumns(rowInfo) {
    if (!containerWidth || containerWidth <= 0) return 1;

    let minCardWidth = 140;
    if (typeof window !== 'undefined') {
      const rootStyles = getComputedStyle(document.documentElement);
      const cssMin = Number.parseFloat(rootStyles.getPropertyValue('--min-card-w'));
      if (Number.isFinite(cssMin) && cssMin > 0) minCardWidth = cssMin;
    }

    const gap = rowInfo?.type === 'video' ? 12 : 16;
    const horizontalPadding = rowInfo?.type === 'video'
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
    const labels = new Map();
    for (const row of items) {
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

  {#each visibleRows as { row, rowIndex } (row[0]?.imgId ?? row[0]?.index ?? rowIndex)}
    {@const rowInfo = getRowInfo(row)}
    
    <div
      use:measureRow={rowIndex}
      class="w-full {viewMode === 'byvideo' ? '' : rowIndex % 2 === 0 ? 'bg-gradient-to-r from-white to-gray-50' : 'bg-gradient-to-r from-gray-50 to-white'}"
    >
      
        <!-- ✅ ROW HEADER (solo per byvideo e bydate) -->
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
        class="flex flex-wrap w-full p-2.5 {shouldJustifyRow(row, rowInfo) ? 'justify-between' : ''} {rowInfo?.type === 'video' ? (rowIndex % 2 === 0 ? 'relative ml-2 mr-2.5 mb-1 border border-gray-300 border-l-2 border-l-gray-500 rounded-xl bg-gradient-to-b from-white to-gray-100 ring-1 ring-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_5px_14px_rgba(15,23,42,0.12)]' : 'relative ml-2 mr-2.5 mb-1 border border-gray-400/70 border-l-2 border-l-gray-600 rounded-xl bg-gradient-to-b from-gray-50 to-gray-200 ring-1 ring-gray-300/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_5px_14px_rgba(15,23,42,0.14)]') : ''} {rowInfo?.type === 'video' ? (videoBadgeOrientation === 'vertical' ? 'pt-2 pb-2 pl-8 pr-2' : 'pt-8 pb-2 px-2') : ''}"
        style={`gap: ${rowInfo?.type === 'video' ? '12px' : 'var(--grid-gap, 16px)'};`}
      >
        {#if rowInfo?.type === 'video' && videoBadgeOrientation === 'vertical'}
          <button
            on:click={(e) => handleOpenVideoPlayerFromStart(e, rowInfo.item)}
            class="ui-video-badge group/video absolute left-1.5 top-2 bottom-2 z-20 w-5 inline-flex flex-col items-center justify-center gap-1 rounded-md border border-slate-500/70 bg-gradient-to-b from-slate-700 to-slate-900 text-slate-50 hover:from-slate-600 hover:to-slate-800 ring-1 ring-white/10 shadow-[0_4px_10px_rgba(2,6,23,0.28)] transition-colors"
            title={`Open video ${rowInfo.label}`}
          >
            <svg class="w-2.5 h-2.5 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <span class="text-[10px] font-semibold leading-none [writing-mode:vertical-rl] rotate-180 tracking-[0.02em]">{rowInfo.label}</span>
          </button>
        {/if}

        {#if rowInfo?.type === 'video' && videoBadgeOrientation === 'horizontal'}
          <button
            on:click={(e) => handleOpenVideoPlayerFromStart(e, rowInfo.item)}
            class="ui-video-badge group/video absolute left-2 top-1.5 z-20 inline-flex items-center gap-1.5 rounded-md border border-slate-500/70 bg-gradient-to-r from-slate-700 to-slate-900 px-2.5 py-1 text-slate-50 hover:from-slate-600 hover:to-slate-800 ring-1 ring-white/10 shadow-[0_4px_10px_rgba(2,6,23,0.24)] transition-colors"
            title={`Open video ${rowInfo.label}`}
          >
            <svg class="w-3 h-3 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <span class="text-[11px] font-semibold leading-none tracking-[0.02em]">{rowInfo.label}</span>
          </button>
        {/if}

        {#each row as item (getId(item) ?? getIndex(item))}
          <div>
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
                        ? 'ring-8 ring-sky-500 shadow-lg shadow-sky-500/30'
                        : 'ring-2 ring-gray-200 hover:ring-blue-400 hover:shadow-md'}"
              style="height: var(--kf-size, 160px); min-width: var(--min-card-w, 140px);"
              title={isSelectionMode ? `✓ Click to select: ${getTitle(item)}` : getTitle(item)}
              role="button"
              tabindex="0"
              on:click={() => handleOpen(item)}
              on:keydown={(e) => e.key === 'Enter' && handleOpen(item)}
              on:contextmenu={(e) => !isSelectionMode && handleContextPreview(e, item)}
              on:dragstart={(e) => handleFrameDragStart(e, item)}
            >

              <!-- ✅ Badge in modalità selezione -->
              {#if isSelectionMode}
                <div class="absolute top-2 left-2 z-30 bg-green-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg flex items-center space-x-1.5 animate-pulse">
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
                        title="Video summary"
                        aria-label="Open video summary"
                        on:click={(e) => handleVideoSummary(item, e)}
                      >
                        <svg class="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                        </svg>
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
                    title="Submit"
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
                <div class="absolute top-0.5 left-0.5 z-30 inline-flex items-center px-1.5 py-0.5 rounded-md border border-slate-300/35 bg-slate-700/95 text-slate-100 text-[10px] font-semibold tracking-wide shadow-md pointer-events-none">
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
