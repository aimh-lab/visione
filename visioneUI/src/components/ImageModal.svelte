<script>
  import { createEventDispatcher } from "svelte";
  import { focusTrap } from "../utils/ui";
  import SubmitBadge from "./SubmitBadge.svelte";
  import { visioneAPI } from "../services/api";
  import { formatImageDisplayTitle } from "$lib/titleFormatting.js";
  
  export let isOpen = false;
  export let image = null;
  export let total = 0;
  export let modalScale = 100;
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let runtimeProfile = {};
  export let showLocalTimeInTitles = true;
  export let layer = "modal";
  export let isPinned = false;

  const dispatch = createEventDispatcher();
  const close = () => dispatch("close");
  const prev = () => dispatch("prev");
  const next = () => dispatch("next");
  const zoomIn = (e) => { e?.stopPropagation(); dispatch("adjustScale", { delta: 10 }); };
  const zoomOut = (e) => { e?.stopPropagation(); dispatch("adjustScale", { delta: -10 }); };

  // Action handlers
  const handleSubmit = (e) => { e?.stopPropagation(); dispatch("submit", { img: image }); };
  const handleVideoSummary = (e) => { e?.stopPropagation(); dispatch("videoSummary", { img: image }); };
  const handleSimilarity = (e) => { e?.stopPropagation(); dispatch("similarity", { imgId: image?.imgId, img: image }); };
  const handleRFPositive = (e) => { e?.stopPropagation(); dispatch("rfPositive", { img: image }); };
  const handleRFNegative = (e) => { e?.stopPropagation(); dispatch("rfNegative", { img: image }); };
  const handlePinImage = (e) => { e?.stopPropagation(); dispatch("pinImage", { img: image }); };
  const handleOpenVideoPlayer = (e) => {
    e?.stopPropagation();
    const videoId = image?.videoId ?? String(image?.imgId).split("-")[0];
    dispatch("openVideoPlayer", { imgId: image?.imgId, videoId });
  };

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseX = 0;
  let dragBaseY = 0;

  function isDragHandleTarget(target) {
    return !target?.closest?.("button, input, select, textarea, a, [role='button']");
  }

  function startDrag(event) {
    if (!isDragHandleTarget(event.target)) return;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragBaseX = dragOffsetX;
    dragBaseY = dragOffsetY;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (dragPointerId !== event.pointerId) return;
    dragOffsetX = dragBaseX + (event.clientX - dragStartX);
    dragOffsetY = dragBaseY + (event.clientY - dragStartY);
  }

  function endDrag(event) {
    if (dragPointerId !== event.pointerId) return;
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    dragPointerId = null;
  }

  $: currentIndex = image?.index ?? image?.idx ?? 0;
  $: modalTitle = image
    ? formatImageDisplayTitle(image, runtimeProfile, showLocalTimeInTitles)
    : "Frame Details";
  $: isQaChallenge = String(challengeType ?? 'KIS').toUpperCase() === 'Q&A';
  $: allowFrameSubmit = showSubmitUI;
  $: safeModalScale = Math.max(80, Math.round(Number(modalScale) || 160));
  // Give the preview column enough width to preserve target height similarly to slideshow sizing.
  $: shellWidthPx = Math.max(900, Math.round(safeModalScale * 2.8));
  $: shellHeightPx = Math.max(430, Math.round(safeModalScale + 260));
  $: modalWidth = `min(98vw, ${shellWidthPx}px)`;
  $: modalHeight = `min(96vh, ${shellHeightPx}px)`;
  $: previewHeight = `${safeModalScale}px`;
  $: overlayZClass = layer === "dialog" ? "z-[var(--z-dialog-overlay)]" : "z-[var(--z-modal-overlay)]";
  $: contentZClass = layer === "dialog" ? "z-[var(--z-dialog-content)]" : "z-[var(--z-modal-content)]";

  const METADATA_FIELDS_PER_REQUEST = 20;
  const imageMetadataCache = new Map();
  let metadataFields = [];
  let metadataValues = {};
  let metadataLoading = false;
  let metadataError = "";
  let metadataRequestToken = 0;
  let loadedMetadataImageId = "";
  let tuplePreviewUrls = new Map();
  let tuplePreviewRequestToken = 0;

  $: modalImageId = String(image?.imgId || "").trim();
  $: metadataEntries = buildMetadataEntries(metadataFields, metadataValues);
  $: tupleMembers = normalizeTupleItems(image?.tupleItems, tuplePreviewUrls);
  $: hasTupleMembers = tupleMembers.length > 1;

  $: if (!isOpen) {
    metadataLoading = false;
    metadataError = "";
    dragOffsetX = 0;
    dragOffsetY = 0;
    dragPointerId = null;
    tuplePreviewUrls = new Map();
  }

  $: if (isOpen && modalImageId && loadedMetadataImageId !== modalImageId) {
    void loadMetadataForImage(modalImageId);
  }

  $: if (isOpen && Array.isArray(image?.tupleItems) && image.tupleItems.length > 0) {
    void ensureTuplePreviewUrls(image.tupleItems);
  }
  
  let imageContainer;

  function uniqueStrings(values) {
    return Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    ));
  }

  function extractMetadataFieldsFromDiscovery(discoveryPayload) {
    const entries = Array.isArray(discoveryPayload) ? discoveryPayload : [discoveryPayload];
    const allFields = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const fields = Array.isArray(entry.metadata) ? entry.metadata : [];
      allFields.push(...fields);
    }

    return uniqueStrings(allFields);
  }

  async function ensureMetadataFields() {
    if (metadataFields.length > 0) return metadataFields;

    const discovery = await visioneAPI.discovery();
    metadataFields = extractMetadataFieldsFromDiscovery(discovery);
    return metadataFields;
  }

  function chunkList(values, size) {
    const out = [];
    for (let i = 0; i < values.length; i += size) {
      out.push(values.slice(i, i + size));
    }
    return out;
  }

  function normalizeMetadataValues(fields, payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const out = {};

    for (const field of fields) {
      out[field] = Object.prototype.hasOwnProperty.call(data, field) ? data[field] : null;
    }

    for (const [key, value] of Object.entries(data)) {
      if (!Object.prototype.hasOwnProperty.call(out, key)) {
        out[key] = value;
      }
    }

    return out;
  }

  function buildMetadataEntries(fields, values) {
    const orderedFields = Array.isArray(fields) ? fields : [];
    const map = values && typeof values === "object" ? values : {};
    const ordered = orderedFields.map((field) => ({ key: field, value: map[field] ?? null }));

    const extra = Object.keys(map)
      .filter((key) => !orderedFields.includes(key))
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, value: map[key] }));

    return [...ordered, ...extra];
  }

  function formatMetadataValue(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map((v) => String(v)).join(", ") : "-";
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function toSelectedFramesUrl(rawUrl) {
    const url = String(rawUrl || "").trim();
    return url;
  }

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatTupleTime(value) {
    const n = toNumberOrNull(value);
    if (n == null) return "-";
    const total = Math.max(0, n);
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function normalizeTupleItems(rawTupleItems, previewMap = new Map()) {
    const tuple = Array.isArray(rawTupleItems) ? rawTupleItems : [];
    return tuple.map((entry, idx) => {
      const metadata = entry && typeof entry.metadata === 'object' ? entry.metadata : {};
      const imgId = String(entry?.id || entry?.imgId || entry?.imageId || '').trim();
      const videoId = String(metadata?.hour_id || metadata?.video_id || metadata?.videoId || '').trim();
      const imageUrl = String(
        metadata?.images
        || entry?.imageUrl
        || entry?.url
        || previewMap.get(imgId)
        || metadata?.thumbnails
        || entry?.thumbnailUrl
        || ''
      ).trim();
      const selectedFrameUrl = toSelectedFramesUrl(imageUrl);
      const score = toNumberOrNull(entry?.score);
      const middleTime = toNumberOrNull(metadata?.hour_msb_middletime);

      return {
        index: idx,
        imgId,
        videoId,
        imageUrl: selectedFrameUrl,
        timecode: formatTupleTime(middleTime),
        score: score != null ? score.toFixed(4) : '-'
      };
    });
  }

  $: modalImageUrl = toSelectedFramesUrl(image?.url);

  async function ensureTuplePreviewUrls(rawTupleItems) {
    const tuple = Array.isArray(rawTupleItems) ? rawTupleItems : [];
    if (tuple.length === 0) return;

    const ids = Array.from(new Set(
      tuple
        .map((entry) => String(entry?.id || entry?.imgId || entry?.imageId || '').trim())
        .filter(Boolean)
    ));
    if (ids.length === 0) return;

    const missing = ids.filter((id) => !tuplePreviewUrls.has(id));
    if (missing.length === 0) return;

    const requestToken = ++tuplePreviewRequestToken;

    try {
      const rows = await visioneAPI.getElementUrlsBatch(missing, ['images']);
      if (requestToken !== tuplePreviewRequestToken) return;

      const next = new Map(tuplePreviewUrls);
      for (const row of Array.isArray(rows) ? rows : []) {
        const id = String(row?.id || '').trim();
        const imageUrl = String(row?.images || '').trim();
        if (!id || !imageUrl) continue;
        next.set(id, imageUrl);
      }
      tuplePreviewUrls = next;
    } catch {
      // Keep modal usable if tuple image URL enrichment fails.
    }
  }

  async function loadMetadataForImage(imgId) {
    const normalizedId = String(imgId || "").trim();
    if (!normalizedId) return;

    const requestToken = ++metadataRequestToken;
    metadataError = "";
    metadataLoading = true;

    try {
      const fields = await ensureMetadataFields();
      if (requestToken !== metadataRequestToken) return;

      if (fields.length === 0) {
        metadataValues = {};
        loadedMetadataImageId = normalizedId;
        metadataLoading = false;
        return;
      }

      const cached = imageMetadataCache.get(normalizedId);
      if (cached) {
        metadataValues = cached;
        loadedMetadataImageId = normalizedId;
        metadataLoading = false;
        return;
      }

      const chunks = chunkList(fields, METADATA_FIELDS_PER_REQUEST);
      const merged = {};

      for (const chunk of chunks) {
        const partial = await visioneAPI.getField(normalizedId, chunk);
        if (requestToken !== metadataRequestToken) return;
        if (partial && typeof partial === "object") {
          Object.assign(merged, partial);
        }
      }

      const normalizedValues = normalizeMetadataValues(fields, merged);
      imageMetadataCache.set(normalizedId, normalizedValues);
      metadataValues = normalizedValues;
      loadedMetadataImageId = normalizedId;
    } catch (error) {
      if (requestToken !== metadataRequestToken) return;
      metadataError = error?.message || "Unable to load metadata";
      metadataValues = {};
      loadedMetadataImageId = "";
    } finally {
      if (requestToken === metadataRequestToken) {
        metadataLoading = false;
      }
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class={`fixed inset-0 ${overlayZClass} flex items-start justify-center pt-10`}>
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/30"
      on:click={close}
      aria-label="Close image modal"
    ></button>

    <!-- Modal -->
    <div
      class={`ui-image-modal relative ${contentZClass} bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col`}
      style="width: {modalWidth}; height: {modalHeight}; transform: translate({dragOffsetX}px, {dragOffsetY}px);"
    >
      <!-- Header -->
      <div
        class="flex justify-between items-center border-b border-gray-200 px-6 py-4 bg-gradient-to-b from-gray-50 to-white cursor-move select-none touch-none"
        on:pointerdown={startDrag}
        on:pointermove={moveDrag}
        on:pointerup={endDrag}
        on:pointercancel={endDrag}
      >
        <div class="flex items-center space-x-4">
          <h3 class="text-xl font-bold text-gray-800">{modalTitle}</h3>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={zoomOut}
            class="ui-image-modal-btn w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-700 transition-colors"
            title="Decrease image size"
            aria-label="Decrease image size"
          >
            <svg class="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M5 12h14"/>
            </svg>
          </button>

          <button
            type="button"
            on:click={zoomIn}
            class="ui-image-modal-btn w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-700 transition-colors"
            title="Increase image size"
            aria-label="Increase image size"
          >
            <svg class="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>

          <button
            type="button"
            on:click={handlePinImage}
            class="inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed {isPinned ? 'border-amber-400/80 bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/45 hover:bg-amber-500/35' : 'border-amber-600/50 bg-amber-900/35 text-amber-200 hover:bg-amber-800/45 disabled:hover:bg-amber-900/35'}"
            title={isPinned ? "Unpin image" : "Pin image"}
            aria-label={isPinned ? "Unpin image" : "Pin image"}
            aria-pressed={isPinned}
            disabled={!image?.imgId}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 5a3 3 0 0 1 6 0c0 1.37-.72 2.58-1.8 3.26l1.55 3.24h-5.5l1.55-3.24A3.93 3.93 0 0 1 9 5Z"/>
              <path d="M12 11.5v7.5"/>
              <path d="M10 15.5h4"/>
            </svg>
          </button>

          <button 
            on:click={close} 
            class="ui-image-modal-close-btn p-1.5 rounded-md text-white shadow-md transition-all hover:scale-105 active:scale-95"
            aria-label="Close (ESC)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content: grid 2 colonne -->
      <div class="flex-grow overflow-auto grid items-start md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 p-6">
        <div class="space-y-2">
          <!-- Box immagine con overlay buttons (stile ResultsGrid) -->
          <div 
            bind:this={imageContainer}
            class="group relative bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden"
            style="min-height: {previewHeight};"
          >
          {#if modalImageUrl}
            <img 
              src={modalImageUrl}
              alt={modalTitle}
              class="block"
              style="height: {previewHeight}; width: auto; max-width: 100%; object-fit: contain;"
            />

            <!-- Overlay layer con trasparenza -->
            <div class="image-overlay absolute inset-0 z-10 transition-all duration-200 pointer-events-none"></div>

            <!-- Navigation arrows overlay (Instagram-style) -->
            <button
              on:click={prev}
              disabled={currentIndex === 0}
              class="ui-image-modal-nav-btn absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              title="Previous (←)"
              aria-label="Previous image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>

            <button
              on:click={next}
              disabled={currentIndex === total - 1}
              class="ui-image-modal-nav-btn absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              title="Next (→)"
              aria-label="Next image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            <!-- Overlay buttons (identici a ResultsGrid) -->
            <div class="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                  class="ui-image-modal-play-btn w-12 h-12 rounded-full shadow-xl flex items-center justify-center border ring-1 transition-transform duration-150 hover:scale-110 active:scale-95 pointer-events-auto"
                            style="--play-size: clamp(44px, calc(var(--kf-size, 160px) * 0.32), 96px); width: var(--play-size); height: var(--play-size);"
                  title="Play video"
                  aria-label="Play video"
                  on:click={handleOpenVideoPlayer}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    class="ui-image-modal-play-icon"
                              style="width: calc(var(--play-size) * 0.44); height: calc(var(--play-size) * 0.44);"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <!-- Barra bottom stile YouTube -->
              <div class="ui-image-modal-actionbar absolute bottom-1 left-3 right-3 flex items-center justify-between backdrop-blur-md rounded-lg px-3 py-2 shadow-xl">
                <!-- Left group: video actions -->
                <div class="flex items-center space-x-1.5">
                  <button
                    class="ui-image-modal-action-btn p-1.5 rounded-md transition-colors"
                    title="Context view"
                    aria-label="Open context view"
                    on:click={handleVideoSummary}
                  >
                    <img src="/icons/context-view.svg" alt="" class="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    class="ui-image-modal-action-btn p-1.5 rounded-md transition-colors"
                    title="Image similarity"
                    aria-label="Run image similarity"
                    on:click={handleSimilarity}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </button>
                </div>

                <!-- Right group: feedback actions -->
                <div class="flex items-center space-x-1.5">
                  <button
                    class="ui-image-modal-action-btn ui-image-modal-action-btn-positive p-1.5 rounded-md transition-colors"
                    title="Positive feedback"
                    aria-label="Add positive feedback"
                    on:click={handleRFPositive}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                  </button>

                  <button
                    class="ui-image-modal-action-btn ui-image-modal-action-btn-negative p-1.5 rounded-md transition-colors"
                    title="Negative feedback"
                    aria-label="Add negative feedback"
                    on:click={handleRFNegative}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Submit button: top-right, solo se NON submitted -->
              {#if allowFrameSubmit && !image?.submitted}
                <div
                  role="button"
                  tabindex="0"
                  class="ui-image-modal-submit-btn absolute top-3 right-3 p-2 backdrop-blur-sm rounded-lg transition-all shadow-lg cursor-pointer"
                    title={isQaChallenge ? 'Submit answer' : 'Submit'}
                    aria-label={isQaChallenge ? 'Submit answer' : 'Submit frame'}
                    on:click={handleSubmit}
                    on:keydown={(e) => e.key === 'Enter' && handleSubmit(e)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 19V7M5 12l7-7 7 7"/>
                  </svg>
                </div>
              {/if}
            </div>

            <!-- Submit badge (sempre visibile se submitted) -->
            {#if allowFrameSubmit}
              <SubmitBadge submitted={!!image?.submitted} verdict={image?.submissionVerdict} />
            {/if}

          {:else}
            <div class="text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-20 h-20 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
              <p class="text-lg font-semibold">Preview not available</p>
              <p class="text-sm mt-1">Frame #{currentIndex + 1}</p>
            </div>
          {/if}
          </div>

          <div class="px-1 text-sm text-gray-600">
            <span class="font-semibold text-gray-800">{currentIndex + 1} / {total}</span>
          </div>
        </div>
        
        <!-- Info column -->
        <div class="flex flex-col gap-4 min-h-0 h-full">
          {#if hasTupleMembers}
            <div>
              <h4 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Temporal Tuple</h4>
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <div class="max-h-56 overflow-auto divide-y divide-gray-100 bg-white">
                  {#each tupleMembers as member}
                    <div class="p-2.5 grid grid-cols-[56px_1fr] gap-2.5 items-start">
                      <div class="w-14 h-10 rounded bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                        {#if member.imageUrl}
                          <img src={member.imageUrl} alt={member.imgId || `Tuple ${member.index + 1}`} class="w-full h-full object-cover" />
                        {:else}
                          <span class="text-[10px] text-gray-400">N/A</span>
                        {/if}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-gray-800 truncate">#{member.index + 1} {member.imgId || '-'}</div>
                        <div class="text-[11px] text-gray-500 mt-0.5">video: {member.videoId || '-'} · t: {member.timecode} · score: {member.score}</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}

          <!-- Metadata -->
          <div class="flex-1 min-h-0 flex flex-col">

            {#if metadataLoading}
              <div class="border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Loading metadata...
              </div>
            {:else if metadataError}
              <div class="border border-red-200 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {metadataError}
              </div>
            {:else if metadataEntries.length === 0}
              <div class="border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                No metadata available for this frame.
              </div>
            {:else}
              <div class="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
                <div class="h-full overflow-auto divide-y divide-gray-100">
                  {#each metadataEntries as entry}
                    <div class="grid grid-cols-[minmax(0,150px)_1fr] gap-3 px-3 py-2 text-xs">
                      <div class="font-mono text-gray-500 break-all">{entry.key}</div>
                      <div class="text-gray-800 break-all">{formatMetadataValue(entry.value)}</div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
        <div class="text-sm text-gray-500 flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <kbd class="ui-image-modal-kbd px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">←</kbd>
            <kbd class="ui-image-modal-kbd px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">→</kbd>
            <span>Navigate</span>
          </div>
          <div class="flex items-center space-x-2">
            <kbd class="ui-image-modal-kbd px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">ESC</kbd>
            <span>Close</span>
          </div>
        </div>
        <button 
          on:click={close} 
          class="ui-image-modal-btn px-4 py-2 border border-gray-300 rounded-lg transition-colors font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if} 

<style>
  .image-overlay {
    background-color: rgba(0, 0, 0, 0);
    pointer-events: none;
    transition: background-color 0.2s ease;
  }
  
  .group:hover .image-overlay {
    background-color: rgba(0, 0, 0, 0.15);
  }
</style>
