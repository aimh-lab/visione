<script>
  import { tabLabels } from '$lib/tabConfig.js';

  export let totalImages = 0;
  export let submittedCount = 0;
  export let rfPositiveCount = 0;
  export let rfNegativeCount = 0;
  export let challengeType = 'KIS';
  export let viewMode = 'byrank';
  export let searchTime = 0;
  export let isLoading = false;
  export let showSubmitted = false;
  export let dresEnabled = false;
  export let dresUsername = '';
  export let dresEvaluationLabel = '';
  
  // Events for quick actions
  export let onViewSubmitted = () => {};
  export let onViewRF = () => {};

  const sortLabels = {
    'byrank': 'By Relevance',
    'byvideo': 'By Video',
    'bydate': 'By Date'
  };

  $: challengeLabel = String(challengeType || 'KIS').trim() || 'KIS';
  $: sortLabel = sortLabels[viewMode] || viewMode;
</script>

<div class="ui-statusbar fixed bottom-0 left-0 right-0 backdrop-blur-md border-t z-[100]">
  <div class="px-4 py-1">
    <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
      <!-- Left side: Stats -->
      <div class="flex items-center space-x-3 text-[11px]">
        <!-- Total results (non cliccabile) -->
        <div class="ui-status-chip ui-status-chip-results flex items-center space-x-1.5 px-2 py-0.5 rounded-full border">
          <svg class="w-3.5 h-3.5 ui-status-chip-results-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span class="font-bold text-white">{totalImages.toLocaleString()}</span>
          <span class="text-gray-400">results</span>
        </div>
        
        <!-- Submitted count - cliccabile -->
        {#if showSubmitted && submittedCount > 0}
          <button
            on:click={onViewSubmitted}
            class="ui-status-chip ui-status-chip-submitted flex items-center space-x-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer active:scale-95"
            title="Click to view submitted frames"
          >
            <svg class="w-3.5 h-3.5 ui-status-chip-submitted-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-bold ui-status-chip-submitted-text">{submittedCount}</span>
            <span class="ui-status-chip-submitted-muted">submitted</span>
          </button>
        {/if}
        
        <!-- RF counts - cliccabile -->
        {#if rfPositiveCount > 0 || rfNegativeCount > 0}
          <button
            on:click={onViewRF}
            class="ui-status-chip ui-status-chip-rf flex items-center space-x-2 px-2 py-0.5 rounded-full border transition-all cursor-pointer active:scale-95"
            title="Click to view relevance feedback"
          >
            {#if rfPositiveCount > 0}
              <div class="flex items-center space-x-1">
                <span class="ui-status-chip-positive-icon font-bold">👍</span>
                <span class="ui-status-chip-positive-text font-semibold">{rfPositiveCount}</span>
              </div>
            {/if}
            
            {#if rfPositiveCount > 0 && rfNegativeCount > 0}
              <span class="text-gray-600">•</span>
            {/if}
            
            {#if rfNegativeCount > 0}
              <div class="flex items-center space-x-1">
                <span class="ui-status-chip-negative-icon font-bold">👎</span>
                <span class="ui-status-chip-negative-text font-semibold">{rfNegativeCount}</span>
              </div>
            {/if}
          </button>
        {/if}
        
        <!-- Search time (non cliccabile) -->
        {#if searchTime > 0}
          <div class="ui-status-chip ui-status-chip-time flex items-center space-x-1.5 px-2 py-0.5 rounded-full border">
            <svg class="w-3.5 h-3.5 ui-status-chip-time-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="ui-status-chip-time-value font-semibold">{(searchTime / 1000).toFixed(2)}s</span>
          </div>
        {/if}
        
        <!-- Loading indicator -->
        {#if isLoading}
          <div class="ui-status-chip ui-status-chip-loading flex items-center space-x-1.5 px-2 py-0.5 rounded-full border">
            <svg class="w-3.5 h-3.5 ui-status-chip-loading-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span class="ui-status-chip-loading-text font-medium">Loading...</span>
          </div>
        {/if}
      </div>
      
      <!-- Right side: Context info -->
      <div class="flex items-center space-x-2.5 text-[11px] text-gray-400">
        {#if dresEnabled && String(dresUsername || '').trim()}
          <div class="flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5 ui-status-accent-dres" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c1.8-3.2 4.7-5 8-5s6.2 1.8 8 5"/>
            </svg>
            <span>DRES:</span>
            <span class="ui-status-accent-dres font-semibold">{dresUsername}</span>
          </div>
          <span class="text-gray-700">•</span>
        {/if}

        {#if dresEnabled && String(dresEvaluationLabel || '').trim()}
          <div class="flex items-center space-x-1.5">
            <svg class="w-3.5 h-3.5 ui-status-accent-eval" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16v12H4z"/>
              <path d="M8 10h8M8 14h5"/>
            </svg>
            <span>Evaluation:</span>
            <span class="ui-status-accent-eval font-semibold">{dresEvaluationLabel}</span>
          </div>
          <span class="text-gray-700">•</span>
        {/if}

        <div class="flex items-center space-x-1.5">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16M7 4v16"/>
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
          <span>Challenge:</span>
          <span class="text-white font-semibold">{challengeLabel}</span>
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
    <div class="ui-status-progress-track absolute top-0 left-0 right-0 h-0.5">
      <div class="ui-status-progress-fill h-full animate-progress"></div>
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
