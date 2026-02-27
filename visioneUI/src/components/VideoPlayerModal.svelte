<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { visioneAPI } from "../services/api.js";

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

    if (showSubmitUI && e.key?.toLowerCase() === "s") {
      e.preventDefault();
      submitCurrentFrame();
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
    }
  });

  function onLoaded() {
    if (!videoEl) return;
    try { 
      videoEl.currentTime = startTime ?? 0;
      videoDuration = videoEl.duration;
    } catch {}
    videoEl.play().catch(() => {});
    loadKeyframes();
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
      
      keyframes = await mapWithConcurrency(
        imgIds,
        KEYFRAME_TIMESTAMP_CONCURRENCY,
        async (imgId: string, index: number): Promise<Keyframe> => {
        try {
          const timestamp = await visioneAPI.getMiddleTimestamp(imgId);
          return {
            imgId: imgId,
            timestamp: timestamp,
            thumbnailUrl: `https://visione.isti.cnr.it/frames/tiny/${vid}/${imgId}.jpg`
          };
        } catch (err) {
          return {
            imgId: imgId,
            timestamp: (index / imgIds.length) * (videoDuration || 100),
            thumbnailUrl: `https://visione.isti.cnr.it/frames/tiny/${vid}/${imgId}.jpg`
          };
        }
      });

      if (currentToken !== keyframesLoadToken) return;
      keyframes.sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
      console.error("Failed to load keyframes:", err);
    } finally {
      if (currentToken === keyframesLoadToken) loadingKeyframes = false;
    }
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
    if (!showSubmitUI) return;
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
  <div class="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center">
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
          title="Close (Esc)"
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
          class="w-full h-auto max-h-[70vh]"
          controls
          autoplay
          playsinline
          preload="metadata"
          crossOrigin="anonymous"
          on:loadedmetadata={onLoaded}
        ></video>
        
        <!-- ✅ Overlay scuro (appare solo all'hover) -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-200 pointer-events-none z-10"></div>
      </div>


      <!-- Timeline -->
      <div class="px-4 py-3 bg-gray-800 rounded-b-xl border-t border-gray-700">
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
                  title="Click to jump to {getRankLabel(frame.imgId)}: {frame.imgId} at {formatTime(frame.timestamp)}"
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

          <!-- ✅ Time info + submit -->
          <div class="flex items-center justify-between gap-3 text-xs text-gray-400">
            <span class="font-mono">
              {videoEl ? formatTime(videoEl.currentTime) : '0:00'} / {formatTime(videoDuration)}
            </span>
            {#if showSubmitUI}
              <button
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-md transition-colors font-semibold"
                on:click={submitCurrentFrame}
                title="Submit current frame (S)"
                aria-label="Submit current frame (S)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 19V7M5 12l7-7 7 7"/>
                </svg>
                <span class="text-xs">Submit frame</span>
              </button>
            {/if}
          </div>

          <!-- ✅ Keyframes info + legenda -->
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
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  video::-webkit-media-controls-timeline {
    display: none;
  }
</style>
