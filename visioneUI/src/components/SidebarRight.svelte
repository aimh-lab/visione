<script>
  import { createEventDispatcher } from "svelte";
  import RFLists from "./RFLists.svelte";
  import SubmittedList from "./SubmittedList.svelte";

  export let isOpen = true;
  export let activeTab = "RF";
  export let rfPositive = [];
  export let rfNegative = [];
  export let submittedImages = [];
  export let submittedAnswers = [];
  export let showSubmittedTab = false;
  export let challengeType = "KIS";
  export let submitTextAnswer = (_text) => {};
  export let width = 18;

  const dispatch = createEventDispatcher();

  const tabs = [
    { 
      id: "RF", 
      label: "RF",
      icon: `<path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/>`
    },
    { 
      id: "Submitted", 
      label: "Submitted",
      icon: `<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`
    }
  ];
  let qaAnswerText = "";
  $: visibleTabs = showSubmittedTab ? tabs : tabs.filter((tab) => tab.id !== "Submitted");
  $: if (!showSubmittedTab && activeTab === "Submitted") {
    activeTab = "RF";
    dispatch('selectTab', { tab: 'RF' });
  }

  function getTabCount(tabId) {
    if (tabId === "Submitted") {
      return challengeType === 'Q&A' ? submittedAnswers.length : submittedImages.length;
    }
    return 0;
  }

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
      {#each visibleTabs as tab}
        <button
          class="ui-sidebar-tab-btn flex-1 flex flex-col items-center justify-center px-2 py-2 rounded-lg font-medium text-xs transition-all duration-200
                 {activeTab === tab.id 
                   ? 'ui-sidebar-tab-btn-active bg-slate-600 text-white shadow-lg shadow-slate-700/30' 
                   : 'ui-sidebar-tab-btn-inactive bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
          on:click={() => selectTab(tab.id)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {@html tab.icon}
          </svg>
          <div class="flex items-center gap-1">
            <span class="text-[10px]">{tab.label}</span>
            {#if tab.id === "RF"}
              <span class="ui-feedback-count-badge ui-feedback-count-positive px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-green-900/25 border border-green-700/40">
                {rfPositive.length}
              </span>
              <span class="ui-feedback-count-badge ui-feedback-count-negative px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-red-900/25 border border-red-700/40">
                {rfNegative.length}
              </span>
            {:else}
              <span class="ui-tab-count-badge px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-black/25 border border-white/15 text-gray-200">
                {getTabCount(tab.id)}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {#if activeTab === "RF"}
        <div>
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
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3 class="text-sm font-semibold text-gray-200">
                {challengeType === "Q&A" ? "Submitted Answers" : "Submitted Frames"}
              </h3>
            </div>
            <span class="ui-tab-count-badge px-2 py-0.5 bg-slate-800/40 border border-slate-600/40 text-slate-200 text-xs font-medium rounded-full">{getTabCount("Submitted")}</span>
          </div>
          {#if challengeType !== "Q&A"}
            <SubmittedList
              {submittedImages}
              on:openFromSubmitted={handleOpenFromSubmitted}
            />
          {/if}

          {#if challengeType === "Q&A"}
            <div class="mt-4 p-3 bg-gray-900/40 border border-gray-700 rounded-lg space-y-2">
              <p class="text-xs font-semibold text-gray-300">Q&amp;A submission</p>
              <textarea
                class="w-full min-h-[72px] p-2 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your textual answer..."
                bind:value={qaAnswerText}
              ></textarea>
              <button
                class="w-full px-3 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={!qaAnswerText?.trim()}
                on:click={async () => {
                  const text = qaAnswerText.trim();
                  if (!text) return;
                  await submitTextAnswer(text);
                  qaAnswerText = "";
                }}
              >
                Submit answer
              </button>
            </div>

            {#if submittedAnswers.length > 0}
              <div class="mt-3 space-y-2">
                {#each submittedAnswers as answer}
                  {@const status = String(answer?.status ?? '').toUpperCase()}
                  <div class="p-2 rounded-md border border-gray-700 bg-gray-900/25">
                    <p class="text-xs text-gray-200 break-words">{answer?.text}</p>
                    <div class="mt-1 text-[10px] flex items-center justify-between">
                      <span class={status === 'FAILED' ? 'text-red-300' : status === 'PENDING' ? 'text-amber-300' : 'text-green-300'}>
                        {answer?.status || 'SUBMITTED'}
                      </span>
                      {#if answer?.verdict}
                        <span class="text-gray-400">{answer.verdict}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
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
    aria-label="Resize sidebar"
    tabindex="0"
  >
    {#if isOpen}
      <div class="hover-indicator-right"></div>
    {/if}
  </button>
    <button
      type="button"
      class="sidebar-toggle-tab sidebar-toggle-tab-right"
      on:click={toggleSidebar}
      aria-label={isOpen ? "Hide right sidebar" : "Show right sidebar"}
      title={isOpen ? "Hide sidebar" : "Show sidebar"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4 transition-transform duration-200 {isOpen ? '' : 'rotate-180'}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
</div>

<style>
.sidebar-right {
  height: 100%;
  flex-shrink: 0;
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
  background: rgba(100, 116, 139, 0.45);
}

.resize-handle-right.collapsed {
  width: 12px;
  background: rgba(100, 116, 139, 0.28);
  cursor: pointer;
}

.resize-handle-right.collapsed:hover {
  background: rgba(100, 116, 139, 0.5);
}

.hover-indicator-right {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 48px;
  background: rgba(100, 116, 139, 0.45);
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle-right:hover .hover-indicator-right {
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

.sidebar-toggle-tab-right {
  left: -10px;
  border-radius: 10px 0 0 10px;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.16);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.42);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.58);
}
</style>
