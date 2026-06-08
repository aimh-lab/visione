<script>
  import { createEventDispatcher } from "svelte";
    import EmptyState from "./EmptyState.svelte";
  export let rfPositive = [];
  export let rfNegative = [];

  const dispatch = createEventDispatcher();
  const openFromRF = (index) => dispatch("openFromRF", { index });
  const removePositive = (imgId, index) => dispatch("removePositive", { imgId, index });
  const removeNegative = (imgId, index) => dispatch("removeNegative", { imgId, index });
</script>

<div class="mb-3 rounded-lg border border-blue-800/40 bg-blue-900/20 px-3 py-2 text-xs text-blue-100">
  To update results with relevance feedback, click <span class="font-semibold">Search</span> again after changing positive or negative examples.
</div>

<div class="grid grid-cols-2 gap-4">
  <!-- Positive Column -->
  <div class="space-y-3">
    <!-- Header with badge -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="ui-rf-title-icon-positive w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
        <h4 class="ui-rf-title-positive text-sm font-semibold text-green-400">Positive</h4>
      </div>
      <span class="ui-rf-count-positive px-2 py-0.5 text-xs font-medium bg-green-900/25 border border-green-700/40 text-green-300 rounded-full">
        {rfPositive.length}
      </span>
    </div>

    {#if rfPositive.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-3 px-3 bg-green-900/20 rounded-lg border-2 border-dashed border-green-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-green-700 mb-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
        <p class="text-xs text-green-600 text-center">No positive feedback</p>
      </div>
    {:else}
      <!-- Images grid -->
      <div class="space-y-2">
        {#each rfPositive as r, idx}
          <div class="group relative w-full bg-gray-900 rounded-lg overflow-hidden border-2 border-green-800 hover:border-green-500 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20">
            <!-- Clickable image area -->
            <div
              role="button"
              tabindex="0"
              class="cursor-pointer"
              on:click={() => openFromRF(r.index)}
              on:keydown={(e) => e.key === 'Enter' && openFromRF(r.index)}
            >
              <!-- Image container -->
              <div class="aspect-[4/3] flex items-center justify-center bg-gray-950">
                {#if r.url}
                  <img
                    src={r.url}
                    alt={r.title || `Positive ${idx + 1}`}
                    loading="lazy"
                    class="w-full h-full object-contain"
                  />
                {:else}
                  <div class="flex flex-col items-center justify-center text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                    <span class="text-xs">Image {idx + 1}</span>
                  </div>
                {/if}
              </div>

              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div class="absolute bottom-0 left-0 right-0 p-2">
                  <p class="text-xs font-medium text-white truncate">
                    {r.imgId || `Image ${idx + 1}`}
                  </p>
                </div>
              </div>
            </div>

            <!-- Remove button (visible on hover) -->
            <div
              role="button"
              tabindex="0"
              class="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg z-10"
              title="Remove from positive feedback"
              on:click={(e) => { e.stopPropagation(); removePositive(r.imgId, r.index); }}
              on:keydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removePositive(r.imgId, r.index); }}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </div>

            <!-- Badge -->
            <div class="absolute top-2 left-2 p-1 bg-green-600 text-white rounded-lg shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Negative Column -->
  <div class="space-y-3">
    <!-- Header with badge -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="ui-rf-title-icon-negative w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
        <h4 class="ui-rf-title-negative text-sm font-semibold text-red-400">Negative</h4>
      </div>
      <span class="ui-rf-count-negative px-2 py-0.5 text-xs font-medium bg-red-900/25 border border-red-700/40 text-red-300 rounded-full">
        {rfNegative.length}
      </span>
    </div>

    {#if rfNegative.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-3 px-3 bg-red-900/20 rounded-lg border-2 border-dashed border-red-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-700 mb-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
        <p class="text-xs text-red-600 text-center">No negative feedback</p>
      </div>
    {:else}
      <!-- Images grid -->
      <div class="space-y-2">
        {#each rfNegative as r, idx}
          <div class="group relative w-full bg-gray-900 rounded-lg overflow-hidden border-2 border-red-800 hover:border-red-500 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20">
            <!-- Clickable image area -->
            <div
              role="button"
              tabindex="0"
              class="cursor-pointer"
              on:click={() => openFromRF(r.index)}
              on:keydown={(e) => e.key === 'Enter' && openFromRF(r.index)}
            >
              <!-- Image container -->
              <div class="aspect-[4/3] flex items-center justify-center bg-gray-950">
                {#if r.url}
                  <img
                    src={r.url}
                    alt={r.title || `Negative ${idx + 1}`}
                    loading="lazy"
                    class="w-full h-full object-contain"
                  />
                {:else}
                  <div class="flex flex-col items-center justify-center text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                    <span class="text-xs">Image {idx + 1}</span>
                  </div>
                {/if}
              </div>

              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div class="absolute bottom-0 left-0 right-0 p-2">
                  <p class="text-xs font-medium text-white truncate">
                    {r.imgId || `Image ${idx + 1}`}
                  </p>
                </div>
              </div>
            </div>

            <!-- Remove button (visible on hover) -->
            <div
              role="button"
              tabindex="0"
              class="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-lg z-10"
              title="Remove from negative feedback"
              on:click={(e) => { e.stopPropagation(); removeNegative(r.imgId, r.index); }}
              on:keydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeNegative(r.imgId, r.index); }}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </div>

            <!-- Badge -->
            <div class="absolute top-2 left-2 p-1 bg-red-600 text-white rounded-lg shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
{#if rfPositive.length === 0 && rfNegative.length === 0}
  <EmptyState type="rf" size="medium">
    <div class="flex items-center justify-center space-x-6 text-xs text-gray-500">
      <div class="text-center">
        <kbd class="px-3 py-1.5 bg-gray-800 rounded-lg font-mono block mb-1">+</kbd>
        <span>Positive</span>
      </div>
      <div class="text-center">
        <kbd class="px-3 py-1.5 bg-gray-800 rounded-lg font-mono block mb-1">-</kbd>
        <span>Negative</span>
      </div>
    </div>
  </EmptyState>
{/if}
