<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { focusTrap } from "../utils/ui";
  import ResultsGrid from "./ResultsGrid.svelte";
  const ResultsGridAny = ResultsGrid as any;

  type Frame = { imgId?: string; videoId?: string; [key: string]: unknown };
  type PinnedSummary = {
    videoId: string;
    highlightImgId?: string | null;
    label?: string;
  };

  export let isOpen = false;
  export let loading = false;
  export let error: string | null = null;
  export let frames: Frame[] | null = null;
  export let videoId: string | null = null;

  export let pinnedSummaries: PinnedSummary[] = [];
  export let activePinnedSummaryKey = "";

  export let videoBadgeOrientation = "vertical";
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let runtimeProfile = {};
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let justifyResultRows = false;
  export let rfPositive: Frame[] = [];
  export let rfNegative: Frame[] = [];

  export let selectedFrameId: string | null = null;

  export let onClose = () => {};
  export let onPinCurrent = () => {};
  export let onOpenPinned = (_item: PinnedSummary) => {};
  export let onUnpinPinned = (_item: PinnedSummary) => {};

  export let onOpenFrame = (_frame: Frame) => {};
  export let onSimilarity = (_imgId: string, _img?: Frame | null) => {};
  export let addRFPositiveByImg = (_imgId: string, _img?: Frame | null) => {};
  export let addRFNegativeByImg = (_imgId: string, _img?: Frame | null) => {};
  export let submitByImgId = (_imgId: string, _img?: Frame | null) => {};
  export let openVideoPlayerBy = (_imgId: string, _videoId: string, _startAt?: number) => {};

  const summaryKey = (item: PinnedSummary) =>
    `${String(item?.videoId || "").trim()}::${String(item?.highlightImgId || "").trim()}`;

  $: framesAsRows = frames ? [frames] : [];
  $: hasFrames = (frames?.length ?? 0) > 0;

  const MIN_WIDTH = 820;
  const MIN_HEIGHT = 520;
  const EDGE_GAP = 8;

  let modalRect = { x: 40, y: 40, width: 1200, height: 760 };
  let hasInitializedRect = false;
  let isDragging = false;
  let isResizing = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;

  function clampRect(rect: { x: number; y: number; width: number; height: number }) {
    if (typeof window === 'undefined') return rect;
    const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - EDGE_GAP * 2);
    const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - EDGE_GAP * 2);
    const width = Math.max(MIN_WIDTH, Math.min(maxWidth, rect.width));
    const height = Math.max(MIN_HEIGHT, Math.min(maxHeight, rect.height));
    const x = Math.max(EDGE_GAP, Math.min(window.innerWidth - width - EDGE_GAP, rect.x));
    const y = Math.max(EDGE_GAP, Math.min(window.innerHeight - height - EDGE_GAP, rect.y));
    return { x, y, width, height };
  }

  function initializeRect() {
    if (typeof window === 'undefined') return;
    const width = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9));
    const height = Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.86));
    const x = Math.max(EDGE_GAP, Math.floor((window.innerWidth - width) / 2));
    const y = Math.max(EDGE_GAP, Math.floor((window.innerHeight - height) / 2));
    modalRect = clampRect({ x, y, width, height });
  }

  $: if (isOpen && !hasInitializedRect) {
    initializeRect();
    hasInitializedRect = true;
  }

  $: if (!isOpen && hasInitializedRect) {
    hasInitializedRect = false;
  }

  function startDrag(event: MouseEvent) {
    if (event.button !== 0) return;
    isDragging = true;
    dragOffsetX = event.clientX - modalRect.x;
    dragOffsetY = event.clientY - modalRect.y;
    event.preventDefault();
  }

  function startResize(event: MouseEvent) {
    if (event.button !== 0) return;
    isResizing = true;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    resizeStartWidth = modalRect.width;
    resizeStartHeight = modalRect.height;
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerMove(event: MouseEvent) {
    if (!isOpen) return;
    if (isDragging) {
      modalRect = clampRect({
        ...modalRect,
        x: event.clientX - dragOffsetX,
        y: event.clientY - dragOffsetY
      });
      return;
    }

    if (isResizing) {
      const nextWidth = resizeStartWidth + (event.clientX - resizeStartX);
      const nextHeight = resizeStartHeight + (event.clientY - resizeStartY);
      modalRect = clampRect({
        ...modalRect,
        width: nextWidth,
        height: nextHeight
      });
    }
  }

  function handlePointerUp() {
    isDragging = false;
    isResizing = false;
  }

  function handleWindowResize() {
    modalRect = clampRect(modalRect);
  }

  /* ── scroll-to-selected keyframe ── */
  let gridContainer: HTMLElement | null = null;
  let scrollTimerId: ReturnType<typeof setTimeout> | null = null;

  function registerGridContainer(el: HTMLElement) {
    gridContainer = el;
  }

  function clearPendingScroll() {
    if (scrollTimerId !== null) { clearTimeout(scrollTimerId); scrollTimerId = null; }
  }

  function scrollContainerToElement(container: HTMLElement, el: HTMLElement, smooth = true) {
    // Don't use scrollIntoView — it scrolls ALL ancestors including overflow:hidden
    // wrappers, which shifts the modal layout and causes wrong scroll positions.
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const elTop = eRect.top - cRect.top + container.scrollTop;
    const target = elTop - cRect.height / 2 + eRect.height / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "instant" });
  }

  function tryScrollToSelected() {
    clearPendingScroll();
    if (!gridContainer || !selectedFrameId) return;

    const base = String(selectedFrameId);

    function findEl(): HTMLElement | null {
      if (!gridContainer) return null;
      return gridContainer.querySelector(`[data-frame-id="${base}"], [data-img-id="${base}"]`) as HTMLElement | null;
    }

    const deadline = Date.now() + 9000;
    function attempt() {
      if (!gridContainer) return;
      const el = findEl();
      if (el) {
        scrollContainerToElement(gridContainer, el, false);
        // Refine after layout stabilizes (images loading, flex reflow)
        scrollTimerId = setTimeout(() => {
          const el2 = findEl();
          if (el2 && gridContainer) scrollContainerToElement(gridContainer, el2, true);
        }, 400);
        return;
      }
      if (Date.now() < deadline) {
        scrollTimerId = setTimeout(attempt, 80);
      }
    }
    attempt();
  }

  $: if (isOpen && selectedFrameId && frames?.length) {
    tick().then(() => requestAnimationFrame(() => tryScrollToSelected()));
  }

  onDestroy(() => {
    isDragging = false;
    isResizing = false;
    clearPendingScroll();
  });
</script>

<svelte:window on:mousemove={handlePointerMove} on:mouseup={handlePointerUp} on:resize={handleWindowResize} />

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class="fixed inset-0 z-[var(--z-modal-overlay)]">
    <button
      type="button"
      class="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      aria-label="Close video summary"
      on:click={onClose}
    ></button>

    <div
      class="video-summary-modal fixed z-[var(--z-modal-content)] overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-[0_24px_60px_rgba(2,6,23,0.65)] ring-1 ring-sky-500/30 flex flex-col animate-modal-in"
      style={`left:${modalRect.x}px; top:${modalRect.y}px; width:${modalRect.width}px; height:${modalRect.height}px;`}
    >
      <div
        class="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 cursor-move select-none"
        on:mousedown={startDrag}
      >
        <div class="min-w-0 flex items-start gap-2.5">
          <div class="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-sky-900/50 border border-sky-700/45 text-sky-200">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-slate-100 truncate">Video Summary</h3>
              <span class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-sky-700/40 bg-sky-900/25 text-sky-200">Modal</span>
            </div>
            <p class="text-[11px] text-slate-400 truncate">{videoId ? `Video ${videoId}` : 'Quick inspect mode'} · Drag header to move · ESC to close</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-amber-600/50 bg-amber-900/35 text-amber-200 hover:bg-amber-800/45 transition-colors"
            on:click={onPinCurrent}
            title="Pin this summary"
            aria-label="Pin this summary"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 5a3 3 0 0 1 6 0c0 1.37-.72 2.58-1.8 3.26l1.55 3.24h-5.5l1.55-3.24A3.93 3.93 0 0 1 9 5Z"/>
              <path d="M12 11.5v7.5"/>
              <path d="M10 15.5h4"/>
            </svg>
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-600/70 bg-slate-800/80 text-slate-200 hover:bg-slate-700 transition-colors"
            on:click={onClose}
            title="Close"
            aria-label="Close"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {#if pinnedSummaries.length > 0}
        <div class="px-4 py-2 border-b border-slate-700 bg-slate-900/85 flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pinned</span>
          {#each pinnedSummaries as item}
            <div
              class="inline-flex items-center rounded-md border text-slate-200 {summaryKey(item) === activePinnedSummaryKey
                ? 'border-sky-500/60 bg-sky-900/30 ring-1 ring-sky-500/40'
                : 'border-slate-600/70 bg-slate-800'}"
            >
              <button
                type="button"
                class="px-2 py-1 text-[11px] transition-colors rounded-l-md {summaryKey(item) === activePinnedSummaryKey
                  ? 'text-sky-100 font-semibold hover:bg-sky-800/35'
                  : 'hover:bg-slate-700'}"
                on:click={() => onOpenPinned(item)}
                title={`Open pinned summary ${item.videoId}`}
              >
                {item.label || item.videoId}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center w-6 h-6 border-l border-slate-600/70 text-slate-400 hover:text-red-300 hover:bg-red-900/25 transition-colors rounded-r-md"
                on:click={() => onUnpinPinned(item)}
                aria-label={`Unpin ${item.label || item.videoId}`}
                title="Unpin"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex-1 overflow-hidden bg-slate-900">
        {#if loading}
          <div class="h-full flex items-center justify-center text-slate-300 text-sm">Loading video summary…</div>
        {:else if error}
          <div class="h-full flex items-center justify-center px-6">
            <div class="rounded-lg border border-red-500/40 bg-red-900/20 text-red-200 px-4 py-3 text-sm">{error}</div>
          </div>
        {:else if !hasFrames}
          <div class="h-full flex items-center justify-center text-slate-400 text-sm">No keyframes available</div>
        {:else}
          <div class="h-full min-h-0 p-2 overflow-hidden">
            <svelte:component
              this={ResultsGridAny}
              items={framesAsRows}
              selectedId={selectedFrameId as any}
              layout="rows"
              showVideoSummary={false}
              {videoBadgeOrientation}
              {showSubmitUI}
              {challengeType}
              {runtimeProfile}
              {rfPositive}
              {rfNegative}
              {justifyResultRows}
              virtualizeRows={virtualizationEnabled}
              virtualizeThreshold={virtualizationThreshold}
              registerContainer={registerGridContainer}
              on:open={(e: any) => onOpenFrame(e.detail.frame)}
              on:openVideoPlayer={(e: any) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId ?? e.detail.img.videoId, e.detail.startAt)}
              on:similarity={(e: any) => {
                onClose();
                onSimilarity(e.detail.imgId, e.detail.frame ?? e.detail.img ?? null);
              }}
              on:rfPositive={(e: any) => addRFPositiveByImg(e.detail.img.imgId, e.detail.img)}
              on:rfNegative={(e: any) => addRFNegativeByImg(e.detail.img.imgId, e.detail.img)}
              on:submit={(e: any) => submitByImgId(e.detail.img.imgId, e.detail.img)}
            />
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-sm bg-slate-700/70 hover:bg-slate-600/90 border border-slate-500/70 cursor-se-resize"
        title="Resize"
        aria-label="Resize summary window"
        on:mousedown={startResize}
      >
        <svg class="w-3 h-3 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 16l8-8M12 20l8-8M16 20l4-4"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  :global(.video-summary-modal .custom-scrollbar) {
    overflow-y: scroll !important;
    scrollbar-gutter: stable;
    scrollbar-width: auto;
    scrollbar-color: rgba(96, 165, 250, 0.75) rgba(15, 23, 42, 0.45);
  }

  :global(.video-summary-modal .custom-scrollbar::-webkit-scrollbar) {
    width: 12px;
  }

  :global(.video-summary-modal .custom-scrollbar::-webkit-scrollbar-track) {
    background: rgba(15, 23, 42, 0.45);
  }

  :global(.video-summary-modal .custom-scrollbar::-webkit-scrollbar-thumb) {
    background: rgba(96, 165, 250, 0.75);
    border-radius: 7px;
  }

  :global(.video-summary-modal .custom-scrollbar::-webkit-scrollbar-thumb:hover) {
    background: rgba(59, 130, 246, 0.95);
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .animate-modal-in {
    animation: modal-in 0.16s ease-out;
  }
</style>
