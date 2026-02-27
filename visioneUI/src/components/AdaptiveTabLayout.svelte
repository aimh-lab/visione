<script>
  import { createEventDispatcher } from 'svelte';
  import { tabsPosition } from '../stores/tabsPosition.js';
  import MainToolbar from './MainToolbar.svelte';
  
  export let active;
  export let tabs;
  export let isSidebarOpen;
  export let isSidebarRightOpen;
  export let viewMode;
  export let showViewModeRadios;
  export let keyframeSize = 130;
  
  const dispatch = createEventDispatcher();
  
  let showPositionMenu = false;
  let isSortDropdownOpen = false; // ✅ Per left/right
  
  // ✅ Sort options
  const sortOptions = [
    { 
      value: 'byrank', 
      label: 'By Rank', 
      icon: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`
    },
    { 
      value: 'byvideo', 
      label: 'By Video', 
      icon: `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`
    },
    { 
      value: 'bydate', 
      label: 'By Date', 
      icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
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
  
  $: currentSort = sortOptions.find(opt => opt.value === viewMode) || sortOptions[0];
  
  function setPosition(pos) {
    tabsPosition.set(pos);
    showPositionMenu = false;
  }
  
  function setMode(mode) {
    dispatch('changeViewMode', { mode });
    isSortDropdownOpen = false;
  }
  
  function handleClickOutside(event) {
    if (showPositionMenu && !event.target.closest('.position-menu-container')) {
      showPositionMenu = false;
    }
    if (isSortDropdownOpen && !event.target.closest('.sort-dropdown-container')) {
      isSortDropdownOpen = false;
    }
  }

  function handleWindowKeydown(event) {
    if (event.key !== 'Escape') return;
    showPositionMenu = false;
    isSortDropdownOpen = false;
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
        {keyframeSize}
        on:change
        on:toggleSidebar
        on:toggleRightSidebar 
        on:changeViewMode
        on:adjustKeyframeSize
        on:openSettings
        on:reset
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
        <div class="absolute top-12 left-3 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 position-menu-container">
          <div class="px-3 py-2 bg-gray-50 border-b">
            <span class="text-xs font-semibold text-gray-700">Tabs Position</span>
          </div>
          <button 
            on:click={() => setPosition('top')} 
            class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left
                   {$tabsPosition === 'top' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}"
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
            class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
          </button>
          <button 
            on:click={() => setPosition('right')} 
            class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
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
        <div class="absolute top-4 left-20 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 position-menu-container">
          <div class="px-3 py-2 bg-gray-50 border-b">
            <span class="text-xs font-semibold text-gray-700">Tabs Position</span>
          </div>
          <button on:click={() => setPosition('top')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="6" rx="1"/>
            </svg>
            <span class="text-sm">Top</span>
          </button>
          <button on:click={() => setPosition('left')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left bg-blue-50 text-blue-700">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
          </button>
          <button on:click={() => setPosition('right')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 transition-colors text-left">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
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
      
      <div class="flex-1"></div>
      
      <!-- ✅ Sort dropdown (solo se showViewModeRadios) -->
      {#if showViewModeRadios}
        <div class="relative sort-dropdown-container">
          <button
            on:click|stopPropagation={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg bg-white border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
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
            <div class="absolute bottom-0 left-20 mb-0 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 sort-dropdown-container">
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="w-full flex items-center space-x-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left
                         {viewMode === option.value ? 'bg-blue-50' : ''}"
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
        <div class="absolute top-4 right-20 bg-white rounded-lg shadow-xl border overflow-hidden z-50 position-menu-container">
          <div class="px-3 py-2 bg-gray-50 border-b">
            <span class="text-xs font-semibold text-gray-700">Tabs Position</span>
          </div>
          <button on:click={() => setPosition('top')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 text-left">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="6" rx="1"/>
            </svg>
            <span class="text-sm">Top</span>
          </button>
          <button on:click={() => setPosition('left')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 text-left">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="6" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Left</span>
          </button>
          <button on:click={() => setPosition('right')} class="w-full flex items-center space-x-2 px-4 py-2 hover:bg-blue-50 text-left bg-blue-50 text-blue-700">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="11" y="3" width="10" height="18" rx="1"/>
            </svg>
            <span class="text-sm">Right</span>
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
      
      <div class="flex-1"></div>
      
      <!-- ✅ Sort dropdown -->
      {#if showViewModeRadios}
        <div class="relative sort-dropdown-container">
          <button
            on:click|stopPropagation={() => isSortDropdownOpen = !isSortDropdownOpen}
            class="ui-toolbar-btn ui-toolbar-sort p-1.5 rounded-lg bg-white border border-gray-300 hover:border-blue-400 shadow-sm transition-all"
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
            <div class="absolute bottom-0 right-20 mb-0 w-48 bg-white rounded-lg shadow-xl border py-1 z-50 sort-dropdown-container">
              {#each sortOptions as option}
                <button
                  on:click={() => setMode(option.value)}
                  class="w-full flex items-center space-x-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left
                         {viewMode === option.value ? 'bg-blue-50' : ''}"
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
