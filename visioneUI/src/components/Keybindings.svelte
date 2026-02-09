<script>
  import { onMount, onDestroy } from "svelte";

  // Existing props
  export let isModalOpen = false;
  export let onMoveSelection = (delta) => {};
  export let onMoveSelectionRows = (deltaRows) => {};
  export let onOpenAtSelected = () => {};
  export let onNavigateImage = (offset) => {};
  export let onCloseModal = () => {};

  // New callbacks for shortcuts
  export let onFocusSearch = () => {};
  export let onSwitchTab = (tab) => {};
  export let onSubmitSelected = () => {};
  export let onToggleSidebar = () => {};
  export let onOpenSettings = () => {};
  export let onRFPositiveSelected = () => {};
  export let onRFNegativeSelected = () => {};
  export let onSimilaritySelected = () => {};
  export let onVideoSummarySelected = () => {};

  let showHelp = false;
  let lastAction = '';
  let actionTimeout;

  const isTypingTarget = (el) => {
    const t = el?.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el?.isContentEditable;
  };

  function showActionFeedback(action) {
    lastAction = action;
    clearTimeout(actionTimeout);
    actionTimeout = setTimeout(() => {
      lastAction = '';
    }, 1500);
  }

  function handleKeyDown(e) {
    // Help overlay toggle
    if (e.key === '?' && !isTypingTarget(e.target)) {
      e.preventDefault();
      showHelp = !showHelp;
      return;
    }

    // Close help on Escape
    if (showHelp && e.key === 'Escape') {
      e.preventDefault();
      showHelp = false;
      return;
    }

    if (isTypingTarget(e.target) && !showHelp) return;

    // Modal shortcuts
    if (isModalOpen) {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Escape","Enter"," "].includes(e.key)) {
        e.preventDefault();
      }
      
      if (e.key === "ArrowLeft") {
        onNavigateImage(-1);
        showActionFeedback('Previous frame');
      }
      else if (e.key === "ArrowRight") {
        onNavigateImage(1);
        showActionFeedback('Next frame');
      }
      else if (e.key === "ArrowUp") {
        // ✅ Vai al primo della riga sopra
        onNavigateImage(-1, true); // offset -1, toFirstOfRow true
        showActionFeedback('Row up');
      }
      else if (e.key === "ArrowDown") {
        // ✅ Vai al primo della riga sotto
        onNavigateImage(1, true); // offset 1, toFirstOfRow true
        showActionFeedback('Row down');
      }
      else if (e.key === "Escape") {
        onCloseModal();
        showActionFeedback('Closed modal');
      }
      return;
    }

    // Global shortcuts (when no modal is open)
    
    // Ctrl/Cmd + F: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      onFocusSearch();
      showActionFeedback('Search focused');
      return;
    }

    // Ctrl/Cmd + K: Open settings
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onOpenSettings();
      showActionFeedback('Settings opened');
      return;
    }

    // 1/2/3: Switch tabs
    if (['1', '2', '3'].includes(e.key) && !isTypingTarget(e.target)) {
      e.preventDefault();
      const tabs = { '1': 'View1', '2': 'View2', '3': 'Similarity' };
      onSwitchTab(tabs[e.key]);
      showActionFeedback(`Switched to tab ${e.key}`);
      return;
    }

    // S: Submit selected
    if (e.key === 's' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onSubmitSelected();
      showActionFeedback('Submitted frame');
      return;
    }

    // T: Toggle sidebar
    if (e.key === 't' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onToggleSidebar();
      showActionFeedback('Toggled sidebar');
      return;
    }

    // P: Add to RF Positive
    if (e.key === 'p' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onRFPositiveSelected();
      showActionFeedback('Added to RF Positive');
      return;
    }

    // N: Add to RF Negative
    if (e.key === 'n' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onRFNegativeSelected();
      showActionFeedback('Added to RF Negative');
      return;
    }

    // I: Similarity search on selected
    if (e.key === 'i' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onSimilaritySelected();
      showActionFeedback('Similarity search started');
      return;
    }

    // V: Video summary on selected
    if (e.key === 'v' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onVideoSummarySelected();
      showActionFeedback('Video summary opened');
      return;
    }

    // ✅ CODICE NUOVO: frecce aprono modal se chiusa
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"," "].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      // ✅ Le frecce APRONO modal (non muovono selezione)
      onOpenAtSelected();
      showActionFeedback('Opened frame');
    }
    else if (e.key === "Enter" || e.key === " ") {
      onOpenAtSelected();
      showActionFeedback('Opened frame details');
    }

  }

  onMount(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
    clearTimeout(actionTimeout);
  });
</script>

<!-- Action feedback toast -->
{#if lastAction}
  <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
    <div class="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-xl border border-gray-700">
      {lastAction}
    </div>
  </div>
{/if}

<!-- Help overlay -->
{#if showHelp}
  <div class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm" on:click={() => (showHelp = false)}>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto" on:click|stopPropagation>
      <!-- Header -->
      <div class="sticky top-0 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <h2 class="text-2xl font-bold text-gray-800">Keyboard Shortcuts</h2>
        </div>
        <button on:click={() => (showHelp = false)} class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- General -->
        <div>
          <h3 class="text-lg font-semibold text-gray-800 mb-3">General</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Show this help</span>
              <kbd class="kbd">?</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Focus search box</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Ctrl</kbd><span class="text-gray-400">+</span><kbd class="kbd">F</kbd>
              </div>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Open settings</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Ctrl</kbd><span class="text-gray-400">+</span><kbd class="kbd">K</kbd>
              </div>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Toggle sidebar</span>
              <kbd class="kbd">T</kbd>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div>
          <h3 class="text-lg font-semibold text-gray-800 mb-3">Navigation</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Switch to Search</span>
              <kbd class="kbd">1</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Switch to Video Summary</span>
              <kbd class="kbd">2</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Switch to Similarity</span>
              <kbd class="kbd">3</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Move selection</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">←</kbd><kbd class="kbd">↑</kbd><kbd class="kbd">→</kbd><kbd class="kbd">↓</kbd>
              </div>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Open selected frame</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Enter</kbd><span class="text-gray-400">or</span><kbd class="kbd">Space</kbd>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div>
          <h3 class="text-lg font-semibold text-gray-800 mb-3">Actions</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Submit selected frame</span>
              <kbd class="kbd">S</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Add to RF Positive</span>
              <kbd class="kbd">P</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Add to RF Negative</span>
              <kbd class="kbd">N</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Image similarity search</span>
              <kbd class="kbd">I</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Video summary</span>
              <kbd class="kbd">V</kbd>
            </div>
          </div>
        </div>

        <!-- Modal -->
        <div>
          <h3 class="text-lg font-semibold text-gray-800 mb-3">In Modal</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Close modal</span>
              <kbd class="kbd">Esc</kbd>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Navigate frames</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">←</kbd><kbd class="kbd">→</kbd>
              </div>
            </div>
            <div class="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
              <span class="text-gray-700">Navigate rows</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 text-center">
        <p class="text-sm text-gray-600">Press <kbd class="kbd-inline">?</kbd> or <kbd class="kbd-inline">Esc</kbd> to close this dialog</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .kbd {
    padding: 0.25rem 0.5rem;
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    color: #374151;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
  
  .kbd-inline {
    padding: 0.125rem 0.375rem;
    background-color: #e5e7eb;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    color: #374151;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>

