<script>
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { focusTrap } from "../utils/ui";
  import { visioneAPI } from "../services/api.js";
  import { tinyFrameUrl } from "$lib/urlConfig.js";

  export let isOpen = false;
  export let videoId = "";
  export let selectedImgId = "";
  export let title = "";
  export let modalScale = 100;
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let highlightedKeyframes = [];

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = "";
  let frames = [];
  let currentIndex = 0;
  let loadToken = 0;
  let loadedVideoId = "";
  let isAutoPlaying = true;
  let autoPlayInterval = null;
  let autoPlayDelayMs = 300;
  let timelineContainer = null;
  let keyframeStripEl = null;
  let hoveredIndex = null;
  let hoveredFrame = null;

  const KEYFRAME_ELEMENT_URL_CONCURRENCY = 6;
  const SLIDESHOW_SPEED_OPTIONS = [50, 100, 200, 300, 400];

  function normalizeVideoId(value) {
    return String(value || "");
  }

  function formatSeconds(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    const total = Math.floor(numeric);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getRankColor(imgId) {
    if (!rankMap.has(imgId)) return "rgb(107, 114, 128)";

    const rank = rankMap.get(imgId) ?? 0;
    const maxRank = Math.max(0, ...Array.from(rankMap.values()));
    const normalized = maxRank > 0 ? rank / maxRank : 0;

    const colors = [
      { r: 233, g: 62, b: 58 },
      { r: 237, g: 104, b: 60 },
      { r: 243, g: 144, b: 63 },
      { r: 253, g: 199, b: 12 },
      { r: 255, g: 243, b: 59 }
    ];

    const position = normalized * (colors.length - 1);
    const index = Math.floor(position);
    const t = position - index;

    if (index >= colors.length - 1) {
      const c = colors[colors.length - 1];
      return `rgb(${c.r}, ${c.g}, ${c.b})`;
    }

    const c1 = colors[index];
    const c2 = colors[index + 1];
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getRankLabel(imgId) {
    if (!rankMap.has(imgId)) return "";
    const rank = rankMap.get(imgId) ?? 0;
    return `#${rank + 1}`;
  }

  function getRankCategory(imgId) {
    if (!rankMap.has(imgId)) return "";
    const rank = rankMap.get(imgId) ?? 0;
    const maxRank = Math.max(0, ...Array.from(rankMap.values()));
    const normalized = maxRank > 0 ? rank / maxRank : 0;
    if (normalized < 0.33) return "TOP";
    if (normalized < 0.66) return "MID";
    return "LOW";
  }

  async function mapWithConcurrency(list, limit, worker) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const safeLimit = Math.max(1, Math.min(limit, list.length));
    const results = new Array(list.length);
    let cursor = 0;

    async function runWorker() {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(list[index], index);
      }
    }

    const workers = Array.from({ length: safeLimit }, () => runWorker());
    await Promise.all(workers);
    return results;
  }

  function sortKeyframes(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return [...safeEntries].sort((a, b) => {
      const aTs = Number(a?.timestamp);
      const bTs = Number(b?.timestamp);
      const aValid = Number.isFinite(aTs) && aTs >= 0;
      const bValid = Number.isFinite(bTs) && bTs >= 0;

      if (aValid && bValid && aTs !== bTs) return aTs - bTs;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;

      return String(a?.imgId || "").localeCompare(String(b?.imgId || ""));
    });
  }

  async function loadFramesForVideo(rawVideoId, preferredImgId) {
    const normalizedVideoId = normalizeVideoId(rawVideoId);
    if (!normalizedVideoId) return;

    const token = ++loadToken;
    loading = true;
    error = "";

    try {
      const entries = await visioneAPI.getVideoKeyframes(normalizedVideoId);
      if (token !== loadToken) return;

      const sortedEntries = sortKeyframes(entries)
        .filter((entry) => String(entry?.imgId || ""))
        .map((entry) => ({
          imgId: String(entry.imgId),
          timestamp: Number.isFinite(Number(entry?.timestamp)) && Number(entry?.timestamp) >= 0
            ? Number(entry.timestamp)
            : null
        }));

      if (sortedEntries.length === 0) {
        frames = [];
        currentIndex = 0;
        error = "No keyframes available for this video.";
        loadedVideoId = normalizedVideoId;
        return;
      }

      const initialFrames = sortedEntries.map((entry) => ({
        ...entry,
        thumbnailUrl: visioneAPI.getThumbnailUrlByImgId(entry.imgId, normalizedVideoId) || tinyFrameUrl(normalizedVideoId, entry.imgId),
        imageUrl: visioneAPI.getThumbnailUrlByImgId(entry.imgId, normalizedVideoId) || tinyFrameUrl(normalizedVideoId, entry.imgId)
      }));

      frames = initialFrames;
      loadedVideoId = normalizedVideoId;

      const targetImgId = String(preferredImgId || "");
      const startIndex = targetImgId
        ? initialFrames.findIndex((frame) => frame.imgId === targetImgId)
        : -1;
      currentIndex = startIndex >= 0 ? startIndex : 0;

      const imgIds = initialFrames.map((frame) => frame.imgId);
      const urlRows = await visioneAPI.getElementUrlsBatch(imgIds, ["images", "thumbnails"]);

      if (token !== loadToken) return;

      const imageMap = new Map(
        (Array.isArray(urlRows) ? urlRows : [])
          .map((row) => {
            const id = String(row?.id || "").trim();
            if (!id) return null;
            const resolvedImage = String(row?.images || row?.thumbnails || "").trim() || null;
            const resolvedThumbnail = String(row?.thumbnails || row?.images || "").trim() || null;
            return [id, { imageUrl: resolvedImage, thumbnailUrl: resolvedThumbnail }];
          })
          .filter(Boolean)
      );
      frames = initialFrames.map((frame) => ({
        ...frame,
        imageUrl: imageMap.get(frame.imgId)?.imageUrl || frame.imageUrl,
        thumbnailUrl: imageMap.get(frame.imgId)?.thumbnailUrl || frame.thumbnailUrl
      }));
    } catch (e) {
      if (token !== loadToken) return;
      frames = [];
      currentIndex = 0;
      error = String(e?.message || "Failed to load keyframes.");
      loadedVideoId = normalizedVideoId;
    } finally {
      if (token === loadToken) loading = false;
    }
  }

  function move(offset, reason = "step") {
    if (!frames.length) return;
    currentIndex = (currentIndex + offset + frames.length) % frames.length;
    const frame = frames[currentIndex] || null;
    dispatch("playerAction", {
      action: reason,
      currentIndex,
      imgId: frame?.imgId || "",
      timestamp: frame?.timestamp
    });
  }

  function jumpToIndex(index, reason = "seek") {
    if (!frames.length) return;
    const safe = Math.max(0, Math.min(frames.length - 1, Number(index) || 0));
    if (safe === currentIndex) return;
    currentIndex = safe;
    const frame = frames[currentIndex] || null;
    dispatch("playerAction", {
      action: reason,
      currentIndex,
      imgId: frame?.imgId || "",
      timestamp: frame?.timestamp
    });
  }

  function stopAutoPlay() {
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }

  function startAutoPlay() {
    if (!isOpen || !isAutoPlaying || loading || frames.length <= 1) return;
    if (autoPlayInterval) return;

    autoPlayInterval = setInterval(() => {
      move(1, "autoplay");
    }, autoPlayDelayMs);
  }

  function setAutoPlayDelay(value) {
    const numeric = Number(value);
    if (!SLIDESHOW_SPEED_OPTIONS.includes(numeric)) return;
    autoPlayDelayMs = numeric;

    if (autoPlayInterval) {
      stopAutoPlay();
      startAutoPlay();
    }

    dispatch("playerAction", {
      action: "speedChange",
      intervalMs: autoPlayDelayMs,
      currentIndex,
      imgId: activeFrame?.imgId || "",
      timestamp: activeFrame?.timestamp
    });
  }

  function toggleAutoPlay() {
    isAutoPlaying = !isAutoPlaying;
    dispatch("playerAction", {
      action: isAutoPlaying ? "play" : "pause",
      currentIndex,
      imgId: activeFrame?.imgId || "",
      timestamp: activeFrame?.timestamp
    });
  }

  function handleTimelineHover(event) {
    if (!timelineContainer || frames.length === 0) return;
    const rect = timelineContainer.getBoundingClientRect();
    if (!rect.width) return;

    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * Math.max(0, frames.length - 1));
    hoveredIndex = idx;
    hoveredFrame = frames[idx] || null;
  }

  function handleTimelineLeave() {
    hoveredIndex = null;
    hoveredFrame = null;
  }

  function handleTimelineClick(event) {
    if (!timelineContainer || frames.length === 0) return;
    const rect = timelineContainer.getBoundingClientRect();
    if (!rect.width) return;

    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * Math.max(0, frames.length - 1));
    jumpToIndex(idx, "seekTimeline");
  }

  function handleTimelineKeydown(event) {
    if (!frames.length) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1, "seekTimeline");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1, "seekTimeline");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      jumpToIndex(0, "seekTimeline");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      jumpToIndex(frames.length - 1, "seekTimeline");
    }
  }

  function scrollToActiveKeyframe() {
    if (!keyframeStripEl || !frames.length) return;
    const active = keyframeStripEl.querySelector(`[data-kf-index="${currentIndex}"]`);
    if (!active) return;

    const el = active;
    const left = el.offsetLeft - keyframeStripEl.clientWidth / 2 + el.clientWidth / 2;
    keyframeStripEl.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }

  function captureFrameForSimilarity() {
    if (!activeFrame) return;
    dispatch("captureForSimilarity", {
      imgId: activeFrame.imgId,
      videoId: normalizedVideoId,
      currentIndex,
      currentTime: Number(activeFrame.timestamp || 0)
    });
  }

  function submitCurrentFrame() {
    if (!allowFrameSubmit || !activeFrame) return;
    dispatch("submitFrame", {
      imgId: activeFrame.imgId,
      videoId: normalizedVideoId,
      dataUrl: activeFrame.imageUrl || "",
      currentTime: Number(activeFrame.timestamp || 0)
    });
  }

  function close() {
    dispatch("close");
  }

  function onKeyDown(event) {
    if (!isOpen) return;

    const target = event.target;
    const tagName = String(target?.tagName || "").toLowerCase();
    const isTypingContext = tagName === "input" || tagName === "textarea" || target?.isContentEditable;
    if (isTypingContext) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1, "prev");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1, "next");
      return;
    }

    if (event.key === " " || event.key?.toLowerCase() === "k") {
      event.preventDefault();
      toggleAutoPlay();
      return;
    }

    if (allowFrameSubmit && event.key?.toLowerCase() === "s") {
      event.preventDefault();
      submitCurrentFrame();
    }
  }

  $: normalizedVideoId = normalizeVideoId(videoId);
  $: normalizedSelectedImgId = String(selectedImgId || "");
  $: activeFrame = frames[currentIndex] || null;
  $: resolvedTitle = String(title || "").trim() || (normalizedVideoId ? `Keyframe Slideshow - ${normalizedVideoId}` : "Keyframe Slideshow");
  $: allowFrameSubmit = showSubmitUI && String(challengeType ?? "KIS").toUpperCase() !== "Q&A";
  $: safeModalScale = Math.min(160, Math.max(80, Number(modalScale) || 100));
  $: modalWidth = `min(98vw, max(42rem, calc(72rem * ${safeModalScale / 100})))`;
  $: modalHeight = `min(98vh, max(34rem, calc(82vh * ${safeModalScale / 100})))`;
  $: timelineProgress = frames.length > 1 ? (currentIndex / (frames.length - 1)) * 100 : 0;
  $: highlightedSet = new Set((Array.isArray(highlightedKeyframes) ? highlightedKeyframes : []).map((entry) => typeof entry === "string" ? entry : entry?.imgId).filter(Boolean));
  $: rankMap = new Map(
    (Array.isArray(highlightedKeyframes) ? highlightedKeyframes : []).map((entry, index) => {
      const imgId = typeof entry === "string" ? entry : entry?.imgId;
      const rank = typeof entry === "object" && Number.isFinite(Number(entry?.rank)) ? Number(entry.rank) : index;
      return [imgId, rank];
    }).filter(([imgId]) => !!imgId)
  );

  $: if (!isOpen) {
    loadToken += 1;
    loading = false;
    error = "";
    frames = [];
    currentIndex = 0;
    loadedVideoId = "";
    isAutoPlaying = true;
    stopAutoPlay();
  }

  $: if (isOpen && normalizedVideoId && loadedVideoId !== normalizedVideoId) {
    void loadFramesForVideo(normalizedVideoId, normalizedSelectedImgId);
  }

  $: if (isOpen && normalizedVideoId && loadedVideoId === normalizedVideoId && normalizedSelectedImgId && frames.length > 0) {
    const nextIndex = frames.findIndex((frame) => frame.imgId === normalizedSelectedImgId);
    if (nextIndex >= 0) currentIndex = nextIndex;
  }

  $: if (isOpen && frames.length > 0) {
    tick().then(() => scrollToActiveKeyframe());
  }

  $: shouldAutoPlay = isOpen && isAutoPlaying && !loading && frames.length > 1;

  $: if (shouldAutoPlay && !autoPlayInterval) {
    startAutoPlay();
  }

  $: if (!shouldAutoPlay && autoPlayInterval) {
    stopAutoPlay();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeyDown);
  }

  onDestroy(() => {
    stopAutoPlay();
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", onKeyDown);
    }
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 bg-black/60"
      on:click={close}
      aria-label="Close keyframe slideshow"
    ></button>

    <div
      class="relative z-[1001] w-full bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col"
      style="width: {modalWidth}; height: {modalHeight};"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/80">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-slate-100 truncate">{resolvedTitle}</h3>
          <p class="text-xs text-slate-400">Use left/right arrows to navigate keyframes</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          on:click={close}
          aria-label="Close slideshow"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="flex-1 min-h-0 bg-slate-950 relative">
        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">Loading keyframes...</div>
        {:else if error}
          <div class="absolute inset-0 flex items-center justify-center px-6">
            <div class="rounded-lg border border-red-500/50 bg-red-900/20 text-red-200 text-sm px-4 py-3">{error}</div>
          </div>
        {:else if activeFrame}
          <div
            class="absolute inset-0 flex items-center justify-center p-4 md:p-6 cursor-pointer"
            on:click={toggleAutoPlay}
            aria-label="Toggle slideshow play/pause"
            role="button"
            tabindex="0"
            on:keydown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleAutoPlay();
              }
            }}
          >
            <img src={activeFrame.imageUrl} alt={activeFrame.imgId} class="max-w-full max-h-full object-contain rounded-md" />
          </div>

          <button
            type="button"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border border-slate-600 bg-black/50 text-slate-100 hover:bg-black/70"
            on:click={() => move(-1, 'prev')}
            aria-label="Previous keyframe"
          >
            <svg class="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border border-slate-600 bg-black/50 text-slate-100 hover:bg-black/70"
            on:click={() => move(1, 'next')}
            aria-label="Next keyframe"
          >
            <svg class="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        {:else}
          <div class="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No keyframes to display.</div>
        {/if}
      </div>

      <div class="px-4 py-2 bg-gray-850 border-t border-gray-700 flex items-center gap-3">
        <button
          class="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          on:click={toggleAutoPlay}
          aria-label={isAutoPlaying ? 'Pause slideshow' : 'Play slideshow'}
        >
          {#if isAutoPlaying}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {:else}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          {/if}
        </button>

        <button
          class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          on:click={() => move(-1, 'prev')}
          aria-label="Previous keyframe"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 20L9 12l10-8v16z"/><line x1="5" y1="4" x2="5" y2="20"/>
          </svg>
        </button>

        <button
          class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          on:click={() => move(1, 'next')}
          aria-label="Next keyframe"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 4l10 8-10 8V4z"/><line x1="19" y1="4" x2="19" y2="20"/>
          </svg>
        </button>

        <div class="w-px h-5 bg-gray-600"></div>

        <div class="flex items-center gap-1.5">
          <label for="slideshow-speed" class="text-[11px] text-gray-500">Speed</label>
          <select
            id="slideshow-speed"
            class="text-xs bg-slate-800 text-slate-200 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            bind:value={autoPlayDelayMs}
            on:change={(e) => setAutoPlayDelay(e.currentTarget.value)}
            aria-label="Slideshow speed in milliseconds per frame"
          >
            {#each SLIDESHOW_SPEED_OPTIONS as speedMs}
              <option value={speedMs}>{speedMs} ms</option>
            {/each}
          </select>
        </div>

        <button
          class="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          on:click={captureFrameForSimilarity}
          aria-label="Capture frame for similarity"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 9h2M19 9h2M9 3v2M9 19v2M15 3v2M15 19v2M3 15h2M19 15h2"/>
          </svg>
          <span>Similarity</span>
        </button>

        <div class="flex-1"></div>

        <span class="text-xs font-mono text-gray-400">
          {#if activeFrame}
            {currentIndex + 1} / {frames.length}
            {#if formatSeconds(activeFrame.timestamp)}
              · {formatSeconds(activeFrame.timestamp)}
            {/if}
          {:else}
            0 / 0
          {/if}
        </span>

        {#if allowFrameSubmit}
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-md transition-colors font-semibold text-xs"
            on:click={submitCurrentFrame}
            aria-label="Submit current frame"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 19V7M5 12l7-7 7 7"/>
            </svg>
            Submit
          </button>
        {/if}
      </div>

      <div class="px-4 py-3 bg-gray-800 border-t border-gray-700">
        <div class="space-y-2">
          <div
            bind:this={timelineContainer}
            class="relative h-2 bg-slate-800 ring-1 ring-slate-600/70 rounded-full cursor-pointer group hover:h-2.5 transition-all"
            on:mousemove={handleTimelineHover}
            on:mouseleave={handleTimelineLeave}
            on:click={handleTimelineClick}
            on:keydown={handleTimelineKeydown}
            role="slider"
            tabindex="0"
            aria-label="Slideshow timeline"
            aria-valuemin="0"
            aria-valuemax={Math.max(0, frames.length - 1)}
            aria-valuenow={Math.max(0, currentIndex)}
          >
            <div
              class="absolute inset-y-0 left-0 bg-cyan-400 rounded-full pointer-events-none transition-all duration-150 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
              style="width: {timelineProgress}%"
            ></div>

            {#if frames.length > 0}
              <div class="absolute inset-0 pointer-events-none">
                {#each frames as frame, idx}
                  {#if highlightedSet.has(frame.imgId)}
                    <span
                      class="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-black/40"
                      style="left: {(idx / Math.max(1, frames.length - 1)) * 100}%; background-color: {getRankColor(frame.imgId)}; transform: translate(-50%, -50%);"
                      aria-hidden="true"
                    ></span>
                  {/if}
                {/each}
              </div>
            {/if}

            {#if hoveredFrame && hoveredIndex !== null}
              <div
                class="absolute bottom-full mb-3 pointer-events-none z-50"
                style="left: {(Math.max(0, Math.min(frames.length - 1, hoveredIndex)) / Math.max(1, frames.length - 1)) * 100}%; transform: translateX(-50%);"
              >
                <div class="bg-gray-900 rounded-lg shadow-2xl border border-slate-600 overflow-hidden">
                  <img
                    src={hoveredFrame.thumbnailUrl || hoveredFrame.imageUrl}
                    alt="Timeline preview"
                    class="w-40 h-24 object-cover"
                  />
                  <div class="px-2 py-1 text-[11px] text-slate-200 flex items-center justify-between gap-2">
                    <span>{hoveredFrame.imgId}</span>
                    <span>{formatSeconds(hoveredFrame.timestamp) || '--:--'}</span>
                  </div>
                  {#if highlightedSet.has(hoveredFrame.imgId)}
                    <div class="px-2 pb-2 text-[10px] font-semibold flex items-center gap-1" style="color: {getRankColor(hoveredFrame.imgId)};">
                      <span>{getRankLabel(hoveredFrame.imgId)}</span>
                      <span>•</span>
                      <span>{getRankCategory(hoveredFrame.imgId)}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <div
            bind:this={keyframeStripEl}
            class="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600/70 scrollbar-track-slate-800/50"
          >
            <div class="flex items-center gap-2 min-w-max py-1">
              {#each frames as frame, idx}
                <button
                  type="button"
                  class="relative group shrink-0 rounded border transition-all {idx === currentIndex ? 'border-cyan-400 ring-2 ring-cyan-400/40' : (highlightedSet.has(frame.imgId) ? 'hover:opacity-95' : 'border-slate-700 hover:border-slate-500')}"
                  style={highlightedSet.has(frame.imgId) && idx !== currentIndex ? `border-color: ${getRankColor(frame.imgId)}; box-shadow: 0 0 0 1px ${getRankColor(frame.imgId)}55;` : undefined}
                  data-kf-index={idx}
                  on:click={() => jumpToIndex(idx, 'seekKeyframe')}
                  aria-label={`Go to keyframe ${idx + 1}`}
                >
                  <img
                    src={frame.thumbnailUrl || frame.imageUrl}
                    alt={frame.imgId}
                    class="w-20 h-12 object-cover rounded"
                    loading="lazy"
                  />
                  <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap">
                    {formatSeconds(frame.timestamp) || `#${idx + 1}`}
                  </span>

                  {#if highlightedSet.has(frame.imgId)}
                    <span
                      class="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow"
                      style="background-color: {getRankColor(frame.imgId)}; color: #0b1020;"
                    >
                      {getRankLabel(frame.imgId)}
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
