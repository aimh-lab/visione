<script>
  import { createEventDispatcher } from "svelte";
  export let submittedImages = [];

  const dispatch = createEventDispatcher();
  const openFromSubmitted = (index) => dispatch("openFromSubmitted", { index });
</script>

<div class="space-y-3">
  {#if submittedImages.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-8 px-4 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <p class="text-xs text-gray-400 text-center">No frames submitted yet</p>
    </div>
  {:else}
    <!-- Grid of submitted images -->
    <div class="grid grid-cols-2 gap-3">
      {#each submittedImages as s, idx}
        {@const isWrongSubmission = String(s?.submissionVerdict ?? '').toUpperCase() === 'WRONG'}
        <button
          data-index={s.index}
          class="group relative bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 hover:border-blue-500 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
          on:click={() => openFromSubmitted(s.index)}
          aria-label={`View submitted image ${s.imgId || idx + 1}`}
        >
          <!-- Image container with fixed aspect ratio -->
          <div class="aspect-[4/3] flex items-center justify-center bg-gray-900">
            {#if s.url}
              <img
                src={s.url}
                alt={s.title || `Submitted ${idx + 1}`}
                loading="lazy"
                class="w-full h-full object-contain"
              />
            {:else}
              <div class="flex flex-col items-center justify-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span class="text-xs">Image {idx + 1}</span>
              </div>
            {/if}
          </div>

          <!-- Overlay with image ID on hover -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div class="absolute bottom-0 left-0 right-0 p-2">
              <p class="text-xs font-medium text-white truncate">
                {s.imgId || `Image ${idx + 1}`}
              </p>
            </div>
          </div>

          <!-- Submitted badge -->
          <div
            class={`absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-lg ${
              isWrongSubmission
                ? 'bg-red-900/45 border border-red-700/50 text-red-200'
                : 'bg-green-900/40 border border-green-700/40 text-green-200'
            }`}
          >
            ✓
          </div>

          <!-- Index number -->
          <div class="absolute top-2 left-2 w-5 h-5 bg-gray-900/80 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {idx + 1}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
