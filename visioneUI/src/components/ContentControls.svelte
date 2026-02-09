<script>
  import { createEventDispatcher } from "svelte";
  export let isSidebarOpen = true;
  export let viewMode = "byrank";
  export let showViewModeRadios = false;


  const dispatch = createEventDispatcher();
  const toggleSidebar = () => dispatch("toggleSidebar");
  const setMode = (mode) => dispatch("changeViewMode", { mode });
</script>


<div class="content-controls flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
  <!-- Sidebar toggle button -->
  <button
    class="flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
           {isSidebarOpen 
             ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' 
             : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}"
    title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
    on:click={toggleSidebar}
    aria-pressed={isSidebarOpen}
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      class="w-5 h-5 transition-transform duration-300 {isSidebarOpen ? '' : 'rotate-180'}" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
    </svg>
    <span class="hidden sm:inline">
      {isSidebarOpen ? 'Hide' : 'Show'} Sidebar
    </span>
  </button>


  <!-- View mode selector -->
  {#if showViewModeRadios}
    <div class="flex items-center space-x-2">
      <span class="text-xs font-medium text-gray-500 mr-2">View:</span>
      
      <div class="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
        <button
          class="relative px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                 {viewMode === 'byrank' 
                   ? 'bg-white text-blue-700 shadow-sm' 
                   : 'text-gray-600 hover:text-gray-800'}"
          on:click={() => setMode('byrank')}
        >
          <div class="flex items-center space-x-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>By Rank</span>
          </div>
        </button>


        <button
          class="relative px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                 {viewMode === 'byvideo' 
                   ? 'bg-white text-blue-700 shadow-sm' 
                   : 'text-gray-600 hover:text-gray-800'}"
          on:click={() => setMode('byvideo')}
        >
          <div class="flex items-center space-x-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span>By Video</span>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>


<style>
  .content-controls {
    min-height: 52px;
  }
</style>