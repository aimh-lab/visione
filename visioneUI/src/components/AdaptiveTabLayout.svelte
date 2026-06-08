<script>
  import { createEventDispatcher } from 'svelte';
  import { tabsPosition } from '../stores/tabsPosition.js';
  import { tabConfig, getTabConfig } from '$lib/tabConfig.js';
  import MainToolbar from './MainToolbar.svelte';
  import { normalizeGroupByOptions } from '$lib/groupByConfig.js';
  
  export let active;
  export let tabs;
  export let isSidebarOpen;
  export let isSidebarRightOpen;
  export let viewMode;
  export let showViewModeRadios;
  export let runtimeProfile = {};
  export let keyframeSize = 130;
  export let dresEnabled = false;
  export let challengeType = "KIS";
  export let evaluationOptions = [];
  export let selectedEvaluationId = '';
  export let loadingEvaluationOptions = false;
  export let pinnedVideoSummaries = [];
  export let pinnedImages = [];
  export let activePinnedSummaryKey = '';
  
  const dispatch = createEventDispatcher();
  
  let showPositionMenu = false;
  let isSortDropdownOpen = false;
  let isChallengeDropdownOpen = false;
  let isPinnedDropdownOpen = false;
  const challengeOptions = ["KIS", "AVS", "Q&A"];
  
  let sortOptions = [];
  
  const getConfig = getTabConfig;
  
  $: currentSort = sortOptions.find(opt => opt.value === viewMode) || sortOptions[0] || { label: 'Group', icon: '' };
  
  function setPosition(pos) {
    tabsPosition.set(pos);
    showPositionMenu = false;
  }
  
  function setMode(mode) {
    dispatch('changeViewMode', { mode });
    isSortDropdownOpen = false;
  }

  function adjustKeyframeSize(delta) {
    dispatch('adjustKeyframeSize', { delta });
  }

  function setChallengeType(type) {
    dispatch('changeChallengeType', { type });
    dispatch('requestEvaluationOptions');
    isChallengeDropdownOpen = false;
  }

  function toggleChallengeDropdown() {
    isChallengeDropdownOpen = !isChallengeDropdownOpen;
    if (isChallengeDropdownOpen) {
      dispatch('requestEvaluationOptions');
    }
  }

  function setEvaluationId(evaluationId) {
    dispatch('setEvaluationId', { challengeType, evaluationId });
  }

  function openPinnedSummary(item) {
    dispatch('openPinnedVideoSummary', { item });
    isPinnedDropdownOpen = false;
  }

  function unpinSummary(event, item) {
    event.stopPropagation();
    dispatch('unpinVideoSummary', { item });
  }

  function clearPinnedSummaries() {
    dispatch('clearPinnedVideoSummaries');
    isPinnedDropdownOpen = false;
  }

  function openPinnedImage(item) {
    dispatch('openPinnedImage', { item });
    isPinnedDropdownOpen = false;
  }

  function unpinImage(event, item) {
    event.stopPropagation();
    dispatch('unpinImage', { item });
  }

  function clearPinnedImages() {
    dispatch('clearPinnedImages');
    isPinnedDropdownOpen = false;
  }

  const summaryKey = (item) => `${String(item?.videoId || '').trim()}::${String(item?.highlightImgId || '').trim()}`;
  $: pinnedCount = (pinnedVideoSummaries?.length || 0) + (pinnedImages?.length || 0);
  $: sortOptions = normalizeGroupByOptions(runtimeProfile);
  
  function handleClickOutside(event) {
    if (showPositionMenu && !event.target.closest('.position-menu-container')) {
      showPositionMenu = false;
    }
    if (isSortDropdownOpen && !event.target.closest('.sort-dropdown-container')) {
      isSortDropdownOpen = false;
    }
    if (isChallengeDropdownOpen && !event.target.closest('.challenge-dropdown-container')) {
      isChallengeDropdownOpen = false;
    }
    if (isPinnedDropdownOpen && !event.target.closest('.pinned-dropdown-container')) {
      isPinnedDropdownOpen = false;
    }
  }

  function handleWindowKeydown(event) {
    if (event.key !== 'Escape') return;
    showPositionMenu = false;
    isSortDropdownOpen = false;
    isChallengeDropdownOpen = false;
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleWindowKeydown} />

{#if $tabsPosition === 'top'}
  <!-- Layout TOP con MainToolbar completo -->
  <div class="flex flex-col h-full">
    <div class="relative">
      <MainToolbar 
        {active} 
        {tabs} 
        {isSidebarOpen}
        {isSidebarRightOpen}
        {viewMode} 
        {showViewModeRadios}
        {runtimeProfile}
        {keyframeSize}
        {dresEnabled}
        {challengeType}
        {evaluationOptions}
        {selectedEvaluationId}
        {loadingEvaluationOptions}
        pinnedSummaries={pinnedVideoSummaries}
        {pinnedImages}
        {activePinnedSummaryKey}
        on:change
        on:toggleSidebar
        on:toggleRightSidebar 
        on:changeViewMode
        on:adjustKeyframeSize
        on:changeChallengeType
        on:requestEvaluationOptions
        on:setEvaluationId
        on:openSettings
        on:reset
        on:openPinnedVideoSummary
        on:unpinVideoSummary
        on:clearPinnedVideoSummaries
        on:openPinnedImage
        on:unpinImage
        on:clearPinnedImages
      />
      
      <button 
        class="ui-toolbar-btn ui-position-menu-btn absolute top-2 left-3 p-1.5 bg-white/95 border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400 rounded-lg shadow-sm transition-all z-20 position-menu-container"
        on:click|stopPropagation={() => showPositionMenu = !showPositionMenu}
        title="Change tabs position"
        aria-label="Change tabs position"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      
      {#if showPositionMenu}
        <div class="ui-sort-dropdown-menu absolute top-12 left-3 rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 position-menu-container min-w-36">
          <div class="ui-position-menu-header px-3 py-2 border-b">
            <span class="text-xs font-semibold">Tabs Position</span>
          </div>
          <button 
            on:click={() => setPosition('top')} 
            class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'top' ? 'ui-sort-option-active' : ''}"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="6" rx="1"/>
              <rect x="3" y="11" width="18" height="10" rx="1"/>
            </svg>
            <span class="text-sm">Top</span>
            {#if $tabsPosition === 'top'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button 
            on:click={() => setPosition('left')} 
            class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'left' ? 'ui-sort-option-active' : ''}"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
            {#if $tabsPosition === 'left'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button 
            on:click={() => setPosition('right')} 
            class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'right' ? 'ui-sort-option-active' : ''}"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
            {#if $tabsPosition === 'right'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        </div>
      {/if}
    </div>
    
    <div class="flex-1 overflow-hidden">
      <slot />
    </div>
  </div>

{:else if $tabsPosition === 'left'}
  <!-- Layout LEFT -->
  <div class="flex h-full">
    <div class="w-10 bg-gradient-to-b from-gray-100 to-gray-200 border-r border-gray-300 flex flex-col items-center py-4 space-y-2 shadow-sm">
      <!-- Menu grip in alto -->
      <button 
        class="ui-toolbar-btn ui-position-menu-btn p-1.5 bg-white/95 border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400 rounded-lg shadow-sm transition-all position-menu-container"
        on:click|stopPropagation={() => showPositionMenu = !showPositionMenu}
        title="Change tabs position"
        aria-label="Change tabs position"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      
      {#if showPositionMenu}
        <div class="ui-sort-dropdown-menu absolute top-4 left-20 rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 position-menu-container min-w-36">
          <div class="ui-position-menu-header px-3 py-2 border-b">
            <span class="text-xs font-semibold">Tabs Position</span>
          </div>
          <button on:click={() => setPosition('top')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'top' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="6" rx="1"/>
            </svg>
            <span class="text-sm">Top</span>
            {#if $tabsPosition === 'top'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button on:click={() => setPosition('left')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'left' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
            {#if $tabsPosition === 'left'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button on:click={() => setPosition('right')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'right' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
            {#if $tabsPosition === 'right'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        </div>
      {/if}
      
      <!-- Tab buttons verticali -->
      {#each tabs as tab}
        {@const config = getConfig(tab)}
        <button
          on:click={() => dispatch('change', { tab })}
          class="w-8 h-8 rounded-lg flex flex-col items-center justify-center transition-all
                 {active === tab 
                   ? 'bg-white text-blue-600 shadow-lg border-2 border-blue-600' 
                   : 'bg-gray-300 text-gray-600 hover:bg-gray-200'}"
          title={config.label}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {@html config.icon}
          </svg>
        </button>
      {/each}

      <div class="relative pinned-dropdown-container">
        <button
          type="button"
          class="ui-toolbar-btn ui-toolbar-settings p-1.5 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm relative"
          on:click|stopPropagation={() => isPinnedDropdownOpen = !isPinnedDropdownOpen}
          title="Pinned items"
          aria-label="Pinned items"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5a3 3 0 0 1 6 0c0 1.37-.72 2.58-1.8 3.26l1.55 3.24h-5.5l1.55-3.24A3.93 3.93 0 0 1 9 5Z"/>
            <path d="M12 11.5v7.5"/>
            <path d="M10 15.5h4"/>
          </svg>
          {#if pinnedCount > 0}
            <span class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-blue-600 text-white text-[9px] leading-3.5 text-center font-semibold">{Math.min(pinnedCount, 99)}</span>
          {/if}
        </button>

        {#if isPinnedDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute top-0 left-20 w-56 rounded-lg shadow-xl border py-1 z-50">
            <div class="ui-position-menu-header px-3 py-2 border-b flex items-center justify-between">
              <span class="text-xs font-semibold">Pinned</span>
              {#if pinnedCount > 0}
                <button type="button" class="text-[11px] font-medium text-red-500 hover:text-red-400" on:click={() => { clearPinnedSummaries(); clearPinnedImages(); }}>Clear</button>
              {/if}
            </div>
            {#if pinnedCount === 0}
              <div class="px-3 py-3 text-xs text-gray-500">No pinned items yet</div>
            {:else}
              {#each pinnedVideoSummaries as item}
                <button
                  type="button"
                  class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors text-left {summaryKey(item) === activePinnedSummaryKey ? 'ui-sort-option-active' : ''}"
                  on:click={() => openPinnedSummary(item)}
                  title={`Open ${item.label || item.videoId}`}
                >
                  <span class="min-w-0 flex-1 text-xs truncate {summaryKey(item) === activePinnedSummaryKey ? 'text-blue-700 font-semibold' : ''}">{item.label || item.videoId}</span>
                  <span
                    role="button"
                    tabindex="0"
                    class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                    on:click={(event) => unpinSummary(event, item)}
                    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinSummary(event, item)}
                    aria-label={`Unpin ${item.label || item.videoId}`}
                    title="Unpin"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </span>
                </button>
              {/each}
              {#if pinnedImages.length > 0}
                <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Images</div>
                {#each pinnedImages as item}
                  <button
                    type="button"
                    class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors text-left"
                    on:click={() => openPinnedImage(item)}
                    title={`Open ${item.label || item.imgId}`}
                  >
                    <span class="min-w-0 flex-1 text-xs truncate">{item.label || item.imgId}</span>
                    <span
                      role="button"
                      tabindex="0"
                      class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                      on:click={(event) => unpinImage(event, item)}
                      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinImage(event, item)}
                      aria-label={`Unpin ${item.label || item.imgId}`}
                      title="Unpin"
                    >
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </span>
                  </button>
                {/each}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex-1"></div>
      
      <!-- Sort dropdown (solo se showViewModeRadios) -->
      {#if showViewModeRadios}
        <div class="flex flex-col items-center gap-1">
          <button
            type="button"
            class="ui-toolbar-btn w-8 h-8 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
            on:click={() => adjustKeyframeSize(10)}
            aria-label="Increase thumbnail size"
            title="Increase thumbnail size"
            disabled={keyframeSize >= 400}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button
            type="button"
            class="ui-toolbar-btn w-8 h-8 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
            on:click={() => adjustKeyframeSize(-10)}
            aria-label="Decrease thumbnail size"
            title="Decrease thumbnail size"
            disabled={keyframeSize <= 80}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
              <path d="M5 12h14"/>
            </svg>
          </button>
        </div>

        <div class="relative sort-dropdown-container">
          <button
            on:click|stopPropagation={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
            title="Sort by"
            aria-label="Sort by"
          >
            <svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5h10"/>
              <path d="M11 12h7"/>
              <path d="M11 19h4"/>
              <path d="M4 17l-2 2 2 2"/>
              <path d="M2 19h5"/>
              <path d="M6 7l2-2 2 2"/>
              <path d="M8 5v14"/>
            </svg>
          </button>
          
          {#if isSortDropdownOpen}
            <div class="ui-sort-dropdown-menu absolute bottom-0 left-20 mb-0 w-48 rounded-lg shadow-xl border py-1 z-50 sort-dropdown-container">
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="ui-sort-option w-full flex items-center space-x-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left
                         {viewMode === option.value ? 'bg-blue-50 ui-sort-option-active' : ''}"
                >
                  <svg class="w-4 h-4 flex-shrink-0 {viewMode === option.value ? 'text-blue-600' : 'text-gray-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {@html option.icon}
                  </svg>
                  <span class="text-sm {viewMode === option.value ? 'text-blue-700 font-medium' : 'text-gray-700'}">
                    {option.label}
                  </span>
                  {#if viewMode === option.value}
                    <svg class="w-3.5 h-3.5 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="relative challenge-dropdown-container ui-challenge-control" data-dres-enabled={dresEnabled ? 'true' : 'false'}>
        <button
          on:click|stopPropagation={toggleChallengeDropdown}
          class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
          title="Challenge type"
          aria-label="Challenge type"
        >
          <span class="text-[10px] font-semibold text-gray-700">{challengeType}</span>
        </button>

        {#if isChallengeDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute bottom-0 left-20 mb-0 w-72 rounded-lg shadow-xl border py-1 z-50 challenge-dropdown-container">
            {#each challengeOptions as option}
              <button
                on:click={() => setChallengeType(option)}
                class="ui-sort-option w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors text-left {challengeType === option ? 'bg-blue-50 ui-sort-option-active' : ''}"
              >
                <span class="text-sm font-medium {challengeType === option ? 'text-blue-700' : 'text-gray-800'}">{option}</span>
                {#if challengeType === option}
                  <svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                {/if}
              </button>
            {/each}

            {#if dresEnabled}
              <div class="px-3 pt-2 pb-1 border-t border-gray-200 mt-1">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evaluations</div>
              </div>

              {#if loadingEvaluationOptions}
                <div class="px-3 py-2 text-xs text-gray-500">Loading evaluations...</div>
              {:else if evaluationOptions.length === 0}
                <div class="px-3 py-2 text-xs text-gray-500">No evaluations available.</div>
              {:else}
                {#each evaluationOptions as item}
                  <button
                    type="button"
                    class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                    on:click={() => setEvaluationId(item.id)}
                    title={item.displayName || item.name || 'Evaluation'}
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium text-gray-800 truncate">{item.displayName || item.name || 'Evaluation'}</div>
                      <div class="text-[10px] text-gray-500 truncate">{item.status || item.type || ''}</div>
                    </div>
                    {#if selectedEvaluationId === item.id}
                      <svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    {/if}
                  </button>
                {/each}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      
      <!-- Sidebar toggle -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar p-1.5 rounded-lg transition-all border shadow-sm
               {isSidebarOpen 
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}"
        title={isSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}
        aria-label={isSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}
        on:click={() => dispatch('toggleSidebar')}
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <!-- Sidebar RIGHT toggle -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar p-1.5 rounded-lg transition-all border shadow-sm
               {isSidebarRightOpen
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}"
        title={isSidebarRightOpen ? "Hide right sidebar" : "Show right sidebar"}
        aria-label={isSidebarRightOpen ? "Hide right sidebar" : "Show right sidebar"}
        on:click={() => dispatch('toggleRightSidebar')}
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>

      <!-- Settings -->
      <button
        class="ui-toolbar-btn ui-toolbar-settings p-1.5 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm"
        on:click={() => dispatch('openSettings')}
        title="Settings"
        aria-label="Open settings"
      >
        <svg class="w-4 h-4 text-gray-600 hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.69 0 1.31-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.5l.06.06c.47.47 1.15.61 1.82.33.56-.23.92-.78 1-1.39V2.5a2 2 0 1 1 4 0v.09c.08.6.44 1.16 1 1.39.67.28 1.35.14 1.82-.33l.06-.06A2 2 0 1 1 20.22 7l-.06.06c-.47.47-.61 1.15-.33 1.82.23.56.78.92 1.39 1H21a2 2 0 1 1 0 4h-.09c-.6.08-1.16.44-1.39 1z"/>
        </svg>
      </button>

      <!-- Reset session -->
      <button
        class="p-1 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm"
        on:click={() => dispatch('reset')}
        title="Clear current search session"
        aria-label="Clear current search session"
      >
        <img src="./logoVISIONE.png" alt="Visione Logo" class="h-4"/>
      </button>
    </div>
    
    <div class="flex-1 overflow-hidden">
      <slot />
    </div>
  </div>

{:else}
  <!-- Layout RIGHT (copia di LEFT ma specchiato) -->
  <div class="flex h-full">
    <div class="flex-1 overflow-hidden">
      <slot />
    </div>
    
    <div class="w-10 bg-gradient-to-b from-gray-100 to-gray-200 border-l border-gray-300 flex flex-col items-center py-4 space-y-2 shadow-sm">
      <button 
        class="p-1.5 hover:bg-white/80 rounded-md transition-all position-menu-container"
        on:click|stopPropagation={() => showPositionMenu = !showPositionMenu}
        aria-label="Change tabs position"
      >
        <svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      
      {#if showPositionMenu}
        <div class="ui-sort-dropdown-menu absolute top-4 right-20 rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 position-menu-container min-w-36">
          <div class="ui-position-menu-header px-3 py-2 border-b">
            <span class="text-xs font-semibold">Tabs Position</span>
          </div>
          <button on:click={() => setPosition('top')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'top' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="6" rx="1"/>
            </svg>
            <span class="text-sm">Top</span>
            {#if $tabsPosition === 'top'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button on:click={() => setPosition('left')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'left' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
            {#if $tabsPosition === 'left'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
          <button on:click={() => setPosition('right')} class="ui-sort-option w-full flex items-center space-x-2 px-4 py-2 transition-colors text-left {$tabsPosition === 'right' ? 'ui-sort-option-active' : ''}">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
            {#if $tabsPosition === 'right'}
              <svg class="w-4 h-4 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </button>
        </div>
      {/if}
      
      {#each tabs as tab}
        {@const config = getConfig(tab)}
        <button
          on:click={() => dispatch('change', { tab })}
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all
                 {active === tab ? 'bg-white text-blue-600 shadow-lg border-2 border-blue-600' : 'bg-gray-300 text-gray-600 hover:bg-gray-200'}"
          title={config.label}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {@html config.icon}
          </svg>
        </button>
      {/each}

      <div class="relative pinned-dropdown-container">
        <button
          type="button"
          class="ui-toolbar-btn ui-toolbar-settings p-1.5 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm relative"
          on:click|stopPropagation={() => isPinnedDropdownOpen = !isPinnedDropdownOpen}
          title="Pinned items"
          aria-label="Pinned items"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5a3 3 0 0 1 6 0c0 1.37-.72 2.58-1.8 3.26l1.55 3.24h-5.5l1.55-3.24A3.93 3.93 0 0 1 9 5Z"/>
            <path d="M12 11.5v7.5"/>
            <path d="M10 15.5h4"/>
          </svg>
          {#if pinnedCount > 0}
            <span class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-blue-600 text-white text-[9px] leading-3.5 text-center font-semibold">{Math.min(pinnedCount, 99)}</span>
          {/if}
        </button>

        {#if isPinnedDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute top-0 right-20 w-56 rounded-lg shadow-xl border py-1 z-50">
            <div class="ui-position-menu-header px-3 py-2 border-b flex items-center justify-between">
              <span class="text-xs font-semibold">Pinned</span>
              {#if pinnedCount > 0}
                <button type="button" class="text-[11px] font-medium text-red-500 hover:text-red-400" on:click={() => { clearPinnedSummaries(); clearPinnedImages(); }}>Clear</button>
              {/if}
            </div>
            {#if pinnedCount === 0}
              <div class="px-3 py-3 text-xs text-gray-500">No pinned items yet</div>
            {:else}
              {#each pinnedVideoSummaries as item}
                <button
                  type="button"
                  class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors text-left {summaryKey(item) === activePinnedSummaryKey ? 'ui-sort-option-active' : ''}"
                  on:click={() => openPinnedSummary(item)}
                  title={`Open ${item.label || item.videoId}`}
                >
                  <span class="min-w-0 flex-1 text-xs truncate {summaryKey(item) === activePinnedSummaryKey ? 'text-blue-700 font-semibold' : ''}">{item.label || item.videoId}</span>
                  <span
                    role="button"
                    tabindex="0"
                    class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                    on:click={(event) => unpinSummary(event, item)}
                    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinSummary(event, item)}
                    aria-label={`Unpin ${item.label || item.videoId}`}
                    title="Unpin"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </span>
                </button>
              {/each}
              {#if pinnedImages.length > 0}
                <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Images</div>
                {#each pinnedImages as item}
                  <button
                    type="button"
                    class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors text-left"
                    on:click={() => openPinnedImage(item)}
                    title={`Open ${item.label || item.imgId}`}
                  >
                    <span class="min-w-0 flex-1 text-xs truncate">{item.label || item.imgId}</span>
                    <span
                      role="button"
                      tabindex="0"
                      class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                      on:click={(event) => unpinImage(event, item)}
                      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinImage(event, item)}
                      aria-label={`Unpin ${item.label || item.imgId}`}
                      title="Unpin"
                    >
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </span>
                  </button>
                {/each}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="flex-1"></div>
      
      <!-- Sort dropdown -->
      {#if showViewModeRadios}
        <div class="flex flex-col items-center gap-1">
          <button
            type="button"
            class="ui-toolbar-btn w-8 h-8 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
            on:click={() => adjustKeyframeSize(10)}
            aria-label="Increase thumbnail size"
            title="Increase thumbnail size"
            disabled={keyframeSize >= 400}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button
            type="button"
            class="ui-toolbar-btn w-8 h-8 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
            on:click={() => adjustKeyframeSize(-10)}
            aria-label="Decrease thumbnail size"
            title="Decrease thumbnail size"
            disabled={keyframeSize <= 80}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
              <path d="M5 12h14"/>
            </svg>
          </button>
        </div>

        <div class="relative sort-dropdown-container">
          <button
            on:click|stopPropagation={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
            title="Sort by"
            aria-label="Sort by"
          >
            <svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5h10"/>
              <path d="M11 12h7"/>
              <path d="M11 19h4"/>
              <path d="M4 17l-2 2 2 2"/>
              <path d="M2 19h5"/>
              <path d="M6 7l2-2 2 2"/>
              <path d="M8 5v14"/>
            </svg>
          </button>
          
          {#if isSortDropdownOpen}
            <div class="ui-sort-dropdown-menu absolute bottom-0 right-20 mb-0 w-48 rounded-lg shadow-xl border py-1 z-50 sort-dropdown-container">
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="ui-sort-option w-full flex items-center space-x-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left
                         {viewMode === option.value ? 'bg-blue-50 ui-sort-option-active' : ''}"
                >
                  <svg class="w-4 h-4 {viewMode === option.value ? 'text-blue-600' : 'text-gray-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {@html option.icon}
                  </svg>
                  <span class="text-sm {viewMode === option.value ? 'text-blue-700 font-medium' : 'text-gray-700'}">
                    {option.label}
                  </span>
                  {#if viewMode === option.value}
                    <svg class="w-3.5 h-3.5 ml-auto text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="relative challenge-dropdown-container ui-challenge-control" data-dres-enabled={dresEnabled ? 'true' : 'false'}>
        <button
          on:click|stopPropagation={toggleChallengeDropdown}
          class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
          title="Challenge type"
          aria-label="Challenge type"
        >
          <span class="text-[10px] font-semibold text-gray-700">{challengeType}</span>
        </button>

        {#if isChallengeDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute bottom-0 right-20 mb-0 w-72 rounded-lg shadow-xl border py-1 z-50 challenge-dropdown-container">
            {#each challengeOptions as option}
              <button
                on:click={() => setChallengeType(option)}
                class="ui-sort-option w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors text-left {challengeType === option ? 'bg-blue-50 ui-sort-option-active' : ''}"
              >
                <span class="text-sm font-medium {challengeType === option ? 'text-blue-700' : 'text-gray-800'}">{option}</span>
                {#if challengeType === option}
                  <svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                {/if}
              </button>
            {/each}

            {#if dresEnabled}
              <div class="px-3 pt-2 pb-1 border-t border-gray-200 mt-1">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evaluations</div>
              </div>

              {#if loadingEvaluationOptions}
                <div class="px-3 py-2 text-xs text-gray-500">Loading evaluations...</div>
              {:else if evaluationOptions.length === 0}
                <div class="px-3 py-2 text-xs text-gray-500">No evaluations available.</div>
              {:else}
                {#each evaluationOptions as item}
                  <button
                    type="button"
                    class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                    on:click={() => setEvaluationId(item.id)}
                    title={item.displayName || item.name || 'Evaluation'}
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium text-gray-800 truncate">{item.displayName || item.name || 'Evaluation'}</div>
                      <div class="text-[10px] text-gray-500 truncate">{item.status || item.type || ''}</div>
                    </div>
                    {#if selectedEvaluationId === item.id}
                      <svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    {/if}
                  </button>
                {/each}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
      
      <button class="ui-toolbar-btn ui-toolbar-sidebar p-1.5 rounded-lg transition-all border shadow-sm {isSidebarOpen ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}" on:click={() => dispatch('toggleSidebar')} aria-label={isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'} title={isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}>
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <button
        class="ui-toolbar-btn ui-toolbar-sidebar p-1.5 rounded-lg transition-all border shadow-sm {isSidebarRightOpen ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}"
        on:click={() => dispatch('toggleRightSidebar')}
        aria-label={isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}
        title={isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>

      <button
        class="ui-toolbar-btn ui-toolbar-settings p-1.5 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm"
        on:click={() => dispatch('openSettings')}
        aria-label="Open settings"
        title="Settings"
      >
        <svg class="w-4 h-4 text-gray-600 hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.69 0 1.31-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.5l.06.06c.47.47 1.15.61 1.82.33.56-.23.92-.78 1-1.39V2.5a2 2 0 1 1 4 0v.09c.08.6.44 1.16 1 1.39.67.28 1.35.14 1.82-.33l.06-.06A2 2 0 1 1 20.22 7l-.06.06c-.47.47-.61 1.15-.33 1.82.23.56.78.92 1.39 1H21a2 2 0 1 1 0 4h-.09c-.6.08-1.16.44-1.39 1z"/>
        </svg>
      </button>

      <button
        class="p-1 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm"
        on:click={() => dispatch('reset')}
        title="Clear current search session"
        aria-label="Clear current search session"
      >
        <img src="./logoVISIONE.png" alt="Visione Logo" class="h-4"/>
      </button>
    </div>
  </div>
{/if}
