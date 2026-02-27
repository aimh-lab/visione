<script>
  export let totalImages = 0;
  export let submittedCount = 0;
  export let rfPositiveCount = 0;
  export let rfNegativeCount = 0;
  export let currentView = 'View1';
  export let viewMode = 'byrank';
  export let searchTime = 0;
  export let isLoading = false;
  export let showSubmitted = false;
  
  // ✅ BONUS: Eventi per azioni rapide
  export let onViewSubmitted = () => {};
  export let onViewRF = () => {};
  
  const viewLabels = {
    'View1': 'Search',
    'View2': 'Video Summary',
    'Similarity': 'Image Similarity'
  };
  
  const sortLabels = {
    'byrank': 'By Relevance',
    'byvideo': 'By Video',
    'bydate': 'By Date'
  };
  
  $: viewLabel = viewLabels[currentView] || currentView;
  $: sortLabel = sortLabels[viewMode] || viewMode;
</script>

<div class="ui-statusbar fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-md border-t border-gray-700/50 shadow-2xl z-[100]">
  <div class="px-4 py-2">
    <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
      <!-- Left side: Stats -->
      <div class="flex items-center space-x-4 text-xs">
        <!-- Total results (non cliccabile) -->
        <div class="ui-status-chip flex items-center space-x-1.5 px-2.5 py-1 bg-gray-800/50 rounded-full border border-gray-700/50">
          <svg class="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span class="font-bold text-white">{totalImages.toLocaleString()}</span>
          <span class="text-gray-400">results</span>
        </div>
        
        <!-- ✅ BONUS: Submitted count - CLICCABILE -->
        {#if showSubmitted && submittedCount > 0}
          <button
            on:click={onViewSubmitted}
            class="ui-status-chip ui-status-chip-submitted flex items-center space-x-1.5 px-2.5 py-1 bg-green-900/30 rounded-full border border-green-700/50 
                   hover:bg-green-900/50 hover:border-green-600 transition-all cursor-pointer active:scale-95"
            title="Click to view submitted frames"
          >
            <svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-bold text-green-300">{submittedCount}</span>
            <span class="text-green-400/80">submitted</span>
          </button>
        {/if}
        
        <!-- ✅ BONUS: RF counts - CLICCABILE -->
        {#if rfPositiveCount > 0 || rfNegativeCount > 0}
          <button
            on:click={onViewRF}
            class="ui-status-chip ui-status-chip-rf flex items-center space-x-2 px-2.5 py-1 bg-gray-800/50 rounded-full border border-gray-700/50
                   hover:bg-gray-800 hover:border-blue-600 transition-all cursor-pointer active:scale-95"
            title="Click to view relevance feedback"
          >
            {#if rfPositiveCount > 0}
              <div class="flex items-center space-x-1">
                <span class="text-green-400 font-bold">👍</span>
                <span class="text-green-300 font-semibold">{rfPositiveCount}</span>
              </div>
            {/if}
            
            {#if rfPositiveCount > 0 && rfNegativeCount > 0}
              <span class="text-gray-600">•</span>
            {/if}
            
            {#if rfNegativeCount > 0}
              <div class="flex items-center space-x-1">
                <span class="text-red-400 font-bold">👎</span>
                <span class="text-red-300 font-semibold">{rfNegativeCount}</span>
              </div>
            {/if}
          </button>
        {/if}
        
        <!-- Search time (non cliccabile) -->
        {#if searchTime > 0}
          <div class="ui-status-chip ui-status-chip-time flex items-center space-x-1.5 px-2.5 py-1 bg-purple-900/30 rounded-full border border-purple-700/50">
            <svg class="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="text-purple-300 font-semibold">{(searchTime / 1000).toFixed(2)}s</span>
          </div>
        {/if}
        
        <!-- Loading indicator -->
        {#if isLoading}
          <div class="ui-status-chip ui-status-chip-loading flex items-center space-x-1.5 px-2.5 py-1 bg-blue-900/30 rounded-full border border-blue-700/50">
            <svg class="w-3.5 h-3.5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span class="text-blue-300 font-medium">Loading...</span>
          </div>
        {/if}
      </div>
      
      <!-- Right side: Context info -->
      <div class="flex items-center space-x-3 text-xs text-gray-400">
        <div class="flex items-center space-x-1.5">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>View:</span>
          <span class="text-white font-semibold">{viewLabel}</span>
        </div>
        
        <span class="text-gray-700">•</span>
        
        <div class="flex items-center space-x-1.5">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Sort:</span>
          <span class="text-white font-semibold">{sortLabel}</span>
        </div>
        
        <span class="text-gray-700">•</span>
        
        <span class="text-gray-600 font-mono text-[10px]">v1.0.0</span>
      </div>
    </div>
  </div>
  
  {#if isLoading}
    <div class="absolute top-0 left-0 right-0 h-0.5 bg-blue-600/30">
      <div class="h-full bg-blue-500 animate-progress"></div>
    </div>
  {/if}
</div>

<style>
  @keyframes progress {
    0% { width: 0%; }
    100% { width: 100%; }
  }
  
  .animate-progress {
    animation: progress 2s ease-in-out infinite;
  }
</style>
