<script>
  import { createEventDispatcher } from "svelte";

  export let active = "View1";
  export let tabs = ["View1", "View2", "Similarity"];
  
  export let isSidebarOpen = true;
  export let isSidebarRightOpen = true; // ✅ NUOVO
  export let viewMode = "byrank";
  export let showViewModeRadios = false;
  
  const dispatch = createEventDispatcher();
  
  let isSortDropdownOpen = false;
  
  const sortOptions = [
    { 
      value: 'byrank', 
      label: 'By Rank', 
      icon: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
      description: 'Sort results by relevance score'
    },
    { 
      value: 'byvideo', 
      label: 'By Video', 
      icon: `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
      description: 'Group results by video ID'
    },
    { 
      value: 'bydate', 
      label: 'By Date', 
      icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      description: 'Sort by creation date'
    }
  ];
  
  const tabConfig = {
    View1: {
      label: "Search",
      icon: `<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>`
    },
    View2: {
      label: "Video Summary",
      icon: `<path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>`
    },
    Similarity: {
      label: "Image Similarity",
      icon: `<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>`
    }
  };
  
  const getConfig = (view) => tabConfig[view] || { label: view, icon: null };
  const toggleSidebar = () => dispatch("toggleSidebar");
  const toggleRightSidebar = () => dispatch("toggleRightSidebar"); // ✅ NUOVO
  const setMode = (mode) => {
    dispatch("changeViewMode", { mode });
    isSortDropdownOpen = false;
  };
  
  $: currentSort = sortOptions.find(opt => opt.value === viewMode) || sortOptions[0];
  
  function handleClickOutside(event) {
    if (isSortDropdownOpen && !event.target.closest('.sort-dropdown-container')) {
      isSortDropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="w-full bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-300 shadow-sm">
  <div class="w-full px-4 flex items-end justify-between relative">
    <!-- Tab buttons (left) -->
    <div class="ui-main-tab-strip ml-8 flex items-end space-x-1 p-1 rounded-t-xl border border-gray-300 bg-gray-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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
      <!-- Sort by dropdown -->
      {#if showViewModeRadios}
        <div class="relative sort-dropdown-container">
          <button
            on:click|stopPropagation={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5h10"/>
              <path d="M11 12h7"/>
              <path d="M11 19h4"/>
              <path d="M4 17l-2 2 2 2"/>
              <path d="M2 19h5"/>
              <path d="M6 7l2-2 2 2"/>
              <path d="M8 5v14"/>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {@html currentSort.icon}
            </svg>
            <span class="text-xs font-medium text-gray-700">{currentSort.label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500 transition-transform {isSortDropdownOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if isSortDropdownOpen}
            <div class="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="w-full flex items-start space-x-3 px-3 py-2.5 hover:bg-blue-50 transition-colors
                         {viewMode === option.value ? 'bg-blue-50' : ''}"
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
            </div>
          {/if}
        </div>
      {/if}

      <!-- ✅ Sidebar LEFT toggle -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar p-2 rounded-lg transition-all duration-200 border shadow-sm
               {isSidebarOpen 
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
        title="{isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}"
        aria-label="{isSidebarOpen ? 'Hide left sidebar' : 'Show left sidebar'}"
        on:click={toggleSidebar}
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
      </button>

      <!-- ✅ Sidebar RIGHT toggle (NUOVO) -->
      <button
        class="ui-toolbar-btn ui-toolbar-sidebar p-2 rounded-lg transition-all duration-200 border shadow-sm
               {isSidebarRightOpen 
                 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                 : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
        title="{isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}"
        aria-label="{isSidebarRightOpen ? 'Hide right sidebar' : 'Show right sidebar'}"
        on:click={toggleRightSidebar}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="w-5 h-5 transition-transform duration-300 {isSidebarRightOpen ? 'rotate-180' : ''}" 
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
