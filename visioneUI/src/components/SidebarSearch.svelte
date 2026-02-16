<script>
  import { createEventDispatcher } from "svelte";
  import SearchControls from "../components/SearchControls.svelte";
  import TextareasManager from "./TextareasManager.svelte";
  import RecentSearches from "../components/RecentSearches.svelte";
  import QueryTemplatesPanel from './QueryTemplatesPanel.svelte';

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
  const clearResults = () => dispatch("clearResults");
  const handleSearchFromTextarea = () => dispatch("runSearch");
  const swapTA = (idxA, idxB) => {
    dispatch("swapTextarea", { indexA: idxA, indexB: idxB });
  };

  export function handleImageSelected(image) {
    textareasManagerRef?.handleImageSelected(image);
  }

  export function cancelImageSelection() {
    textareasManagerRef?.cancelSelection();
  }

  function handleSelectRecentSearch(e) {
    const { cachedResults, textareas: savedTextareas } = e.detail;

    if (cachedResults) {
      dispatch('loadCachedResults', { cachedResults });
    }

    const queries = (savedTextareas ?? [])
      .filter(t => t.enabled && t.value?.trim())
      .map(t => t.value.trim());

    applyQueriesToURLAndRestore(queries, 'View1');
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
    window.history.pushState({}, '', newUrl);

    dispatch('restoreFromURL');
  }

</script>


<svelte:window 
  on:mousemove={handleMouseMove} 
  on:mouseup={stopResize}
/>

<div 
  class="sidebar-left bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col shadow-2xl border-r border-gray-700 relative"
  style="width: {isSidebarOpen ? `${width}vw` : '12px'}; min-width: {isSidebarOpen ? '200px' : '12px'}; max-width: {isSidebarOpen ? '600px' : '12px'};"
>
  
  {#if isSidebarOpen}
    <!-- Header -->
    <div class="px-4 py-3 bg-gray-900/30 border-b border-gray-700 flex-shrink-0">
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <h2 class="text-lg font-bold text-white">Search</h2>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
      <div class="space-y-6">
        <!-- Query Builder -->
        <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700 shadow-lg">
          <div class="flex items-center space-x-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            <h3 class="text-sm font-bold text-white">Build Your Query</h3>
          </div>
          
          <TextareasManager
            bind:this={textareasManagerRef}
            {textareas}
            availableImages={images}
            {textareaImages}
            on:updateImages={(e) => dispatch('updateImages', e.detail)}
            on:add={(e) => addTA(e.detail.index)}
            on:remove={(e) => removeTA(e.detail.index)}
            on:toggle={(e) => toggleTA(e.detail.index)}
            on:update={(e) => updateTA(e.detail.index, e.detail.value)}
            on:search={handleSearchFromTextarea}
            on:swap={(e) => {
              swapTA(e.detail.indexA, e.detail.indexB);
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
          
          <!-- Search button -->
          <button
            on:click={doSearch}
            disabled={searchLoading}
            class="w-full mt-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
                   text-white font-bold rounded-lg shadow-xl hover:shadow-2xl 
                   transform hover:scale-[1.02] active:scale-[0.98] 
                   transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center space-x-2"
          >
            {#if searchLoading}
              <svg class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" opacity="0.3"/>
                <path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/>
              </svg>
              <span>Searching...</span>
            {:else}
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <span>Search Videos</span>
            {/if}
          </button>
          
          <!-- Clear button -->
          {#if searchResultSet}
            <button
              on:click={clearResults}
              class="w-full mt-2 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-all"
            >
              Clear Results
            </button>
          {/if}
        </div>

        <!-- Recent Searches -->
        {#if !searchLoading}
          <div class="pt-4 border-t border-gray-700/50">
            <div class="flex items-center space-x-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h4 class="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent</h4>
            </div>
            <RecentSearches 
              show={true}
              on:select={(e) => {
                  handleSelectRecentSearch(e);
                }}            />
          </div>
        {/if}

        <QueryTemplatesPanel
          {textareas}
          onLoad={(queries) => applyQueriesToURLAndRestore(queries, 'View1')}
          onRunSearch={() => {}}
        />




        <!-- Error state -->
        {#if searchError}
          <div class="bg-red-900/20 border border-red-700 rounded-lg p-3">
            <div class="flex items-start space-x-2">
              <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <h5 class="text-sm font-semibold text-red-300 mb-1">Search Error</h5>
                <p class="text-xs text-red-400">{searchError}</p>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ✅ RESIZE HANDLE - sempre visibile, FUORI dall'if -->
  <button
    type="button"
    class="resize-handle"
    class:collapsed={!isSidebarOpen}
    on:mousedown={startResize}
    on:dblclick={toggleSidebar}
    aria-label="Resize sidebar"
    tabindex="0"
  >
    {#if isSidebarOpen}
      <div class="hover-indicator"></div>
    {/if}
  </button>
</div>

<style>
.sidebar-left {
  height: 100%;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  background: rgba(59, 130, 246, 0.5);
}

.resize-handle.collapsed {
  width: 10px;
  background: rgba(59, 130, 246, 0.3);
  cursor: pointer;
}

.resize-handle.collapsed:hover {
  background: rgba(59, 130, 246, 0.6);
}

.hover-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 48px;
  background: rgba(59, 130, 246, 0.5);
  border-radius: 4px 0 0 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle:hover .hover-indicator {
  opacity: 1;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 12px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.5);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.7);
}
</style>
