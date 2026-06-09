<script>
  import { createEventDispatcher } from "svelte";
  import { tabConfig, getTabConfig } from '$lib/tabConfig.js';
  import { normalizeGroupByOptions, SORT_MODE_OPTIONS } from '$lib/groupByConfig.js';

  export let active = "View1";
  export let tabs = ["View1", "View2", "Similarity"];
  
  export let isSidebarOpen = true;
  export let isSidebarRightOpen = false;
  export let viewMode = "byrank";
  export let sortMode = "relevance";
  export let showViewModeRadios = false;
  export let runtimeProfile = {};
  export let keyframeSize = 130;
  export let dresEnabled = false;
  export let challengeType = "KIS";
  export let evaluationOptions = [];
  export let selectedEvaluationId = '';
  export let loadingEvaluationOptions = false;
  export let pinnedSummaries = [];
  export let pinnedImages = [];
  export let activePinnedSummaryKey = '';
  
  const dispatch = createEventDispatcher();
  
  let isGroupDropdownOpen = false;
  let isChallengeDropdownOpen = false;
  let isPinnedDropdownOpen = false;
  const challengeOptions = ["KIS", "AVS", "Q&A"];
  
  let sortOptions = [];
  
  // tabConfig imported from $lib/tabConfig.js
  
  const getConfig = getTabConfig;
  const toggleSidebar = () => dispatch("toggleSidebar");
  const toggleRightSidebar = () => dispatch("toggleRightSidebar");
  const setMode = (mode) => {
    dispatch("changeViewMode", { mode });
    isGroupDropdownOpen = false;
  };
  const setSortMode = (mode) => {
    dispatch("changeSortMode", { mode });
    isGroupDropdownOpen = false;
  };
  const adjustKeyframeSize = (delta) => {
    dispatch("adjustKeyframeSize", { delta });
  };
  const setChallengeType = (type) => {
    dispatch("changeChallengeType", { type });
    dispatch('requestEvaluationOptions');
    isChallengeDropdownOpen = false;
  };

  const toggleChallengeDropdown = () => {
    isChallengeDropdownOpen = !isChallengeDropdownOpen;
    if (isChallengeDropdownOpen) {
      dispatch('requestEvaluationOptions');
    }
  };

  const setEvaluationId = (evaluationId) => {
    dispatch('setEvaluationId', {
      challengeType,
      evaluationId
    });
  };

  const openPinnedSummary = (item) => {
    dispatch('openPinnedVideoSummary', { item });
    isPinnedDropdownOpen = false;
  };

  const unpinSummary = (event, item) => {
    event.stopPropagation();
    dispatch('unpinVideoSummary', { item });
  };

  const clearPinnedSummaries = () => {
    dispatch('clearPinnedVideoSummaries');
    isPinnedDropdownOpen = false;
  };

  const openPinnedImage = (item) => {
    dispatch('openPinnedImage', { item });
    isPinnedDropdownOpen = false;
  };

  const unpinImage = (event, item) => {
    event.stopPropagation();
    dispatch('unpinImage', { item });
  };

  const clearPinnedImages = () => {
    dispatch('clearPinnedImages');
    isPinnedDropdownOpen = false;
  };

  const summaryKey = (item) => `${String(item?.scope || 'hour').trim()}::${String(item?.videoId || '').trim()}::${String(item?.highlightImgId || '').trim()}`;
  $: pinnedCount = (pinnedSummaries?.length || 0) + (pinnedImages?.length || 0);
  $: hasTabs = Array.isArray(tabs) && tabs.length > 0;
  $: sortOptions = normalizeGroupByOptions(runtimeProfile);
  
  $: currentSort = sortOptions.find(opt => opt.value === viewMode) || sortOptions[0] || { label: 'Group', icon: '', description: '' };
  $: currentSortMode = SORT_MODE_OPTIONS.find(opt => opt.value === sortMode) || SORT_MODE_OPTIONS[0];
  
  function handleClickOutside(event) {
    if (isGroupDropdownOpen && !event.target.closest('.group-dropdown-container')) {
      isGroupDropdownOpen = false;
    }
    if (isChallengeDropdownOpen && !event.target.closest('.challenge-dropdown-container')) {
      isChallengeDropdownOpen = false;
    }
    if (isPinnedDropdownOpen && !event.target.closest('.pinned-dropdown-container')) {
      isPinnedDropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="w-full bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 shadow-sm">
  <div class="w-full px-4 flex items-end justify-between relative">
    <!-- Tab buttons (left) -->
    <div class="ml-8 flex items-end gap-2">
      {#if hasTabs}
        <div class="ui-main-tab-strip flex items-end space-x-1 p-1 rounded-t-xl border border-gray-300 bg-gray-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          {#each tabs as view, idx}
            {@const config = getConfig(view)}
            <button
              on:click={() => dispatch('change', { tab: view })}
              class="ui-main-tab group relative px-3 py-1.5 rounded-t-lg font-medium transition-all duration-200 flex items-center space-x-2 border
                    {active === view 
                      ? 'ui-main-tab-active bg-white text-blue-700 border-blue-500 shadow-[0_-1px_0_rgba(255,255,255,0.8),0_6px_14px_rgba(37,99,235,0.18)] -mb-px' 
                      : 'ui-main-tab-inactive bg-transparent text-gray-700 border-transparent hover:bg-white/70 hover:text-gray-900 hover:border-gray-300'}"
              aria-current={active === view ? 'page' : undefined}
            >
              <svg xmlns="http://www.w3.org/2000/svg" 
                  class="w-4 h-4 transition-colors {active === view ? 'text-blue-700' : 'text-gray-500 group-hover:text-gray-700'}" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-linejoin="round">
                {@html config.icon}
              </svg>
              <span class="text-sm whitespace-nowrap">{config.label}</span>
              
              {#if active === view}
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              {/if}
            </button>

            {#if idx < tabs.length - 1 && active !== tabs[idx] && active !== tabs[idx + 1]}
              <div class="ui-main-tab-divider self-center h-4 w-px bg-gray-400/70 mb-0.5"></div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Logo + Label al centro -->
    <div class="absolute left-1/2 -translate-x-1/2 pb-1 flex items-center">
      <button 
        on:click={() => dispatch('reset')}
        class="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
        title="Clear current search session"
      >
        <img src="./logoVISIONE.png" alt="Visione Logo" class="h-7"/>
      </button>
    </div>

    <!-- Right side: controls -->
    <div class="flex items-center space-x-3 pb-0">
      <div class="relative pinned-dropdown-container">
        <button
          type="button"
          aria-label="Pinned items"
          title="Pinned items"
          class="ui-toolbar-btn ui-toolbar-settings p-2 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm hover:shadow-md relative"
          on:click|stopPropagation={() => isPinnedDropdownOpen = !isPinnedDropdownOpen}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5a3 3 0 0 1 6 0c0 1.37-.72 2.58-1.8 3.26l1.55 3.24h-5.5l1.55-3.24A3.93 3.93 0 0 1 9 5Z"/>
            <path d="M12 11.5v7.5"/>
            <path d="M10 15.5h4"/>
          </svg>
          {#if pinnedCount > 0}
            <span class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] leading-4 text-center font-semibold">{Math.min(pinnedCount, 99)}</span>
          {/if}
        </button>

        {#if isPinnedDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute right-0 top-full mt-2 w-64 rounded-lg shadow-xl border py-1 z-50">
            <div class="ui-position-menu-header px-3 py-2 border-b flex items-center justify-between">
              <span class="text-xs font-semibold">Pinned</span>
              {#if pinnedCount > 0}
                <button
                  type="button"
                  class="text-[11px] font-medium text-red-500 hover:text-red-400"
                  on:click={() => {
                    clearPinnedSummaries();
                    clearPinnedImages();
                  }}
                >
                  Clear
                </button>
              {/if}
            </div>

            {#if pinnedCount === 0}
              <div class="px-3 py-3 text-xs text-gray-500">No pinned items yet</div>
            {:else}
              {#if pinnedSummaries.length > 0}
                <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">Contexts</div>
                {#each pinnedSummaries as item}
                  <button
                    type="button"
                    class="ui-sort-option w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors text-left {summaryKey(item) === activePinnedSummaryKey ? 'ui-sort-option-active' : ''}"
                    on:click={() => openPinnedSummary(item)}
                    title={`Open ${item.label || item.videoId}`}
                  >
                    <span class="min-w-0 flex-1 text-xs truncate {summaryKey(item) === activePinnedSummaryKey ? 'text-blue-700 font-semibold' : ''}">{item.label || item.videoId}</span>
                    <span class="text-[10px] opacity-75 {summaryKey(item) === activePinnedSummaryKey ? 'text-blue-700' : ''}">{item.videoId}</span>
                    <span
                      role="button"
                      tabindex="0"
                      class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                      on:click={(event) => unpinSummary(event, item)}
                      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinSummary(event, item)}
                      aria-label={`Unpin ${item.label || item.videoId}`}
                      title="Unpin"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </span>
                  </button>
                {/each}
              {/if}

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
                    <span class="text-[10px] opacity-75">{item.imgId}</span>
                    <span
                      role="button"
                      tabindex="0"
                      class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                      on:click={(event) => unpinImage(event, item)}
                      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && unpinImage(event, item)}
                      aria-label={`Unpin ${item.label || item.imgId}`}
                      title="Unpin"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
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

      <!-- Grouping dropdown with sorting options -->
      {#if showViewModeRadios}
        <div class="flex items-center space-x-2">
          <div class="flex items-center gap-1.5 mr-3" title="Thumbnail size">
            <button
              type="button"
              class="ui-toolbar-btn w-9 h-9 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
              on:click={() => adjustKeyframeSize(10)}
              aria-label="Increase thumbnail size"
              title="Increase thumbnail size"
              disabled={keyframeSize >= 400}
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button
              type="button"
              class="ui-toolbar-btn w-9 h-9 rounded-full border border-gray-300 bg-white font-extrabold leading-none text-gray-700 hover:bg-blue-50 hover:border-blue-400 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm transition-all inline-flex items-center justify-center"
              on:click={() => adjustKeyframeSize(-10)}
              aria-label="Decrease thumbnail size"
              title="Decrease thumbnail size"
              disabled={keyframeSize <= 80}
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true">
                <path d="M5 12h14"/>
              </svg>
            </button>
          </div>

        <div class="relative group-dropdown-container">
          <button
            on:click|stopPropagation={() => isGroupDropdownOpen = !isGroupDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
            title="Group results"
            aria-label="Group results"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {@html currentSort.icon}
            </svg>
            <span class="text-xs font-medium text-gray-700">{currentSort.label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500 transition-transform {isGroupDropdownOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if isGroupDropdownOpen}
            <div class="ui-sort-dropdown-menu absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Grouping</div>
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="ui-sort-option w-full flex items-start space-x-3 px-3 py-2.5 hover:bg-blue-50 transition-colors
                         {viewMode === option.value ? 'bg-blue-50 ui-sort-option-active' : ''}"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mt-0.5 flex-shrink-0 {viewMode === option.value ? 'text-blue-600' : 'text-gray-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {@html option.icon}
                  </svg>
                  <div class="flex-1 text-left">
                    <div class="text-sm font-medium {viewMode === option.value ? 'text-blue-700' : 'text-gray-800'}">
                      {option.label}
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  {#if viewMode === option.value}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}

              <div class="my-1 border-t border-gray-200"></div>
              <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Sorting</div>
              {#each SORT_MODE_OPTIONS as option}
                <button
                  on:click={() => setSortMode(option.value)}
                  class="ui-sort-option w-full flex items-start space-x-3 px-3 py-2.5 hover:bg-blue-50 transition-colors
                         {sortMode === option.value ? 'bg-blue-50 ui-sort-option-active' : ''}"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mt-0.5 flex-shrink-0 {sortMode === option.value ? 'text-blue-600' : 'text-gray-500'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {@html option.icon}
                  </svg>
                  <div class="flex-1 text-left">
                    <div class="text-sm font-medium {sortMode === option.value ? 'text-blue-700' : 'text-gray-800'}">{option.label}</div>
                    <div class="text-xs text-gray-500 mt-0.5">{option.description}</div>
                  </div>
                  {#if sortMode === option.value}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        </div>
      {/if}

      <div class="relative challenge-dropdown-container ui-challenge-control" data-dres-enabled={dresEnabled ? 'true' : 'false'}>
        <button
          on:click|stopPropagation={toggleChallengeDropdown}
          class="ui-toolbar-btn ui-toolbar-sort flex items-center space-x-2 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all"
          title="Challenge type"
          aria-label="Challenge type"
        >
          <span class="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Challenge</span>
          <span class="text-xs font-semibold text-gray-800">{challengeType}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500 transition-transform {isChallengeDropdownOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {#if isChallengeDropdownOpen}
          <div class="ui-sort-dropdown-menu absolute right-0 top-full mt-2 w-72 rounded-lg shadow-xl border py-1 z-50">
            {#each challengeOptions as option}
              <button
                on:click={() => setChallengeType(option)}
                class="ui-sort-option w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors text-left {challengeType === option ? 'bg-blue-50 ui-sort-option-active' : ''}"
              >
                <span class="text-sm font-medium {challengeType === option ? 'text-blue-700' : 'text-gray-800'}">{option}</span>
                {#if challengeType === option}
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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

      <!-- Sidebar LEFT toggle -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar ui-left-sidebar-toggle p-2 rounded-lg transition-all duration-200 border shadow-sm
               {isSidebarOpen 
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
        title="{isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}"
        aria-label="{isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}"
        on:click={toggleSidebar}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="w-5 h-5 {isSidebarOpen ? '' : 'rotate-180'}" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <!-- Sidebar RIGHT toggle -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar ui-right-sidebar-toggle p-2 rounded-lg transition-all duration-200 border shadow-sm
               {isSidebarRightOpen 
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
        title="{isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}"
        aria-label="{isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}"
        on:click={toggleRightSidebar}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="w-5 h-5 {isSidebarRightOpen ? 'rotate-180' : ''}" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>

      <!-- Settings button -->
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        class="ui-toolbar-btn ui-toolbar-settings p-2 rounded-lg bg-white/60 hover:bg-white border border-gray-300 hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
        on:click={() => dispatch('openSettings')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" 
             class="w-5 h-5 text-gray-600 hover:text-blue-600 transition-colors" 
             viewBox="0 0 24 24"
             fill="none" 
             stroke="currentColor" 
             stroke-width="1.8" 
             stroke-linecap="round" 
             stroke-linejoin="round">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.69 0 1.31-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.5l.06.06c.47.47 1.15.61 1.82.33.56-.23.92-.78 1-1.39V2.5a2 2 0 1 1 4 0v.09c.08.6.44 1.16 1 1.39.67.28 1.35.14 1.82-.33l.06-.06A2 2 0 1 1 20.22 7l-.06.06c-.47.47-.61 1.15-.33 1.82.23.56.78.92 1.39 1H21a2 2 0 1 1 0 4h-.09c-.6.08-1.16.44-1.39 1z"/>
        </svg>
      </button>
    </div>
  </div>
</div>
