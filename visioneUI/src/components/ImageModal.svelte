<script>
  import { createEventDispatcher } from "svelte";
  import { focusTrap } from "../utils/ui";
  import SubmitBadge from "./SubmitBadge.svelte";
  import { visioneAPI } from "../services/api";
  
  export let isOpen = false;
  export let image = null;
  export let total = 0;
  export let showSubmitUI = false;
  export let challengeType = "KIS";

  const dispatch = createEventDispatcher();
  const close = () => dispatch("close");
  const prev = () => dispatch("prev");
  const next = () => dispatch("next");

  // Handler per le azioni
  const handleSubmit = (e) => { e?.stopPropagation(); dispatch("submit", { img: image }); };
  const handleVideoSummary = (e) => { e?.stopPropagation(); dispatch("videoSummary", { img: image }); };
  const handleSimilarity = (e) => { e?.stopPropagation(); dispatch("similarity", { imgId: image?.imgId, img: image }); };
  const handleRFPositive = (e) => { e?.stopPropagation(); dispatch("rfPositive", { img: image }); };
  const handleRFNegative = (e) => { e?.stopPropagation(); dispatch("rfNegative", { img: image }); };
  const handleOpenVideoPlayer = (e) => {
    e?.stopPropagation();
    const videoId = image?.videoId ?? String(image?.imgId).split("-")[0];
    dispatch("openVideoPlayer", { imgId: image?.imgId, videoId });
  };

  $: currentIndex = image?.index ?? image?.idx ?? 0;
  $: allowFrameSubmit = showSubmitUI && String(challengeType ?? 'KIS').toUpperCase() !== 'Q&A';

  const METADATA_FIELDS_PER_REQUEST = 20;
  const imageMetadataCache = new Map();
  let metadataFields = [];
  let metadataValues = {};
  let metadataLoading = false;
  let metadataError = "";
  let metadataRequestToken = 0;
  let loadedMetadataImageId = "";

  $: modalImageId = String(image?.imgId || "").trim();
  $: metadataEntries = buildMetadataEntries(metadataFields, metadataValues);

  $: if (!isOpen) {
    metadataLoading = false;
    metadataError = "";
  }

  $: if (isOpen && modalImageId && loadedMetadataImageId !== modalImageId) {
    void loadMetadataForImage(modalImageId);
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
  <div use:focusTrap class="fixed inset-0 z-[1000] flex items-start justify-center pt-10">
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/30"
      on:click={close}
      aria-label="Close image modal"
    ></button>

    <!-- Modal -->
    <div 
      class="relative z-[1001] bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-gray-200 px-6 py-4 bg-gradient-to-b from-gray-50 to-white">
        <div class="flex items-center space-x-4">
          <h3 class="text-xl font-bold text-gray-800">{image?.title ?? "Frame Details"}</h3>
        </div>
        
        <button 
          on:click={close} 
          class="p-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 shadow-md transition-all hover:scale-105 active:scale-95"
          aria-label="Close (ESC)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content: grid 2 colonne -->
      <div class="flex-grow overflow-auto grid md:grid-cols-2 gap-6 p-6">
        <!-- ✅ Box immagine con overlay buttons (stile ResultsGrid) -->
        <div 
          bind:this={imageContainer}
          class="group relative bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden min-h-[400px]"
        >
          {#if image?.url}
            <img 
              src={image.url} 
              alt={image?.title} 
              class="w-full h-full object-contain"
            />

            <!-- ✅ OVERLAY LAYER con trasparenza -->
            <div class="image-overlay absolute inset-0 z-10 transition-all duration-200 pointer-events-none"></div>

            <!-- Navigation arrows overlay (Instagram-like) -->
            <button
              on:click={prev}
              disabled={currentIndex === 0}
              class="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
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
              class="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              title="Next (→)"
              aria-label="Next image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            <!-- ✅ OVERLAY BUTTONS (identici a ResultsGrid) -->
            <div class="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                  class="w-12 h-12 rounded-full bg-slate-200/85 text-slate-900 shadow-xl flex items-center justify-center border border-slate-300/80 ring-1 ring-black/5 transition-transform duration-150 hover:scale-110 hover:bg-slate-100 active:scale-95 pointer-events-auto"
                            style="--play-size: clamp(44px, calc(var(--kf-size, 160px) * 0.32), 96px); width: var(--play-size); height: var(--play-size);"
                  title="Play video"
                  aria-label="Play video"
                  on:click={handleOpenVideoPlayer}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    class="text-slate-900"
                              style="width: calc(var(--play-size) * 0.44); height: calc(var(--play-size) * 0.44);"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <!-- Barra bottom stile YouTube -->
              <div class="absolute bottom-1 left-3 right-3 flex items-center justify-between bg-black/75 backdrop-blur-md rounded-lg px-3 py-2 shadow-xl">
                <!-- Left group: video actions -->
                <div class="flex items-center space-x-1.5">
                  <button
                    class="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                    title="Video summary"
                    aria-label="Open video summary"
                    on:click={handleVideoSummary}
                  >
                    <svg class="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
                    </svg>
                  </button>

                  <button
                    class="p-1.5 hover:bg-white/20 rounded-md transition-colors"
                    title="Image similarity"
                    aria-label="Run image similarity"
                    on:click={handleSimilarity}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </button>
                </div>

                <!-- Right group: feedback actions -->
                <div class="flex items-center space-x-1.5">
                  <button
                    class="p-1.5 hover:bg-green-500/30 rounded-md transition-colors"
                    title="Positive feedback"
                    aria-label="Add positive feedback"
                    on:click={handleRFPositive}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-green-400" fill="currentColor">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                  </button>

                  <button
                    class="p-1.5 hover:bg-red-500/30 rounded-md transition-colors"
                    title="Negative feedback"
                    aria-label="Add negative feedback"
                    on:click={handleRFNegative}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-red-400" fill="currentColor">
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
                  class="absolute top-3 right-3 p-2 bg-green-600/80 hover:bg-green-600 backdrop-blur-sm rounded-lg transition-all shadow-lg cursor-pointer"
                  title="Submit"
                  on:click={handleSubmit}
                  on:keydown={(e) => e.key === 'Enter' && handleSubmit(e)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 19V7M5 12l7-7 7 7"/>
                  </svg>
                </div>
              {/if}
            </div>

            <!-- ✅ Submit Badge (sempre visibile se submitted) -->
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
        
        <!-- Info column -->
        <div class="space-y-4">
          <!-- Details -->
          <div>
            <h4 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Details</h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-center">
                <span class="w-28 text-gray-500">Position:</span>
                <span class="font-semibold text-gray-800">{currentIndex + 1} / {total}</span>
              </div>
              <div class="flex items-start">
                <span class="w-28 text-gray-500 pt-1">Image ID:</span>
                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 break-all flex-1">
                  {image?.imgId}
                </span>
              </div>
              <div class="flex items-start">
                <span class="w-28 text-gray-500 pt-1">Video ID:</span>
                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  {image?.videoId}
                </span>
              </div>
            </div>
          </div>

          <!-- Metadata -->
          <div>
            <h4 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Metadata</h4>

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
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <div class="max-h-64 overflow-auto divide-y divide-gray-100">
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
          
          <!-- Notes -->
          <div>
            <h4 class="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Notes</h4>
            <textarea 
              class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none" 
              rows="8" 
              placeholder="Add notes here..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
        <div class="text-sm text-gray-500 flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <kbd class="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">←</kbd>
            <kbd class="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">→</kbd>
            <span>Navigate</span>
          </div>
          <div class="flex items-center space-x-2">
            <kbd class="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">ESC</kbd>
            <span>Close</span>
          </div>
        </div>
        <button 
          on:click={close} 
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
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
