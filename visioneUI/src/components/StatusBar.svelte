<script>
  import { tabLabels } from '$lib/tabConfig.js';

  export let totalImages = 0;
  export let submittedCount = 0;
  export let rfPositiveCount = 0;
  export let rfNegativeCount = 0;
  export let currentView = 'View1';
  export let viewMode = 'byrank';
  export let searchTime = 0;
  export let isLoading = false;
  export let showSubmitted = false;
  export let dresEnabled = false;
  export let dresUsername = '';
  export let logCount = 0;
  export let logUserFolder = 'unknown-user';
  export let isExportingLogs = false;
  export let onExportLogs = () => {};
  export let isDeletingLogs = false;
  export let onDeleteLogs = () => {};
  export let logResultsLimit = 10000;
  export let onChangeLogResultsLimit = () => {};
  export let autoTranslateEnabled = true;
  export let onToggleAutoTranslate = () => {};
  
  // ✅ BONUS: Eventi per azioni rapide
  export let onViewSubmitted = () => {};
  export let onViewRF = () => {};

  let isLogsDropdownOpen = false;

  function handleWindowClick(event) {
    if (!isLogsDropdownOpen) return;
    const target = event.target;
    if (target && target.closest && target.closest('.logs-dropdown-container')) return;
    isLogsDropdownOpen = false;
  }
  
  const viewLabels = tabLabels;
  
  const sortLabels = {
    'byrank': 'By Relevance',
    'byvideo': 'By Video',
    'bydate': 'By Date'
  };
  
  $: viewLabel = viewLabels[currentView] || currentView;
  $: sortLabel = sortLabels[viewMode] || viewMode;
</script>

<svelte:window on:click={handleWindowClick} />

<div class="ui-statusbar fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-md border-t border-gray-700/50 shadow-2xl z-[100]">
  <div class="px-4 py-1">
    <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
      <!-- Left side: Stats -->
      <div class="flex items-center space-x-3 text-[11px]">
        <!-- Total results (non cliccabile) -->
        <div class="ui-status-chip flex items-center space-x-1.5 px-2 py-0.5 bg-gray-800/50 rounded-full border border-gray-700/50">
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
            class="ui-status-chip ui-status-chip-submitted flex items-center space-x-1.5 px-2 py-0.5 bg-green-900/30 rounded-full border border-green-700/50 
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
            class="ui-status-chip ui-status-chip-rf flex items-center space-x-2 px-2 py-0.5 bg-gray-800/50 rounded-full border border-gray-700/50
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
          <div class="ui-status-chip ui-status-chip-time flex items-center space-x-1.5 px-2 py-0.5 bg-purple-900/30 rounded-full border border-purple-700/50">
            <svg class="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="text-purple-300 font-semibold">{(searchTime / 1000).toFixed(2)}s</span>
          </div>
        {/if}
        
        <!-- Loading indicator -->
        {#if isLoading}
          <div class="ui-status-chip ui-status-chip-loading flex items-center space-x-1.5 px-2 py-0.5 bg-blue-900/30 rounded-full border border-blue-700/50">
            <svg class="w-3.5 h-3.5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span class="text-blue-300 font-medium">Loading...</span>
          </div>
        {/if}
      </div>
      
      <!-- Right side: Context info -->
      <div class="flex items-center space-x-2.5 text-[11px] text-gray-400">
        {#if dresEnabled && String(dresUsername || '').trim()}
          <div class="flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c1.8-3.2 4.7-5 8-5s6.2 1.8 8 5"/>
            </svg>
            <span>DRES:</span>
            <span class="text-cyan-200 font-semibold">{dresUsername}</span>
          </div>
          <span class="text-gray-700">•</span>
        {/if}

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

        <button
          type="button"
          on:click={onToggleAutoTranslate}
          class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded border transition-all {autoTranslateEnabled
            ? 'border-emerald-500/60 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/45'
            : 'border-gray-600/70 bg-gray-800/50 text-gray-300 hover:bg-gray-700/70'}"
          title={autoTranslateEnabled ? 'Auto-translate ON (click to disable)' : 'Auto-translate OFF (click to enable)'}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3.5" y="4" width="11" height="11" rx="1.8"/>
            <path d="M6.5 8.2h5"/>
            <path d="M9 7v1.2"/>
            <path d="M7.3 8.2c.2 1.8 1 3.2 2.6 4.4"/>
            <rect x="10.5" y="9" width="10" height="10" rx="1.8"/>
            <path d="M14.2 14.8h2.8"/>
            <path d="M15.6 13.4v2.8"/>
          </svg>
          <span>{autoTranslateEnabled ? 'Translate ON' : 'Translate OFF'}</span>
        </button>
        
        <span class="text-gray-700">•</span>

        <div class="relative logs-dropdown-container">
          <button
            on:click|stopPropagation={() => (isLogsDropdownOpen = !isLogsDropdownOpen)}
            class="px-2 py-0.5 rounded border border-amber-500/60 bg-amber-900/25 text-amber-200 hover:bg-amber-900/45 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Logging actions"
            disabled={isExportingLogs || isDeletingLogs}
          >
            {#if isExportingLogs}
              Exporting logs...
            {:else if isDeletingLogs}
              Deleting logs...
            {:else}
              Logs ({logCount})
            {/if}
          </button>

          {#if isLogsDropdownOpen}
            <div class="absolute right-0 bottom-full mb-2 w-56 rounded-lg border border-gray-700 bg-gray-900/98 shadow-2xl p-2 z-[120]">
              <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">VBS Logging</div>
              <div class="px-2 pb-1 text-[10px] text-gray-400 truncate" title={logUserFolder}>
                User folder: <span class="text-gray-300">{logUserFolder}</span>
              </div>

              <button
                type="button"
                class="w-full text-left px-2 py-1.5 rounded text-cyan-200 hover:bg-cyan-900/35 transition-colors"
                title="Cycle logged result depth: 100, 1000, 10000"
                on:click={() => {
                  onChangeLogResultsLimit();
                }}
              >
                ⚙ Top Results: {logResultsLimit}
              </button>

              <button
                type="button"
                class="w-full text-left px-2 py-1.5 rounded text-amber-200 hover:bg-amber-900/35 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export VBS logs"
                disabled={isExportingLogs || isDeletingLogs}
                on:click={() => {
                  isLogsDropdownOpen = false;
                  onExportLogs();
                }}
              >
                ⬇ Download Logs
              </button>

              <button
                type="button"
                class="w-full text-left px-2 py-1.5 rounded text-red-200 hover:bg-red-900/35 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete local VBS logs (safe mode)"
                disabled={isDeletingLogs || isExportingLogs || logCount <= 0}
                on:click={() => {
                  isLogsDropdownOpen = false;
                  onDeleteLogs();
                }}
              >
                🗑 Delete Logs (Safe)
              </button>
            </div>
          {/if}
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
