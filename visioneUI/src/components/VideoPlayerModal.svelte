<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { focusTrap, tooltip } from "../utils/ui";
  import { visioneAPI } from "../services/api.js";
  import { tinyFrameUrl } from '$lib/urlConfig.js';

  type HighlightedInput = string | { imgId: string; rank?: number };
  type Keyframe = {
    imgId: string;
    timestamp: number;
    thumbnailUrl: string;
  };
  
  export let isOpen = false;
  export let videoUrl = "";
  export let startTime = 0;
  export let title = "";
  export let videoId = "";
  export let highlightedKeyframes: HighlightedInput[] = [];
  export let showSubmitUI = false;
  export let challengeType = "KIS";

  const dispatch = createEventDispatcher();
  let videoEl: HTMLVideoElement | null = null;
  let timelineContainer: HTMLDivElement | null = null;
  
  let keyframes: Keyframe[] = [];
  let loadingKeyframes = false;
  let hoveredTime: number | null = null;
  let hoveredKeyframe: Keyframe | null = null;
  let videoDuration = 0;
  let isScrolling = false;
  let scrollPreviewTimeout: ReturnType<typeof setTimeout> | undefined;
  let keyframesLoadToken = 0;
  const KEYFRAME_TIMESTAMP_CONCURRENCY = 8;
  const MAX_PRECISE_TIMESTAMP_FETCH = 120;
  const SAMPLED_PRECISE_POINTS = 48;

  // Advanced controls state
  const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2];
  let playbackSpeed = 1;
  let showSpeedMenu = false;
  let isVideoPaused = true;
  let keyframeStripEl: HTMLDivElement | null = null;
  const FRAME_STEP_SECONDS = 1 / 30; // ~1 frame at 30fps
  let frameStepInterval: ReturnType<typeof setInterval> | undefined;
  const FRAME_STEP_INITIAL_DELAY = 400; // ms before auto-repeat starts
  const FRAME_STEP_REPEAT_RATE = 80;    // ms between repeats

  function onKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === "Escape") {
      dispatch("close");
      return;
    }

    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    const isTypingContext =
      tagName === "input" ||
      tagName === "textarea" ||
      target?.isContentEditable;

    if (isTypingContext) return;

    if (allowFrameSubmit && e.key?.toLowerCase() === "s") {
      e.preventDefault();
      submitCurrentFrame();
    }

    // Frame-by-frame stepping (comma/period like YouTube/VLC)
    if (e.key === "," || e.key === ".") {
      e.preventDefault();
      if (videoEl && videoEl.paused) {
        stepFrame(e.key === "," ? -1 : 1);
      }
    }

    // Playback speed (< / > i.e. Shift+comma / Shift+period)
    if (e.key === "<") {
      e.preventDefault();
      cyclePlaybackSpeed(-1);
    }
    if (e.key === ">") {
      e.preventDefault();
      cyclePlaybackSpeed(1);
    }

    // Space to toggle play/pause
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlayPause();
    }
  }

  onMount(() => {
    if (typeof window !== "undefined")
      window.addEventListener("keydown", onKeyDown);
  });
  
  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", onKeyDown);
      if (scrollPreviewTimeout) clearTimeout(scrollPreviewTimeout);
      stopFrameStep();
    }
  });

  function onLoaded() {
    if (!videoEl) return;
    try { 
      videoEl.currentTime = startTime ?? 0;
      videoDuration = videoEl.duration;
      videoEl.playbackRate = playbackSpeed;
    } catch {}
    videoEl.play().catch(() => {});
    loadKeyframes();
  }

  function togglePlayPause() {
    if (!videoEl) return;
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  }

  function setPlaybackSpeed(speed: number) {
    playbackSpeed = speed;
    if (videoEl) videoEl.playbackRate = speed;
    showSpeedMenu = false;
  }

  function cyclePlaybackSpeed(direction: 1 | -1) {
    const currentIdx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIdx = Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIdx + direction));
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIdx]);
  }

  function stepFrame(direction: 1 | -1) {
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, Math.min(
      videoDuration || videoEl.duration,
      videoEl.currentTime + direction * FRAME_STEP_SECONDS
    ));
  }

  function startFrameStep(direction: 1 | -1) {
    if (!videoEl?.paused) return;
    stepFrame(direction);
    stopFrameStep();
    // Initial delay, then continuous repeat
    frameStepInterval = setTimeout(() => {
      frameStepInterval = setInterval(() => stepFrame(direction), FRAME_STEP_REPEAT_RATE);
    }, FRAME_STEP_INITIAL_DELAY) as unknown as ReturnType<typeof setInterval>;
  }

  function stopFrameStep() {
    if (frameStepInterval !== undefined) {
      clearTimeout(frameStepInterval);
      clearInterval(frameStepInterval);
      frameStepInterval = undefined;
    }
  }

  function captureFrameForSimilarity() {
    if (!videoEl) return;
    const w = videoEl.videoWidth || 0;
    const h = videoEl.videoHeight || 0;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(videoEl, 0, 0, w, h);
    } catch { return; }

    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    } catch { return; }

    const vid = deriveVideoId();
    const tsMs = Math.round((videoEl.currentTime || 0) * 1000);
    const imgId = `${vid}-T${tsMs}`;
    dispatch("captureForSimilarity", { imgId, videoId: vid, dataUrl, currentTime: videoEl.currentTime || 0 });
  }

  function scrollToActiveKeyframe() {
    if (!keyframeStripEl || !videoEl || keyframes.length === 0) return;
    const currentTime = videoEl.currentTime;
    const closest = keyframes.reduce((prev, curr) =>
      Math.abs(curr.timestamp - currentTime) < Math.abs(prev.timestamp - currentTime) ? curr : prev
    );
    const idx = keyframes.indexOf(closest);
    const thumbWidth = 72; // w-16 = 64px + 8px gap
    const scrollTarget = idx * thumbWidth - keyframeStripEl.clientWidth / 2 + thumbWidth / 2;
    keyframeStripEl.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  }

  async function mapWithConcurrency<T, R>(
    list: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    if (!Array.isArray(list) || list.length === 0) return [];
    const safeLimit = Math.max(1, Math.min(limit, list.length));
    const results = new Array<R>(list.length);
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

  async function loadKeyframes() {
    const vid = deriveVideoId();
    if (!vid) return;

    const currentToken = ++keyframesLoadToken;
    
    loadingKeyframes = true;
    try {
      const imgIds = await visioneAPI.getVideoKeyframes(vid);
      if (currentToken !== keyframesLoadToken) return;

      const fallbackDuration = Math.max(1, videoDuration || 100);
      const estimated = imgIds.map((imgId: string, index: number): Keyframe => ({
        imgId,
        timestamp: (index / Math.max(1, imgIds.length)) * fallbackDuration,
        thumbnailUrl: tinyFrameUrl(vid, imgId)
      }));

      // Show timeline immediately with estimated positions.
      keyframes = estimated;
      loadingKeyframes = false;

      const preciseCandidates = selectPreciseTimestampCandidates(imgIds);
      if (preciseCandidates.length === 0) return;

      const precisePairs = await mapWithConcurrency(
        preciseCandidates,
        KEYFRAME_TIMESTAMP_CONCURRENCY,
        async (imgId: string): Promise<[string, number | null]> => {
          try {
            const timestamp = await visioneAPI.getMiddleTimestamp(imgId);
            const parsed = Number(timestamp);
            return [imgId, Number.isFinite(parsed) ? parsed : null];
          } catch {
            return [imgId, null];
          }
        }
      );

      if (currentToken !== keyframesLoadToken) return;

      const preciseMap = new Map(
        precisePairs.filter(([, ts]) => ts != null) as Array<[string, number]>
      );

      if (preciseMap.size === 0) return;

      keyframes = estimated
        .map((frame) => ({
          ...frame,
          timestamp: preciseMap.get(frame.imgId) ?? frame.timestamp
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
      console.error("Failed to load keyframes:", err);
    } finally {
      if (currentToken === keyframesLoadToken) loadingKeyframes = false;
    }
  }

  function selectPreciseTimestampCandidates(imgIds: string[]): string[] {
    if (!Array.isArray(imgIds) || imgIds.length === 0) return [];
    if (imgIds.length <= MAX_PRECISE_TIMESTAMP_FETCH) return imgIds;

    const selected = new Set<string>();
    const highlighted = highlightedKeyframes
      .map((item) => (typeof item === 'string' ? item : item?.imgId))
      .filter((id): id is string => !!id);

    for (const id of highlighted) {
      if (imgIds.includes(id)) selected.add(id);
    }

    selected.add(imgIds[0]);
    selected.add(imgIds[imgIds.length - 1]);

    const stride = Math.max(1, Math.ceil(imgIds.length / SAMPLED_PRECISE_POINTS));
    for (let i = 0; i < imgIds.length; i += stride) {
      if (selected.size >= MAX_PRECISE_TIMESTAMP_FETCH) break;
      selected.add(imgIds[i]);
    }

    return Array.from(selected);
  }

  function deriveVideoId() {
    if (videoId) return String(videoId).padStart(5, "0");
    try {
      const file = videoUrl.split("/").pop() || "";
      const base = file.split("-")[0] || "";
      return String(base).padStart(5, "0");
    } catch { return ""; }
  }

  function handleTimelineHover(e: MouseEvent | WheelEvent) {
    if (!timelineContainer || !videoDuration || keyframes.length === 0) return;
    if (isScrolling) return;
    
    const rect = timelineContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    hoveredTime = percentage * videoDuration;
    const targetTime = hoveredTime;
    if (targetTime === null) return;
    
    hoveredKeyframe = keyframes.reduce((prev, curr) => 
      Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev
    );
  }

  function handleTimelineLeave() {
    if (!isScrolling) {
      hoveredTime = null;
      hoveredKeyframe = null;
    }
  }

  function handleTimelineClick(e: MouseEvent) {
    if (!timelineContainer || !videoDuration || !videoEl) return;
    
    const rect = timelineContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * videoDuration;
    
    const timeDiff = Math.abs(newTime - videoEl.currentTime);
    if (timeDiff < 5) {
      const steps = 10;
      const stepTime = 30;
      const increment = (newTime - videoEl.currentTime) / steps;
      
      for (let i = 0; i <= steps; i++) {
        setTimeout(() => {
          if (videoEl) videoEl.currentTime = videoEl.currentTime + increment;
        }, i * stepTime);
      }
    } else {
      videoEl.currentTime = newTime;
    }
  }

  // ✅ NUOVO: Salta al keyframe cliccato
  function jumpToKeyframe(timestamp: number) {
    if (!videoEl || !videoDuration) return;
    videoEl.currentTime = timestamp;
  }

  function handleWheel(e: WheelEvent) {
    if (!videoEl || !videoDuration || !timelineContainer) return;
    
    e.preventDefault();
    
    let delta;
    if (e.shiftKey) {
      delta = e.deltaY > 0 ? 1 : -1;
    } else if (e.ctrlKey || e.metaKey) {
      delta = e.deltaY > 0 ? 10 : -10;
    } else {
      delta = e.deltaY > 0 ? 5 : -5;
    }
    
    const newTime = Math.max(0, Math.min(videoDuration, videoEl.currentTime + delta));
    videoEl.currentTime = newTime;
    
    if (keyframes.length > 0) {
      isScrolling = true;
      hoveredTime = newTime;
      hoveredKeyframe = keyframes.reduce((prev, curr) => 
        Math.abs(curr.timestamp - newTime) < Math.abs(prev.timestamp - newTime) ? curr : prev
      );
      
      clearTimeout(scrollPreviewTimeout);
      const container = timelineContainer;
      scrollPreviewTimeout = setTimeout(() => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const isMouseOver = e.clientX >= rect.left && e.clientX <= rect.right && 
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        isScrolling = false;
        
        if (!isMouseOver) {
          hoveredTime = null;
          hoveredKeyframe = null;
        } else {
          handleTimelineHover(e);
        }
      }, 1200);
    }
  }

  function submitCurrentFrame() {
    if (!allowFrameSubmit) return;
    if (!videoEl) return;
    const w = videoEl.videoWidth || 0;
    const h = videoEl.videoHeight || 0;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(videoEl, 0, 0, w, h);
    } catch (err) {
      console.error("drawImage failed", err);
      return;
    }

    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    } catch (err) {
      console.error("toDataURL failed (CORS?)", err);
      dataUrl = "";
    }

    const vid = deriveVideoId();
    const tsMs = Math.round((videoEl.currentTime || 0) * 1000);
    const imgId = `${vid}-T${tsMs}`;
    dispatch("submitFrame", { imgId, videoId: vid, dataUrl, currentTime: videoEl.currentTime || 0 });
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  $: highlightedSet = new Set(highlightedKeyframes.map(k => 
    typeof k === 'string' ? k : k.imgId
  ));

  $: rankMap = new Map(
    highlightedKeyframes.map((item, index) => {
      const imgId = typeof item === 'string' ? item : item.imgId;
      const rank = typeof item === 'object' && item.rank !== undefined 
        ? item.rank 
        : index;
      return [imgId, rank];
    })
  );
  $: allowFrameSubmit = showSubmitUI && String(challengeType ?? 'KIS').toUpperCase() !== 'Q&A';

  function getRankColor(imgId: string) {
    if (!rankMap.has(imgId)) return 'rgb(107, 114, 128)';
    
    const rank = rankMap.get(imgId) ?? 0;
    const maxRank = Math.max(...Array.from(rankMap.values()));
    const normalized = maxRank > 0 ? rank / maxRank : 0;
    
    const colors = [
      { r: 233, g: 62,  b: 58  }, // #e93e3a
      { r: 237, g: 104, b: 60  }, // #ed683c
      { r: 243, g: 144, b: 63  }, // #f3903f
      { r: 253, g: 199, b: 12  }, // #fdc70c
      { r: 255, g: 243, b: 59  }  // #fff33b
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
  
  function getRankLabel(imgId: string) {
    if (!rankMap.has(imgId)) return '';
    const rank = rankMap.get(imgId) ?? 0;
    return `#${rank + 1}`;
  }
  
  function getRankCategory(imgId: string) {
    if (!rankMap.has(imgId)) return '';
    const rank = rankMap.get(imgId) ?? 0;
    const maxRank = Math.max(...Array.from(rankMap.values()));
    const normalized = maxRank > 0 ? rank / maxRank : 0;
    
    if (normalized < 0.33) return 'TOP';
    if (normalized < 0.66) return 'MID';
    return 'LOW';
  }

  function handleTimelineKeydown(e: KeyboardEvent) {
    if (!videoEl) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      videoEl.currentTime = Math.min(videoDuration || videoEl.duration || videoEl.currentTime, videoEl.currentTime + 5);
    }
  }

  function handlePreviewImageError(e: Event) {
    const target = e.currentTarget as HTMLImageElement | null;
    if (!target) return;
    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="96"%3E%3Crect fill="%23374151" width="160" height="96"/%3E%3Ctext x="80" y="48" text-anchor="middle" fill="white" font-size="12"%3ENo preview%3C/text%3E%3C/svg%3E';
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center">
    <button
      type="button"
      class="absolute inset-0"
      on:click={() => dispatch("close")}
      aria-label="Close video player modal"
    ></button>
    <div class="relative bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-[90vw]">
      
      <!-- Header -->
      <div class="px-4 py-3 bg-gray-800 rounded-t-xl border-b border-gray-700 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span class="text-sm font-medium text-white">{title}</span>
        </div>
        <button 
          class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          on:click={() => dispatch("close")}
          use:tooltip={{ text: 'Close', shortcut: 'Esc' }}
          aria-label="Close video player"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Video -->
      <div class="relative bg-black group">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          src={videoUrl}
          class="w-full h-auto max-h-[65vh] cursor-pointer"
          autoplay
          playsinline
          preload="metadata"
          crossOrigin="anonymous"
          on:loadedmetadata={onLoaded}
          on:play={() => isVideoPaused = false}
          on:pause={() => isVideoPaused = true}
          on:timeupdate={() => { isVideoPaused = videoEl?.paused ?? true; }}
          on:click={togglePlayPause}
        ></video>
        
        <!-- Overlay scuro (appare solo all'hover) -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-200 pointer-events-none z-10"></div>
      </div>


      <!-- Controls bar -->
      <div class="px-4 py-2 bg-gray-850 border-t border-gray-700 flex items-center gap-3">
        <!-- Play/Pause -->
        <button
          class="text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          on:click={togglePlayPause}
          use:tooltip={{ text: isVideoPaused ? 'Play' : 'Pause', shortcut: 'Space' }}
          aria-label={isVideoPaused ? 'Play' : 'Pause'}
        >
          {#if isVideoPaused}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          {:else}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {/if}
        </button>

        <!-- Frame step backward -->
        <span
          class="inline-flex {isVideoPaused ? '' : 'cursor-not-allowed'}"
          use:tooltip={{ text: 'Previous frame (pause first)', shortcut: ',' }}
        >
          <button
            class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700 {isVideoPaused ? '' : 'opacity-40 pointer-events-none'}"
            on:mousedown={() => startFrameStep(-1)}
            on:mouseup={stopFrameStep}
            on:mouseleave={stopFrameStep}
            aria-label="Step backward one frame"
            disabled={!isVideoPaused}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 20L9 12l10-8v16z"/><line x1="5" y1="4" x2="5" y2="20"/>
            </svg>
          </button>
        </span>

        <!-- Frame step forward -->
        <span
          class="inline-flex {isVideoPaused ? '' : 'cursor-not-allowed'}"
          use:tooltip={{ text: 'Next frame (pause first)', shortcut: '.' }}
        >
          <button
            class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700 {isVideoPaused ? '' : 'opacity-40 pointer-events-none'}"
            on:mousedown={() => startFrameStep(1)}
            on:mouseup={stopFrameStep}
            on:mouseleave={stopFrameStep}
            aria-label="Step forward one frame"
            disabled={!isVideoPaused}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 4l10 8-10 8V4z"/><line x1="19" y1="4" x2="19" y2="20"/>
            </svg>
          </button>
        </span>

        <div class="w-px h-5 bg-gray-600"></div>

        <!-- Playback speed -->
        <div class="relative">
          <button
            class="text-xs font-mono px-2 py-1 rounded transition-colors {playbackSpeed !== 1 ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50' : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
            on:click={() => showSpeedMenu = !showSpeedMenu}
            use:tooltip={{ text: 'Playback speed', shortcut: 'Shift+<' }}
            aria-label="Playback speed: {playbackSpeed}x"
          >
            {playbackSpeed}x
          </button>
          {#if showSpeedMenu}
            <div class="absolute bottom-full mb-1 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50 min-w-[72px]">
              {#each PLAYBACK_SPEEDS as speed}
                <button
                  class="block w-full text-left text-xs font-mono px-3 py-1.5 transition-colors {speed === playbackSpeed ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}"
                  on:click={() => setPlaybackSpeed(speed)}
                >
                  {speed}x
                </button>
              {/each}
            </div>
            <!-- Click-away to close speed menu -->
            <button
              class="fixed inset-0 z-40"
              on:click={() => showSpeedMenu = false}
              aria-label="Close speed menu"
            ></button>
          {/if}
        </div>

        <div class="w-px h-5 bg-gray-600"></div>

        <!-- Capture frame for similarity -->
        <button
          class="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          on:click={captureFrameForSimilarity}
          use:tooltip={{ text: 'Capture frame for similarity' }}
          aria-label="Capture frame for similarity"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 9h2M19 9h2M9 3v2M9 19v2M15 3v2M15 19v2M3 15h2M19 15h2"/>
          </svg>
          <span>Similarity</span>
        </button>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Time display -->
        <span class="text-xs font-mono text-gray-400">
          {videoEl ? formatTime(videoEl.currentTime) : '0:00'} / {formatTime(videoDuration)}
        </span>

        {#if allowFrameSubmit}
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-md transition-colors font-semibold text-xs"
            on:click={submitCurrentFrame}
            use:tooltip={{ text: 'Submit frame', shortcut: 'S', position: 'top' }}
            aria-label="Submit current frame"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 19V7M5 12l7-7 7 7"/>
            </svg>
            Submit
          </button>
        {/if}
      </div>

      <!-- Timeline -->
      <div class="px-4 py-3 bg-gray-800 border-t border-gray-700">
        <div class="space-y-2">
          <div 
            bind:this={timelineContainer}
            class="relative h-2 bg-gray-700 rounded-full cursor-pointer group hover:h-2.5 transition-all"
            on:mousemove={handleTimelineHover}
            on:mouseleave={handleTimelineLeave}
            on:click={handleTimelineClick}
            on:wheel={handleWheel}
            on:keydown={handleTimelineKeydown}
            role="slider"
            tabindex="0"
            aria-label="Video timeline"
            aria-valuemin="0"
            aria-valuemax={Math.max(0, Math.floor(videoDuration || 0))}
            aria-valuenow={Math.max(0, Math.floor(videoEl?.currentTime || 0))}
          >
            <!-- Progress -->
            {#if videoEl && videoDuration > 0}
              <div 
                class="absolute inset-y-0 left-0 bg-blue-600 rounded-full pointer-events-none transition-all duration-200"
                style="width: {(videoEl.currentTime / videoDuration * 100)}%"
              ></div>

            {/if}

            <!-- Hover preview -->
            {#if hoveredKeyframe && hoveredTime !== null}
              <div 
                class="absolute bottom-full mb-3 pointer-events-none z-50 transition-all duration-75"
                style="left: {(hoveredTime / videoDuration * 100)}%; transform: translateX(-50%);"
              >
                <div class="bg-gray-900 rounded-lg shadow-2xl border-2 overflow-hidden"
                     style="border-color: {getRankColor(hoveredKeyframe.imgId)}">
                  <div class="relative">
                    <img 
                      src={hoveredKeyframe.thumbnailUrl} 
                      alt="Preview"
                      class="w-40 h-24 object-cover"
                      on:error={handlePreviewImageError}
                    />
                    
                    {#if rankMap.has(hoveredKeyframe.imgId)}
                      <div 
                        class="absolute top-1 left-1 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg flex items-center space-x-1"
                        style="background-color: {getRankColor(hoveredKeyframe.imgId)}"
                      >
                        <span>{getRankLabel(hoveredKeyframe.imgId)}</span>
                        <span class="opacity-75">•</span>
                        <span>{getRankCategory(hoveredKeyframe.imgId)}</span>
                      </div>
                    {/if}
                    
                    <div class="absolute top-1 right-1 bg-black/70 rounded px-1.5 py-0.5 flex items-center space-x-0.5">
                      <svg class="w-3 h-3 text-blue-400 animate-bounce" style="animation-duration: 1.5s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M5 15l7-7 7 7"/>
                      </svg>
                      <svg class="w-3 h-3 text-blue-400 animate-bounce" style="animation-duration: 1.5s; animation-delay: 0.2s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div class="px-2 py-1 bg-gray-800">
                    <div class="text-center">
                      <span class="text-xs font-mono font-semibold text-white">{formatTime(hoveredTime)}</span>
                    </div>
                    <div class="text-[9px] text-gray-500 text-center mt-0.5 flex items-center justify-center space-x-2">
                      <span>Scroll: ±5s</span>
                      <span class="text-gray-600">|</span>
                      <span>Shift: ±1s</span>
                      <span class="text-gray-600">|</span>
                      <span>Ctrl: ±10s</span>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Current time indicator -->
            {#if videoEl && videoDuration > 0}
              <div 
                class="absolute inset-y-0 w-1 bg-white rounded-full shadow-lg pointer-events-none transition-all group-hover:scale-y-125"
                style="left: {(videoEl.currentTime / videoDuration * 100)}%"
              >
                <div class="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            {/if}

            <!-- ✅ Keyframe markers CLICCABILI -->
            {#each keyframes as frame}
              {#if rankMap.has(frame.imgId)}
                <!-- Keyframe evidenziato - CLICCABILE -->
                <button
                  class="absolute inset-y-0 w-1 rounded-full shadow-md transition-all hover:w-2 hover:scale-y-150 cursor-pointer z-10"
                  style="left: {(frame.timestamp / videoDuration * 100)}%; background-color: {getRankColor(frame.imgId)}"
                  use:tooltip={{ text: `Jump to ${getRankLabel(frame.imgId)} at ${formatTime(frame.timestamp)}`, position: 'top' }}
                  aria-label="Jump to keyframe {getRankLabel(frame.imgId)} at {formatTime(frame.timestamp)}"
                  on:click|stopPropagation={() => jumpToKeyframe(frame.timestamp)}
                ></button>
              {:else}
                <!-- Keyframe normale grigio -->
                <div 
                  class="absolute inset-y-0 w-px bg-gray-500/30 pointer-events-none"
                  style="left: {(frame.timestamp / videoDuration * 100)}%"
                ></div>
              {/if}
            {/each}
          </div>

          <!-- Keyframes info + legenda -->
          <div class="flex items-center justify-end gap-3 text-xs text-gray-400">
            <span class="text-[10px]">
              {loadingKeyframes ? 'Loading...' : `${keyframes.length} keyframes`}
            </span>
            {#if highlightedKeyframes.length > 0}
              <div class="flex items-center space-x-1.5 text-[10px]">
                <span class="text-gray-500">•</span>
                <span class="font-semibold">{highlightedKeyframes.length} in results:</span>
                <div class="w-2 h-2 rounded-full" style="background-color: rgb(233, 62, 58)" title="Best (Top ranked)"></div>
                <span style="color: rgb(237, 104, 60)">→</span>
                <div class="w-2 h-2 rounded-full" style="background-color: rgb(243, 144, 63)" title="Good (Mid ranked)"></div>
                <span style="color: rgb(253, 199, 12)">→</span>
                <div class="w-2 h-2 rounded-full" style="background-color: rgb(255, 243, 59)" title="Lower (Low ranked)"></div>
              </div>
            {/if}
          </div>

          <!-- Keyframe thumbnail strip -->
          {#if keyframes.length > 0}
            <div
              bind:this={keyframeStripEl}
              class="flex gap-1 overflow-x-auto py-1 scrollbar-thin"
              style="scrollbar-color: #4B5563 transparent;"
              on:wheel|preventDefault={(e) => {
                if (keyframeStripEl) keyframeStripEl.scrollLeft += e.deltaY;
              }}
            >
              {#each keyframes as frame}
                {@const isHighlighted = highlightedSet.has(frame.imgId)}
                {@const isActive = videoEl && Math.abs(frame.timestamp - (videoEl.currentTime ?? 0)) < (videoDuration / Math.max(1, keyframes.length) / 2)}
                <button
                  class="flex-shrink-0 rounded overflow-hidden border-2 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400
                    {isActive ? 'border-blue-500 ring-1 ring-blue-400/50' : isHighlighted ? 'border-opacity-80' : 'border-transparent opacity-60 hover:opacity-100'}"
                  style={isHighlighted && !isActive ? `border-color: ${getRankColor(frame.imgId)}` : ''}
                  on:click={() => jumpToKeyframe(frame.timestamp)}
                  title="{formatTime(frame.timestamp)}{isHighlighted ? ' — ' + getRankLabel(frame.imgId) : ''}"
                  aria-label="Jump to keyframe at {formatTime(frame.timestamp)}"
                >
                  <img
                    src={frame.thumbnailUrl}
                    alt="Keyframe at {formatTime(frame.timestamp)}"
                    class="w-16 h-10 object-cover"
                    loading="lazy"
                    on:error={handlePreviewImageError}
                  />
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  video::-webkit-media-controls-timeline {
    display: none;
  }
  .scrollbar-thin::-webkit-scrollbar {
    height: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #4B5563;
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #6B7280;
  }
</style>
