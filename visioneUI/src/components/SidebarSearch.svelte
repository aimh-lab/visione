<script>
  import { createEventDispatcher } from "svelte";
  import { pushState } from "$app/navigation";
  import SearchControls from "../components/SearchControls.svelte";
  import TextareasManager from "./TextareasManager.svelte";
  import RecentSearches from "../components/RecentSearches.svelte";
  import QueryTemplatesPanel from './QueryTemplatesPanel.svelte';
  import { recentSearches } from "../stores/recentSearches.js";
  import { queryTemplates } from "../stores/queryTemplates.js";

  export let isSidebarOpen = true;
  export let textareas = [];
  export let searchLoading = false;
  export let searchError = null;
  export let searchResultSet = null;
  export let width = 18;
  export let images = []; 
  export let textareaImages = {}; // ✅ AGGIUNTO: ricevuto dal padre

  
  let isSelectingImage = false;
  let selectingForTextarea = null;
  let textareasManagerRef;

  const dispatch = createEventDispatcher();

  const addTA = (i) => dispatch("addTextarea", { index: i });
  const removeTA = (i) => dispatch("removeTextarea", { index: i });
  const toggleTA = (i) => dispatch("toggleTextarea", { index: i });
  const updateTA = (i, value) => dispatch("updateTextarea", { index: i, value });
  const doSearch = () => dispatch("runSearch");
  const clearQueryInputs = () => dispatch("clearQueryInputs");
  const handleSearchFromTextarea = () => dispatch("runSearch");
  let isResetMenuOpen = false;
  let activeUtilityPanel = null;

  function toggleUtilityPanel(panel) {
    activeUtilityPanel = activeUtilityPanel === panel ? null : panel;
  }

  function toggleResetMenu(e) {
    e.stopPropagation();
    isResetMenuOpen = !isResetMenuOpen;
  }

  function handleResetQuery(e) {
    e?.stopPropagation?.();
    clearQueryInputs();
    isResetMenuOpen = false;
  }

  function handleWindowClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.query-reset-menu')) {
      isResetMenuOpen = false;
    }
    if (!target.closest('.utility-panel-container')) {
      activeUtilityPanel = null;
    }
  }

  function handleWindowKeydown(e) {
    if (e.key !== 'Escape') return;
    isResetMenuOpen = false;
    activeUtilityPanel = null;
  }
  const swapTA = (idxA, idxB, mode = "swap") => {
    dispatch("swapTextarea", { indexA: idxA, indexB: idxB, mode });
  };

  export function handleImageSelected(image) {
    textareasManagerRef?.handleImageSelected(image);
  }

  export function cancelImageSelection() {
    textareasManagerRef?.cancelSelection();
  }

  export function focusSearchInput() {
    textareasManagerRef?.focusPrimaryTextarea();
  }

  function handleSelectRecentSearch(e) {
    const { textareas: savedTextareas } = e.detail;

    // Restore the exact saved query state so similarity steps are preserved.
    if (Array.isArray(savedTextareas) && savedTextareas.length > 0) {
      dispatch('restoreRecentSearch', { textareas: savedTextareas });
      return;
    }

    // Fallback for legacy entries without structured textarea payload.
    const query = String(e?.detail?.query || '').trim();
    if (query) {
      applyQueriesToURLAndRestore([query], 'View1');
    }
  }


  // ✅ Resize logic
  let isResizing = false;

  function startResize(e) {
    if (!isSidebarOpen) return;
    isResizing = true;
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const viewportWidth = window.innerWidth;
    const mouseX = e.clientX;
    const newWidthPx = mouseX;
    const newWidthVw = (newWidthPx / viewportWidth) * 100;
    
    width = Math.max(12, Math.min(40, newWidthVw));
    dispatch('resize', { width });
  }

  function stopResize() {
    isResizing = false;
  }

  function toggleSidebar() {
    dispatch('toggleSidebar');
  }

  function applyQueriesToURLAndRestore(queries, tab = 'View1') {
    const joined = (queries ?? [])
      .map(q => (typeof q === 'string' ? q.trim() : ''))
      .filter(Boolean)
      .join('|');

    const params = new URLSearchParams();
    params.set('q', joined);
    params.set('tab', tab);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    pushState(newUrl, {});

    dispatch('restoreFromURL');
  }

</script>


<svelte:window 
  on:mousemove={handleMouseMove} 
  on:mouseup={stopResize}
  on:click={handleWindowClick}
  on:keydown={handleWindowKeydown}
/>

<div 
  class="sidebar-left bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col shadow-2xl border-r border-gray-700 relative"
  style="width: {isSidebarOpen ? `${width}vw` : '12px'}; min-width: {isSidebarOpen ? '200px' : '12px'}; max-width: {isSidebarOpen ? '600px' : '12px'};"
>
  
  {#if isSidebarOpen}
    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        <!-- Query Builder -->
        <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700 shadow-lg">
          <div class="flex items-center space-x-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 2"/>
              <path d="M3 12h2M19 12h2"/>
            </svg>
            <h3 class="text-xs font-bold text-white uppercase tracking-wide">Temporal Query</h3>
            <div class="relative group/info ml-0.5">
              <button
                type="button"
                class="w-4 h-4 rounded-full border border-slate-500/70 text-slate-300 text-[10px] font-bold inline-flex items-center justify-center hover:bg-slate-600/20 transition-colors"
                aria-label="Temporal sequence search info"
                title="Temporal Sequence Search"
              >
                i
              </button>
              <div class="absolute right-0 top-full mt-1 hidden group-hover/info:block z-40 w-36 max-w-[calc(100vw-3rem)] rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-[10px] leading-snug text-gray-200 shadow-xl">
                <p class="font-semibold text-slate-200 mb-0.5">Temporal Sequence Search</p>
                <p>Find videos where scenes appear in order over time.</p>
              </div>
            </div>
          </div>
          
          <TextareasManager
            bind:this={textareasManagerRef}
            {textareas}
            availableImages={images}
            {textareaImages}
            on:updateImages={(e) => dispatch('updateImages', e.detail)}
            on:replaceSimilarityImage={(e) => dispatch('replaceSimilarityImage', e.detail)}
            on:closeSimilarityStep={(e) => dispatch('closeSimilarityStep', e.detail)}
            on:add={(e) => addTA(e.detail.index)}
            on:remove={(e) => removeTA(e.detail.index)}
            on:toggle={(e) => toggleTA(e.detail.index)}
            on:update={(e) => updateTA(e.detail.index, e.detail.value)}
            on:restoreDisabledSteps={() => dispatch('restoreDisabledSteps')}
            on:search={handleSearchFromTextarea}
            on:swap={(e) => {
              swapTA(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap');
            }}
              on:startImageSelection
              on:imageSelected
          />

          <!-- ✅ NUOVO: Banner informativo durante la selezione -->
          {#if isSelectingImage}
            <div class="sticky top-0 z-50 bg-green-600 text-white px-4 py-3 shadow-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <svg class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <div>
                    <p class="text-sm font-bold">Image Selection Mode</p>
                    <p class="text-xs opacity-90">Click any result to add it to query step {selectingForTextarea + 1}</p>
                  </div>
                </div>
                <button
                  on:click={handleCancelImageSelection}
                  class="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}
          
          <div class="mt-3 pl-8 flex items-center gap-2">
            <button
              on:click={doSearch}
              disabled={searchLoading}
              class="ui-search-run-btn {searchResultSet ? 'flex-1' : 'w-full'} py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                     text-white font-bold rounded-lg shadow-xl hover:shadow-2xl 
                     transform hover:scale-[1.02] active:scale-[0.98] 
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm
                     flex items-center justify-center space-x-2"
            >
              {#if searchLoading}
                <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" opacity="0.3"/>
                  <path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/>
                </svg>
                <span>Searching...</span>
              {:else}
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <span>Search</span>
              {/if}
            </button>

            {#if searchResultSet}
              <div class="relative query-reset-menu">
                <button
                  type="button"
                  on:click={toggleResetMenu}
                  class="inline-flex items-center justify-center px-2.5 py-2.5 bg-gray-700/50 hover:bg-red-900/35 text-gray-200 hover:text-red-100 text-sm rounded-lg border border-gray-600/60 hover:border-red-700/50 transition-all"
                  title="Reset query"
                  aria-label="Reset query"
                  aria-haspopup="menu"
                  aria-expanded={isResetMenuOpen}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0115.55-6.36"/>
                    <path d="M21 3v6h-6"/>
                    <path d="M21 12a9 9 0 01-15.55 6.36"/>
                    <path d="M3 21v-6h6"/>
                  </svg>
                </button>

                {#if isResetMenuOpen}
                  <div class="absolute right-0 mt-1 w-40 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-40 p-1" role="menu">
                    <button
                      type="button"
                      on:click={handleResetQuery}
                      class="w-full text-left px-2.5 py-2 rounded-md text-sm text-red-200 hover:text-red-100 hover:bg-red-900/30 transition-colors inline-flex items-center gap-2"
                      role="menuitem"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 0115.55-6.36"/>
                        <path d="M21 3v6h-6"/>
                        <path d="M21 12a9 9 0 01-15.55 6.36"/>
                        <path d="M3 21v-6h6"/>
                      </svg>
                      Reset query
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Recent + Templates compact row -->
        {#if !searchLoading}
          <div class="pt-3 border-t border-gray-700/50 space-y-2 utility-panel-container">
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                on:click={() => toggleUtilityPanel('recent')}
                disabled={$recentSearches.length === 0}
                class="inline-flex items-center justify-start gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all
                       {activeUtilityPanel === 'recent'
                         ? 'bg-blue-900/25 text-blue-200'
                         : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'}
                       {$recentSearches.length === 0 ? 'opacity-55 cursor-not-allowed' : ''}"
                aria-pressed={activeUtilityPanel === 'recent'}
              >
                <span class="truncate inline-flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 2"/>
                  </svg>
                  Recent
                </span>
                <span class="px-1.5 py-0.5 rounded-full bg-blue-950/40 text-[10px] text-blue-200 leading-none">{$recentSearches.length}</span>
              </button>

              <button
                type="button"
                on:click={() => toggleUtilityPanel('templates')}
                class="inline-flex items-center justify-start gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all
                       {activeUtilityPanel === 'templates'
                         ? 'bg-blue-900/25 text-blue-200'
                         : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'}"
                aria-pressed={activeUtilityPanel === 'templates'}
              >
                <span class="truncate inline-flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h7v7H4z"/>
                    <path d="M13 4h7v7h-7z"/>
                    <path d="M4 13h7v7H4z"/>
                    <path d="M13 13h7v7h-7z"/>
                  </svg>
                  Templates
                </span>
                <span class="px-1.5 py-0.5 rounded-full bg-blue-950/40 text-[10px] text-blue-200 leading-none">{$queryTemplates.length}</span>
              </button>
            </div>

            {#if activeUtilityPanel === 'recent'}
              <RecentSearches
                show={true}
                headerless={true}
                expanded={true}
                on:select={(e) => {
                  handleSelectRecentSearch(e);
                }}
              />
            {/if}

            {#if activeUtilityPanel === 'templates'}
              <QueryTemplatesPanel
                {textareas}
                headerless={true}
                expanded={true}
                onLoad={(queries) => applyQueriesToURLAndRestore(queries, 'View1')}
              />
            {/if}
          </div>
        {/if}




        <!-- Error state -->
        {#if searchError}
          <div class="bg-red-900/20 border border-red-700 rounded-lg p-2.5">
            <div class="flex items-start space-x-2">
              <svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <h5 class="text-xs font-semibold text-red-300 mb-0.5">Search Error</h5>
                <p class="text-xs text-red-400">{searchError}</p>
              </div>
            </div>
          </div>
        {/if}
    </div>
  {/if}

  <!-- ✅ RESIZE HANDLE - sempre visibile, FUORI dall'if -->
  <button
    type="button"
    class="resize-handle"
    class:collapsed={!isSidebarOpen}
    on:mousedown={startResize}
    aria-label="Resize sidebar"
    tabindex="0"
  >
    {#if isSidebarOpen}
      <div class="hover-indicator"></div>
    {/if}
  </button>

  <button
    type="button"
    class="sidebar-toggle-tab sidebar-toggle-tab-left"
    on:click={toggleSidebar}
    aria-label={isSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}
    title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4 transition-transform duration-200 {isSidebarOpen ? '' : 'rotate-180'}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
    >
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  </button>
</div>

<style>
.sidebar-left {
  height: 100%;
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: ew-resize;
  transition: all 0.2s;
  z-index: 50;
}

.resize-handle:not(.collapsed) {
  width: 4px;
  background: transparent;
}

.resize-handle:not(.collapsed):hover {
  width: 10px;
  background: rgba(100, 116, 139, 0.45);
}

.resize-handle.collapsed {
  width: 10px;
  background: rgba(100, 116, 139, 0.28);
  cursor: pointer;
}

.resize-handle.collapsed:hover {
  background: rgba(100, 116, 139, 0.5);
}

.hover-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 48px;
  background: rgba(100, 116, 139, 0.45);
  border-radius: 4px 0 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle:hover .hover-indicator {
  opacity: 1;
}

.sidebar-toggle-tab {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 70px;
  border: 1px solid var(--ui-sidebar-toggle-border);
  background: linear-gradient(180deg, var(--ui-sidebar-toggle-bg-start) 0%, var(--ui-sidebar-toggle-bg-end) 100%);
  color: var(--ui-sidebar-toggle-text);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  cursor: pointer;
  box-shadow: var(--ui-sidebar-toggle-shadow);
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.sidebar-toggle-tab:hover {
  background: linear-gradient(180deg, var(--ui-sidebar-toggle-hover-bg-start) 0%, var(--ui-sidebar-toggle-hover-bg-end) 100%);
  color: var(--ui-sidebar-toggle-hover-text);
  border-color: var(--ui-sidebar-toggle-hover-border);
  box-shadow: var(--ui-sidebar-toggle-hover-shadow);
}

.sidebar-toggle-tab:focus-visible {
  outline: 2px solid var(--ui-sidebar-toggle-focus);
  outline-offset: 2px;
}

.sidebar-toggle-tab-left {
  right: -10px;
  border-radius: 0 10px 10px 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.45);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.6);
}
</style>
