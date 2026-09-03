<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { focusTrap, tooltip } from "../utils/ui";
  import { visioneAPI } from "../services/api.js";
  import { DEFAULT_DRES_CHALLENGE_TYPE } from "../config/dresConfig.js";

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
  export let challengeType = DEFAULT_DRES_CHALLENGE_TYPE;

  const dispatch = createEventDispatcher();
  let videoEl: HTMLVideoElement | null = null;
  let timelineContainer: HTMLDivElement | null = null;
  
  let keyframes: Keyframe[] = [];
  let loadingKeyframes = false;
  let hoveredTime: number | null = null;
  let hoveredKeyframe: Keyframe | null = null;
  let videoDuration = 0;
  let currentTime = 0;
  let isScrolling = false;
  let scrollPreviewTimeout: ReturnType<typeof setTimeout> | undefined;
  let keyframesLoadToken = 0;
  let pendingSeekSeconds: number | null = null;
  let pendingTimelineSeekPercent: number | null = null;
  let seekVerifyTimer: ReturnType<typeof setTimeout> | undefined;
  const KEYFRAME_ELEMENT_URL_CONCURRENCY = 6;

  // Advanced controls state
  const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4, 8, 16];
  const RANK_COLORS = [
    { r: 233, g: 62, b: 58 },
    { r: 237, g: 104, b: 60 },
    { r: 243, g: 144, b: 63 },
    { r: 253, g: 199, b: 12 },
    { r: 255, g: 243, b: 59 }
  ];
  let playbackSpeed = 1;
  let showSpeedMenu = false;
  let isVideoPaused = true;
  let keyframeStripEl: HTMLDivElement | null = null;
  const FRAME_STEP_SECONDS = 1 / 30; // ~1 frame at 30fps
  let frameStepInterval: ReturnType<typeof setInterval> | undefined;
  const FRAME_STEP_INITIAL_DELAY = 400; // ms before auto-repeat starts
  const FRAME_STEP_REPEAT_RATE = 80;    // ms between repeats
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseX = 0;
  let dragBaseY = 0;

  function isDragHandleTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    return !el?.closest?.("button, input, select, textarea, a, [role='button']");
  }

  function startDrag(event: PointerEvent) {
    if (!isDragHandleTarget(event.target)) return;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragBaseX = dragOffsetX;
    dragBaseY = dragOffsetY;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    dragOffsetX = dragBaseX + (event.clientX - dragStartX);
    dragOffsetY = dragBaseY + (event.clientY - dragStartY);
  }

  function endDrag(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    dragPointerId = null;
  }

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

    // Frame-by-frame stepping (comma/period, YouTube/VLC-style)
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
      if (seekVerifyTimer) clearTimeout(seekVerifyTimer);
      stopFrameStep();
    }
  });

  $: if (!isOpen) {
    dragOffsetX = 0;
    dragOffsetY = 0;
    dragPointerId = null;
  }

  function onLoaded() {
    if (!videoEl) return;
    try { 
      videoDuration = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
      videoEl.playbackRate = playbackSpeed;
      // Do not override a user click made before metadata was ready.
      if (pendingSeekSeconds == null && pendingTimelineSeekPercent == null) {
        seekVideoTo(startTime ?? 0, true);
      }
      currentTime = videoEl.currentTime || 0;
    } catch {}
    videoEl.play().catch(() => {});
    loadKeyframes();
    applyPendingSeek();
  }

  function onCanPlay() {
    if (!videoEl) return;
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      videoDuration = videoEl.duration;
    }
    applyPendingSeek();
  }

  function onDurationChange() {
    if (!videoEl) return;
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      videoDuration = videoEl.duration;
      applyPendingSeek();
    }
  }

  function getEffectiveDuration() {
    if (Number.isFinite(videoDuration) && videoDuration > 0) return videoDuration;
    if (Number.isFinite(videoEl?.duration) && (videoEl?.duration || 0) > 0) return Number(videoEl?.duration);
    return 0;
  }

  function seekVideoTo(seconds: number, allowDefer = true, verifyAttemptsLeft = 6) {
    if (!videoEl) return;
    const target = Number(seconds);
    if (!Number.isFinite(target) || target < 0) return;

    const duration = getEffectiveDuration();
    const clamped = duration > 0 ? Math.max(0, Math.min(target, duration)) : Math.max(0, target);

    try {
      videoEl.currentTime = clamped;
      currentTime = videoEl.currentTime || clamped || 0;
      pendingSeekSeconds = null;

      // Verify the seek actually stuck (some browsers/media states can ignore first seek).
      if (seekVerifyTimer) clearTimeout(seekVerifyTimer);
      if (verifyAttemptsLeft > 0) {
        seekVerifyTimer = setTimeout(() => {
          if (!videoEl) return;
          const actual = Number(videoEl.currentTime) || 0;
          if (Math.abs(actual - clamped) > 0.35) {
            seekVideoTo(clamped, true, verifyAttemptsLeft - 1);
          }
        }, 80);
      }
    } catch {
      if (allowDefer) {
        pendingSeekSeconds = clamped;
      }
    }
  }

  function applyPendingSeek() {
    if (pendingTimelineSeekPercent != null) {
      const duration = getEffectiveDuration();
      if (!duration) return;
      const percentage = Math.max(0, Math.min(1, pendingTimelineSeekPercent));
      pendingTimelineSeekPercent = null;
      seekVideoTo(percentage * duration, false);
      return;
    }

    if (pendingSeekSeconds != null) {
      const target = pendingSeekSeconds;
      pendingSeekSeconds = null;
      seekVideoTo(target, false);
    }
  }

  function onVideoTimeUpdate() {
    if (!videoEl) return;
    if (!videoDuration && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      videoDuration = videoEl.duration;
      applyPendingSeek();
    }
    currentTime = videoEl.currentTime || 0;
    isVideoPaused = videoEl.paused;
  }

  function togglePlayPause() {
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      dispatch('playerAction', { action: 'play', currentTime: videoEl.currentTime || 0 });
    } else {
      videoEl.pause();
      dispatch('playerAction', { action: 'pause', currentTime: videoEl.currentTime || 0 });
    }
  }

  function setPlaybackSpeed(speed: number) {
    playbackSpeed = speed;
    if (videoEl) videoEl.playbackRate = speed;
    dispatch('playerAction', { action: 'speedChange', playbackRate: speed, currentTime: videoEl?.currentTime || 0 });
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
    currentTime = videoEl.currentTime || 0;
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
      // getVideoKeyframes returns Array<{ imgId, timestamp }> where timestamp is video-relative seconds.
      const entries = await visioneAPI.getVideoKeyframes(vid);
      if (currentToken !== keyframesLoadToken) return;

      const fallbackDuration = Math.max(1, videoDuration || 100);

      const initial: Keyframe[] = entries.map((entry: { imgId: string; timestamp: number | null }, index: number) => ({
        imgId: entry.imgId,
        timestamp: entry.timestamp != null
          ? entry.timestamp
          : (index / Math.max(1, entries.length)) * fallbackDuration,
        thumbnailUrl: ''
      }));

      // Show timeline immediately with positions from epochs.
      keyframes = initial;
      loadingKeyframes = false;

      // Resolve thumbnail/image URLs from dataserver-aware URL builder.
      const imgIds = entries.map((e: { imgId: string }) => e.imgId);
      const urlRows = await visioneAPI.getElementUrlsBatch(imgIds, ['images', 'thumbnails']);

      if (currentToken !== keyframesLoadToken) return;

      const thumbnailMap = new Map(
        (Array.isArray(urlRows) ? urlRows : [])
          .map((row): [string, string | null] => [
            String(row?.id || ''),
            String(row?.thumbnails || row?.images || '').trim() || null
          ])
          .filter(([id, url]) => !!id && !!url) as Array<[string, string]>
      );

      keyframes = initial.map((frame) => ({
        ...frame,
        thumbnailUrl: thumbnailMap.get(frame.imgId) || frame.thumbnailUrl
      }));
    } catch (err) {
      console.error("Failed to load keyframes:", err);
    } finally {
      if (currentToken === keyframesLoadToken) loadingKeyframes = false;
    }
  }

  function deriveVideoId() {
    if (videoId) {
      return String(videoId);
    }
    try {
      const file = videoUrl.split("/").pop() || "";
      if (!file) return '';
      return String(file);
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
    if (!timelineContainer || !videoEl) return;
    
    const rect = timelineContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const duration = getEffectiveDuration();
    if (!duration) {
      pendingTimelineSeekPercent = percentage;
      return;
    }

    const targetTime = percentage * duration;
    seekVideoTo(targetTime, false);
    dispatch('playerAction', {
      action: 'seekTimeline',
      targetTime,
      currentTime: videoEl.currentTime || targetTime
    });
  }

  // Salta al keyframe cliccato
  function jumpToKeyframe(timestamp: number) {
    seekVideoTo(timestamp);
    dispatch('playerAction', {
      action: 'seekKeyframe',
      targetTime: timestamp,
      currentTime: videoEl?.currentTime || timestamp
    });
  }

  function handleWheel(e: WheelEvent) {
    if (!videoEl || !timelineContainer) return;

    const duration = getEffectiveDuration();
    if (!duration) return;
    
    e.preventDefault();
    
    let delta;
    if (e.shiftKey) {
      delta = e.deltaY > 0 ? 1 : -1;
    } else if (e.ctrlKey || e.metaKey) {
      delta = e.deltaY > 0 ? 10 : -10;
    } else {
      delta = e.deltaY > 0 ? 5 : -5;
    }
    
    const newTime = Math.max(0, Math.min(duration, videoEl.currentTime + delta));
    seekVideoTo(newTime, false);
    dispatch('playerAction', {
      action: 'seekWheel',
      targetTime: newTime,
      currentTime: videoEl.currentTime || newTime
    });
    
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
  $: isQaChallenge = String(challengeType ?? 'KIS').toUpperCase() === 'Q&A';
  $: allowFrameSubmit = showSubmitUI;

  function getRankColor(imgId: string) {
    if (!rankMap.has(imgId)) return 'rgb(107, 114, 128)';
    
    const rank = rankMap.get(imgId) ?? 0;
    const maxRank = Math.max(...Array.from(rankMap.values()));
    const normalized = maxRank > 0 ? rank / maxRank : 0;
    
    const position = normalized * (RANK_COLORS.length - 1);
    const index = Math.floor(position);
    const t = position - index;
    
    if (index >= RANK_COLORS.length - 1) {
      const c = RANK_COLORS[RANK_COLORS.length - 1];
      return `rgb(${c.r}, ${c.g}, ${c.b})`;
    }
    
    const c1 = RANK_COLORS[index];
    const c2 = RANK_COLORS[index + 1];
    
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getRankPaletteColor(index: number) {
    const c = RANK_COLORS[Math.max(0, Math.min(RANK_COLORS.length - 1, index))];
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
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
  <div use:focusTrap class="ui-video-player-overlay fixed inset-0 z-[var(--z-modal-overlay)] bg-black/80 flex items-center justify-center">
    <button
      type="button"
      class="absolute inset-0"
      on:click={() => dispatch("close")}
      aria-label="Close video player modal"
    ></button>
    <div class="ui-video-player-modal relative z-[var(--z-modal-content)] bg-gray-900 rounded-xl shadow-2xl max-w-6xl w-[90vw]" style="transform: translate({dragOffsetX}px, {dragOffsetY}px);">
      
      <!-- Header -->
      <div
        class="ui-video-player-header px-4 py-3 bg-gray-800 rounded-t-xl border-b border-gray-700 flex items-center justify-between cursor-move select-none touch-none"
        on:pointerdown={startDrag}
        on:pointermove={moveDrag}
        on:pointerup={endDrag}
        on:pointercancel={endDrag}
      >
        <div class="flex items-center space-x-3">
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span class="text-sm font-medium text-white">{title}</span>
        </div>
        <button 
          class="ui-video-player-control-btn text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
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
      <div class="ui-video-player-stage relative bg-black group">
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
          on:canplay={onCanPlay}
          on:durationchange={onDurationChange}
          on:play={onVideoTimeUpdate}
          on:pause={onVideoTimeUpdate}
          on:timeupdate={onVideoTimeUpdate}
          on:click={togglePlayPause}
        ></video>
        
        <!-- Overlay scuro (appare solo all'hover) -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-200 pointer-events-none z-10"></div>
      </div>


      <!-- Controls bar -->
      <div class="ui-video-player-controls px-4 py-2 bg-gray-850 border-t border-gray-700 flex items-center gap-3">
        <!-- Play/Pause -->
        <button
          class="ui-video-player-control-btn text-gray-300 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
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
            class="ui-video-player-control-btn text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700 {isVideoPaused ? '' : 'opacity-40 pointer-events-none'}"
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
            class="ui-video-player-control-btn text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700 {isVideoPaused ? '' : 'opacity-40 pointer-events-none'}"
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

        <div class="ui-video-player-divider w-px h-5 bg-gray-600"></div>

        <!-- Playback speed -->
        <div class="relative">
          <button
            class="text-xs font-mono px-2 py-1 rounded transition-colors {playbackSpeed !== 1 ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50' : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
            on:click={() => showSpeedMenu = !showSpeedMenu}
            use:tooltip={{ text: 'Playback speed', shortcut: 'Shift+<', enabled: !showSpeedMenu }}
            aria-label="Playback speed: {playbackSpeed}x"
          >
            {playbackSpeed}x
          </button>
          {#if showSpeedMenu}
            <div class="ui-video-player-speed-menu absolute bottom-full mb-1 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50 min-w-[72px]">
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

        <div class="ui-video-player-divider w-px h-5 bg-gray-600"></div>

        <!-- Capture frame for similarity -->
        <button
          class="ui-video-player-control-btn inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
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
          {formatTime(currentTime)} / {formatTime(videoDuration)}
        </span>

        {#if allowFrameSubmit}
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-md transition-colors font-semibold text-xs"
            on:click={submitCurrentFrame}
            use:tooltip={{ text: 'Submit frame', shortcut: 'S', position: 'top' }}
            aria-label={isQaChallenge ? 'Submit answer' : 'Submit current frame'}
            title={isQaChallenge ? 'Submit answer' : 'Submit frame'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 19V7M5 12l7-7 7 7"/>
            </svg>
            Submit
          </button>
        {/if}
      </div>

      <!-- Timeline -->
      <div class="ui-video-player-timeline-panel px-4 py-3 bg-gray-800 border-t border-gray-700">
        <div class="space-y-2">
          <div 
            bind:this={timelineContainer}
            class="ui-video-player-timeline relative h-2 bg-slate-800 ring-1 ring-slate-600/70 rounded-full cursor-pointer group hover:h-2.5 transition-all"
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
            aria-valuenow={Math.max(0, Math.floor(currentTime || 0))}
          >
            <!-- Progress -->
            {#if videoDuration > 0}
              <div 
                class="absolute inset-y-0 left-0 bg-cyan-400 rounded-full pointer-events-none transition-all duration-200 shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                style="width: {(currentTime / videoDuration * 100)}%"
              ></div>

            {/if}

            <!-- Hover preview -->
            {#if hoveredKeyframe && hoveredTime !== null}
              <div 
                class="absolute bottom-full mb-3 pointer-events-none z-50 transition-all duration-75"
                style="left: {(hoveredTime / videoDuration * 100)}%; transform: translateX(-50%);"
              >
                <div class="ui-video-player-preview bg-gray-900 rounded-lg shadow-2xl border-2 overflow-hidden"
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
                  
                  <div class="ui-video-player-preview-strip px-2 py-1 bg-gray-800">
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
            {#if videoDuration > 0}
              <div 
                class="absolute inset-y-0 w-1 bg-white rounded-full shadow-lg pointer-events-none transition-all group-hover:scale-y-125"
                style="left: {(currentTime / videoDuration * 100)}%"
              >
                <div class="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            {/if}

            <!-- Keyframe markers cliccabili -->
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
                <div class="w-2 h-2 rounded-full" style="background-color: {getRankPaletteColor(0)}" title="Best (Top ranked)"></div>
                <span style="color: {getRankPaletteColor(1)}">→</span>
                <div class="w-2 h-2 rounded-full" style="background-color: {getRankPaletteColor(2)}" title="Good (Mid ranked)"></div>
                <span style="color: {getRankPaletteColor(3)}">→</span>
                <div class="w-2 h-2 rounded-full" style="background-color: {getRankPaletteColor(4)}" title="Lower (Low ranked)"></div>
              </div>
            {/if}
          </div>

          <!-- Keyframe thumbnail strip -->
          {#if keyframes.length > 0}
            <div
              bind:this={keyframeStripEl}
              class="flex gap-1 overflow-x-auto py-1 scrollbar-thin"
              style="scrollbar-color: var(--ui-scrollbar-thumb) transparent;"
              on:wheel|preventDefault={(e) => {
                if (keyframeStripEl) keyframeStripEl.scrollLeft += e.deltaY;
              }}
            >
              {#each keyframes as frame}
                {@const isHighlighted = highlightedSet.has(frame.imgId)}
                {@const isActive = Math.abs(frame.timestamp - currentTime) < (videoDuration / Math.max(1, keyframes.length) / 2)}
                <button
                  class="flex-shrink-0 rounded overflow-hidden border-2 transition-all duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400
                    {isActive ? 'border-blue-500 ring-1 ring-blue-400/50' : isHighlighted ? 'border-opacity-80' : 'border-transparent opacity-60 hover:opacity-100'}"
                  style={isHighlighted && !isActive ? `border-color: ${getRankColor(frame.imgId)}` : ''}
                  on:click|stopPropagation={(e) => {
                    e.preventDefault();
                    jumpToKeyframe(frame.timestamp);
                  }}
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
  .ui-video-player-overlay {
    background: var(--ui-video-player-overlay-bg);
  }

  .ui-video-player-modal {
    background: var(--ui-video-player-bg);
  }

  .ui-video-player-header,
  .ui-video-player-timeline-panel,
  .ui-video-player-speed-menu,
  .ui-video-player-preview-strip {
    background: var(--ui-video-player-panel-bg);
    border-color: var(--ui-video-player-border);
  }

  .ui-video-player-header {
    background: var(--ui-video-player-header-bg);
  }

  .ui-video-player-stage {
    background: var(--ui-video-player-stage-bg);
  }

  .ui-video-player-controls {
    background: var(--ui-video-player-controls-bg);
    border-color: var(--ui-video-player-border);
  }

  .ui-video-player-control-btn {
    color: var(--ui-video-player-button-muted);
  }

  .ui-video-player-control-btn:hover {
    background: var(--ui-video-player-button-hover-bg);
    color: var(--ui-toast-text);
  }

  .ui-video-player-divider {
    background: var(--ui-video-player-divider);
  }

  .ui-video-player-speed-menu {
    border-color: var(--ui-video-player-menu-border);
  }

  .ui-video-player-timeline {
    background: var(--ui-video-player-timeline-bg);
    box-shadow: 0 0 0 1px var(--ui-video-player-timeline-ring);
  }

  .ui-video-player-preview {
    background: var(--ui-video-player-preview-bg);
  }

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
    background: var(--ui-scrollbar-thumb);
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: var(--ui-scrollbar-thumb-hover);
  }
</style>
