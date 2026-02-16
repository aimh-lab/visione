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
  export let isSelectionMode = false;
  export let virtualizeRows = true;
  export let virtualizeThreshold = 40;

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
    dispatch("openVideoPlayer", { img: item, imgId, videoId });
  }

  const handleVideoSummary = (item, e) => { e.stopPropagation(); dispatch("videoSummary", { img: item }); };
  const handleSimilarity = (item, e) => { e.stopPropagation(); dispatch("similarity", { imgId: getId(item), frame: item }); };
  const handleRFPositive = (item, e) => { e.stopPropagation(); dispatch("rfPositive", { index: getIndex(item), img: item }); };
  const handleRFNegative = (item, e) => { e.stopPropagation(); dispatch("rfNegative", { index: getIndex(item), img: item }); };
  const handleSubmit = (item, e) => { e.stopPropagation(); dispatch("submit", { index: getIndex(item), img: item }); };

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
    scrollTop = containerEl.scrollTop || 0;

    if (typeof ResizeObserver !== "undefined") {
      containerResizeObserver = new ResizeObserver(() => {
        viewportHeight = containerEl?.clientHeight || 0;
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
      const middle = await visioneAPI.getMiddleTimestamp(imgId);
      const start = Math.max(0, middle - 2);
      const end = middle + 2;
      preview = { imgId, videoUrl: visioneAPI.getVideoUrl(videoId, "medium"), start, end };
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
      const frameCount = row.length;
      info = {
        type: 'video',
        label: `Video ${videoId}`,
        subtitle: `${frameCount} keyframe${frameCount !== 1 ? 's' : ''}`,
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

  $: {
    if (rowInfoCache.size > 1000) rowInfoCache.clear();
  }

  $: if (items.length !== lastItemsLength) {
    if (items.length < lastItemsLength) {
      measuredRowHeights.clear();
      eagerImageIds.clear();
      eagerVersion += 1;
    }
    lastItemsLength = items.length;
    recomputeVirtualWindow();
  }

  $: {
    const threshold = Math.max(10, Number(virtualizeThreshold) || 40);
    virtualizationEnabled = !!virtualizeRows && items.length > threshold;
    recomputeVirtualWindow();
  }

  function sumHeights(start, end) {
    let total = 0;
    for (let i = start; i < end; i += 1) {
      total += measuredRowHeights.get(i) ?? FALLBACK_ROW_HEIGHT;
    }
    return total;
  }

  function findRowIndexAtOffset(offset) {
    const target = Math.max(0, offset);
    let acc = 0;
    for (let i = 0; i < items.length; i += 1) {
      const h = measuredRowHeights.get(i) ?? FALLBACK_ROW_HEIGHT;
      if (acc + h > target) return i;
      acc += h;
    }
    return Math.max(0, items.length - 1);
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
  });
</script>

<div bind:this={containerEl} class="h-full overflow-y-auto custom-scrollbar" on:scroll={handleScroll}>
  {#if topSpacer > 0}
    <div style={`height: ${topSpacer}px;`} aria-hidden="true"></div>
  {/if}

  {#each visibleRows as { row, rowIndex } (row[0]?.imgId ?? row[0]?.index ?? rowIndex)}
    {@const rowInfo = getRowInfo(row)}
    
    <div
      use:measureRow={rowIndex}
      class="w-full {rowIndex % 2 === 0 ? 'bg-gradient-to-r from-white to-gray-50' : 'bg-gradient-to-r from-gray-50 to-white'}"
    >
      
        <!-- ✅ ROW HEADER (solo per byvideo e bydate) -->
        {#if rowInfo}
          <div class="sticky top-0 z-30 px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-300 flex items-center justify-between shadow-sm">
            <div class="flex items-center space-x-3">
              <!-- Icon based on type -->
              {#if rowInfo.type === 'video'}
                <div class="p-1.5 bg-blue-100 rounded-lg">
                  <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <!-- Stile flat/moderno -->
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>

                </div>
                
                <!-- ✅ Video name CLICCABILE -->
                <button
                  on:click={(e) => handleVideoSummary(rowInfo.item, e)}
                  class="group/video flex items-center space-x-2 hover:bg-blue-50 px-2 py-1 -ml-2 rounded transition-colors"
                >
                  <h3 class="text-sm font-bold text-gray-800 group-hover/video:text-blue-600 transition-colors">
                    {rowInfo.label}
                  </h3>
                  <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {rowInfo.subtitle}
                  </span>
                  <!-- Freccia indica cliccabile -->
                  <svg class="w-4 h-4 text-gray-400 group-hover/video:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
                
              {:else if rowInfo.type === 'date'}
                <div class="p-1.5 bg-purple-100 rounded-lg">
                  <svg class="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
              {/if}
            </div>
          </div>
        {/if}

      
      <!-- Frames grid -->
      <div class="flex flex-wrap w-full p-3" style="gap: var(--grid-gap, 16px);">
        {#each row as item (getId(item) ?? getIndex(item))}
          <div>
            <div
              use:observeCardForPreload={item}
              data-index={getIndex(item)}
              data-img-id={getId(item)}
              data-frame-id={getId(item)}
              class="group relative rounded-xl overflow-hidden flex items-center justify-center
                    cursor-pointer transition-all duration-200 focus:outline-none
                    {isSelectionMode 
                      ? 'ring-4 ring-green-500 hover:ring-green-600 shadow-lg shadow-green-500/30 hover:scale-105' 
                      : isSelected(item) 
                        ? 'ring-8 ring-red-500 shadow-lg shadow-blue-500/30' 
                        : 'ring-2 ring-gray-200 hover:ring-blue-400 hover:shadow-md'}"
              style="height: var(--kf-size, 160px); min-width: var(--min-card-w, 140px);"
              title={isSelectionMode ? `✓ Click to select: ${getTitle(item)}` : getTitle(item)}
              role="button"
              tabindex="0"
              on:click={() => handleOpen(item)}
              on:keydown={(e) => e.key === 'Enter' && handleOpen(item)}
              on:contextmenu={(e) => !isSelectionMode && handleContextPreview(e, item)}
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

              <div class="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <!-- Barra bottom stile YouTube -->
                <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/75 backdrop-blur-md rounded-lg px-2 py-1.5 shadow-xl">
                  <!-- Left group: video actions -->
                  <div class="flex items-center space-x-1">
                    {#if showVideoSummary}
                      <button
                        class="p-1.5 hover:bg-white/20 rounded-md transition-colors"
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
                      class="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                      title="Play video"
                      aria-label="Play video"
                      on:click={(e) => handleOpenVideoPlayer(e, item)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>

                    <button
                      class="p-1.5 hover:bg-white/20 rounded-md transition-colors"
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
                      class="p-1.5 hover:bg-green-500/30 rounded-md transition-colors"
                      title="Positive feedback"
                      aria-label="Add positive feedback"
                      on:click={(e) => handleRFPositive(item, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-green-400" fill="currentColor">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                      </svg>
                    </button>

                    <button
                      class="p-1.5 hover:bg-red-500/30 rounded-md transition-colors"
                      title="Negative feedback"
                      aria-label="Add negative feedback"
                      on:click={(e) => handleRFNegative(item, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-red-400" fill="currentColor">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Submit button: top-right, solo se NON submitted -->
                {#if !item.submitted}
                  <div
                    role="button"
                    tabindex="0"
                    class="absolute top-2 right-2 p-2 bg-green-600/80 hover:bg-green-600 backdrop-blur-sm rounded-lg transition-all shadow-lg cursor-pointer"
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

              <SubmitBadge submitted={!!item.submitted} />

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
</style>
