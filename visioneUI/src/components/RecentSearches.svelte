<script>
  import { createEventDispatcher } from "svelte";
  import { recentSearches } from "../stores/recentSearches.js";
  

  export let show = true;
    export let headerless = false;
    export let expanded = false;
  
  let isExpanded = false;
    $: effectiveExpanded = headerless ? expanded : isExpanded;
  
  const dispatch = createEventDispatcher();

    // ✅ AGGIUNGI: forza reactivity
 // let searchesKey = 0;
//  $: if ($recentSearches) {
//    searchesKey = Date.now(); // cambia key ad ogni update
//  }
  

  
  function selectSearch(search) {

    dispatch('select', { 
      query: search.query,
      cachedResults: search.results,
      textareas: search.textareas // ✅ AGGIUNGI QUESTA RIGA
    });
    
    
    if (!headerless) isExpanded = false;
  }

  
  function removeSearch(e, query) {
    e.stopPropagation();
    recentSearches.remove(query);
  }
  
  function formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  function getQuerySegments(search) {
    const items = Array.isArray(search?.textareas) ? search.textareas : [];
    const active = items
      .filter((step) => step?.enabled && String(step?.value || '').trim())
      .map((step) => String(step.value || '').trim());

    if (active.length > 0) return active;
    return [String(search?.query || '').trim()].filter(Boolean);
  }
</script>

{#if show && $recentSearches.length > 0}
  <div class="space-y-2">
    {#if !headerless}
      <!-- Compact header button -->
      <button
        on:click={() => {
          isExpanded = !isExpanded;
        }}
        class="w-full flex items-center justify-between p-2.5 bg-gray-800 hover:bg-gray-750 rounded-lg transition-all group"
      >
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 transition-transform {isExpanded ? 'rotate-90' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <h4 class="text-sm font-semibold text-gray-300">Recent Searches</h4>
        </div>
        <span class="text-sm text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">
          {$recentSearches.length}
        </span>
      </button>
    {/if}
    
    <!-- Expandable list -->
{#if effectiveExpanded}
  <div class="space-y-1 animate-slide-down max-h-80 overflow-y-auto custom-scrollbar">
    {#each $recentSearches as search} <!-- ✅ Rimuovi .slice(0, 5) -->
     <div
  role="button"
  tabindex="0"
  on:click={() => {
    selectSearch(search);
  }}
  on:keydown={(e) => e.key === 'Enter' && selectSearch(search)}
  class="group w-full flex items-start justify-between p-2 bg-gray-800/50 hover:bg-gray-750 rounded-lg transition-all hover:shadow-md cursor-pointer"
>
  <div class="flex-1 min-w-0 text-left">
    <div class="flex items-center space-x-2 min-w-0">
      <div class="flex items-center gap-1 min-w-0 overflow-hidden">
        {#each getQuerySegments(search) as segment, idx}
          <span
            class="text-sm text-gray-200 truncate max-w-[8.5rem] group-hover:text-white transition-colors"
            title={segment}
          >
            {segment}
          </span>
          {#if idx < getQuerySegments(search).length - 1}
            <span class="text-xs text-gray-500 flex-shrink-0">-&gt;</span>
          {/if}
        {/each}
      </div>
      <!-- ✅ Badge per cache -->
      {#if search.results}
        <span class="px-1.5 py-0.5 bg-green-600/20 text-green-400 text-[9px] font-medium rounded uppercase flex-shrink-0">
          Cached
        </span>
      {/if}
    </div>
    <div class="flex items-center space-x-2 mt-0.5">
      <span class="text-[12px] text-gray-500">
        {search.resultCount} results
      </span>
      <span class="text-[12px] text-gray-600">
        {formatTimestamp(search.timestamp)}
      </span>
    </div>
  </div>
  
  <button
    on:click={(e) => removeSearch(e, search.query)}
    class="flex-shrink-0 ml-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-900/30 transition-all"
    title="Remove"
    aria-label="Remove recent search"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500 hover:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  </button>
</div>

    {/each}
    
    <!-- Pulsante Clear all (sempre visibile) -->
    {#if $recentSearches.length > 0}
      <button
        on:click={() => recentSearches.clear()}
        class="w-full text-xs text-gray-500 hover:text-red-400 transition-colors py-2 sticky bottom-0 bg-gray-800/90 backdrop-blur-sm rounded"
      >
        Clear all ({$recentSearches.length})
      </button>
    {/if}
  </div>
{/if}

  </div>
{/if}

<style>
  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-slide-down {
    animation: slide-down 0.2s ease-out;
  }

    .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.4);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.6);
  }
</style>
