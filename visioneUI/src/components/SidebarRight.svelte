<script>
  import { createEventDispatcher } from "svelte";
  import RFLists from "./RFLists.svelte";
  import SubmittedList from "./SubmittedList.svelte";

  export let isOpen = true;
  export let activeTab = "RF";
  export let rfPositive = [];
  export let rfNegative = [];
  export let submittedImages = [];
  export let width = 18;

  const dispatch = createEventDispatcher();

  const tabs = [
    { 
      id: "RF", 
      label: "Feedback",
      icon: `<path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>`
    },
    { 
      id: "Submitted", 
      label: "Submitted",
      icon: `<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`
    }
  ];

  function selectTab(tab) {
    activeTab = tab;
    dispatch('selectTab', { tab }); 
  }

  function handleRemovePositive(e) {
    dispatch("removePositive", e.detail);
  }

  function handleRemoveNegative(e) {
    dispatch("removeNegative", e.detail);
  }

  function handleOpenFromRF(e) {
    dispatch("openFromRF", e.detail);
  }

  function handleOpenFromSubmitted(e) {
    dispatch("openFromSubmitted", e.detail);
  }

  // ✅ Resize logic
  let isResizing = false;

  function startResize(e) {
    if (!isOpen) return; // ✅ Non resizare se chiusa
    isResizing = true;
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const viewportWidth = window.innerWidth;
    const mouseX = e.clientX;
    const newWidthPx = viewportWidth - mouseX;
    const newWidthVw = (newWidthPx / viewportWidth) * 100;
    
    width = Math.max(12, Math.min(40, newWidthVw));
    dispatch('resize', { width });
  }

  function stopResize() {
    isResizing = false;
  }

  // ✅ Toggle sidebar
  function toggleSidebar() {
    dispatch('toggleRightSidebar');
  }
</script>

<svelte:window 
  on:mousemove={handleMouseMove} 
  on:mouseup={stopResize}
/>

<div 
  class="sidebar-right bg-gradient-to-b from-gray-900 to-gray-800 text-white flex shadow-2xl border-l border-gray-700 relative"
  style="width: {isOpen ? `${width}vw` : '12px'}; min-width: {isOpen ? '200px' : '12px'}; max-width: {isOpen ? '600px' : '12px'};"
>
  
  {#if isOpen}
    <!-- Tabs Navigation -->
    <div class="flex px-2 py-2 space-x-1 bg-gray-900/30 border-b border-gray-700 flex-shrink-0">
      {#each tabs as tab}
        <button
          class="flex-1 flex flex-col items-center justify-center px-2 py-2 rounded-lg font-medium text-xs transition-all duration-200
                 {activeTab === tab.id 
                   ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                   : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
          on:click={() => selectTab(tab.id)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {@html tab.icon}
          </svg>
          <span class="text-[10px]">{tab.label}</span>
        </button>
      {/each}
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {#if activeTab === "RF"}
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>
              </svg>
              <h3 class="text-sm font-semibold text-gray-200">Relevance Feedback</h3>
            </div>
            <div class="flex items-center space-x-1">
              <span class="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-full">{rfPositive.length}</span>
              <span class="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs font-medium rounded-full">{rfNegative.length}</span>
            </div>
          </div>
          <RFLists
            {rfPositive}
            {rfNegative}
            on:openFromRF={handleOpenFromRF}
            on:removePositive={handleRemovePositive}
            on:removeNegative={handleRemoveNegative}
          />
        </div>

      {:else if activeTab === "Submitted"}
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3 class="text-sm font-semibold text-gray-200">Submitted Frames</h3>
            </div>
            <span class="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full">{submittedImages.length}</span>
          </div>
          <SubmittedList
            {submittedImages}
            on:openFromSubmitted={handleOpenFromSubmitted}
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- ✅ RESIZE HANDLE - sempre visibile, FUORI dall'if -->
  <button
    type="button"
    class="resize-handle-right"
    class:collapsed={!isOpen}
    on:mousedown={startResize}
    on:dblclick={toggleSidebar}
    aria-label="Resize sidebar"
    tabindex="0"
  >
    {#if isOpen}
      <div class="hover-indicator-right"></div>
    {/if}
  </button>
</div>

<style>
.sidebar-right {
  height: 100%;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.resize-handle-right {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: ew-resize;
  transition: all 0.2s;
  z-index: 50;
}

.resize-handle-right:not(.collapsed) {
  width: 4px;
  background: transparent;
}

.resize-handle-right:not(.collapsed):hover {
  width: 12px;
  background: rgba(59, 130, 246, 0.5);
}

.resize-handle-right.collapsed {
  width: 12px;
  background: rgba(59, 130, 246, 0.3);
  cursor: pointer;
}

.resize-handle-right.collapsed:hover {
  background: rgba(59, 130, 246, 0.6);
}

.hover-indicator-right {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 48px;
  background: rgba(59, 130, 246, 0.5);
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle-right:hover .hover-indicator-right {
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
