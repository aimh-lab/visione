<script>
  import { onMount, onDestroy } from "svelte";
  import { focusTrap } from "../utils/ui";

  /** @typedef {'View1' | 'View2' | 'Similarity'} LayoutTab */

  // Existing props
  export let isModalOpen = false;
  export let isVideoPlayerOpen = false;
  /** @type {() => void} */
  export let onOpenAtSelected = () => {};
  /** @type {(offset: number, toFirstOfRow?: boolean) => void} */
  export let onNavigateImage = (_offset, _toFirstOfRow = false) => {};
  /** @type {() => void} */
  export let onCloseModal = () => {};

  // New callbacks for shortcuts
  /** @type {(tab: LayoutTab) => void} */
  export let onSwitchTab = (_tab) => {};
  /** @type {() => void} */
  export let onSubmitSelected = () => {};
  /** @type {() => void} */
  export let onToggleSidebar = () => {};
  /** @type {() => void} */
  export let onOpenSettings = () => {};
  /** @type {() => void} */
  export let onRFPositiveSelected = () => {};
  /** @type {() => void} */
  export let onRFNegativeSelected = () => {};
  /** @type {() => void} */
  export let onSimilaritySelected = () => {};
  /** @type {() => void} */
  export let onVideoSummarySelected = () => {};
  /** @type {() => boolean | void} */
  export let onIncreaseActiveImageSize = () => {};
  /** @type {() => boolean | void} */
  export let onDecreaseActiveImageSize = () => {};
  /** @type {() => void} */
  export let onFocusQuery = () => {};

  let showHelp = false;
  let lastAction = '';
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let actionTimeout;

  /** @param {EventTarget | null} el */
  const isTypingTarget = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const t = el?.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el?.isContentEditable;
  };

  /** @param {string} action */
  function showActionFeedback(action) {
    lastAction = action;
    if (actionTimeout) clearTimeout(actionTimeout);
    actionTimeout = setTimeout(() => {
      lastAction = '';
    }, 1500);
  }

  /** @param {KeyboardEvent} e */
  function isIncreaseImageSizeShortcut(e) {
    return e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd';
  }

  /** @param {KeyboardEvent} e */
  function isDecreaseImageSizeShortcut(e) {
    return e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract';
  }

  /** @param {KeyboardEvent} e */
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

    if (!showHelp && isIncreaseImageSizeShortcut(e)) {
      e.preventDefault();
      if (onIncreaseActiveImageSize() !== false) showActionFeedback('Image size increased');
      return;
    }

    if (!showHelp && isDecreaseImageSizeShortcut(e)) {
      e.preventDefault();
      if (onDecreaseActiveImageSize() !== false) showActionFeedback('Image size decreased');
      return;
    }

    if (!showHelp && e.key?.toLowerCase() === 'q') {
      e.preventDefault();
      onFocusQuery();
      showActionFeedback('Query focused');
      return;
    }

    // When video player is open, let it own keyboard interactions (Esc, S, arrows, etc.)
    if (isVideoPlayerOpen) {
      return;
    }

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
        // Vai al primo della riga sopra
        onNavigateImage(-1, true); // offset -1, toFirstOfRow true
        showActionFeedback('Row up');
      }
      else if (e.key === "ArrowDown") {
        // Vai al primo della riga sotto
        onNavigateImage(1, true); // offset 1, toFirstOfRow true
        showActionFeedback('Row down');
      }
      else if (e.key === "Escape") {
        onCloseModal();
        showActionFeedback('Closed modal');
      }

      // Allow key actions inside modal
      if (e.key === 's') {
        e.preventDefault();
        onSubmitSelected();
        showActionFeedback('Submitted frame');
      }
      else if (e.key === 'p') {
        e.preventDefault();
        onRFPositiveSelected();
        showActionFeedback('Added to RF Positive');
      }
      else if (e.key === 'n') {
        e.preventDefault();
        onRFNegativeSelected();
        showActionFeedback('Added to RF Negative');
      }
      else if (e.key === 'i') {
        e.preventDefault();
        onSimilaritySelected();
        showActionFeedback('Similarity search started');
      }
      else if (e.key === 'v') {
        e.preventDefault();
        onVideoSummarySelected();
        showActionFeedback('Context view opened');
      }

      return;
    }

    // Global shortcuts (when no modal is open)
    
    // Ctrl/Cmd + K: Open settings
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      onOpenSettings();
      showActionFeedback('Settings opened');
      return;
    }

    // 1: Return to main search view
    if (e.key === '1' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onSwitchTab('View1');
      showActionFeedback('Switched to Search');
      return;
    }

    // Deprecated tab shortcuts are intentionally disabled.
    if (['2', '3'].includes(e.key) && !isTypingTarget(e.target)) {
      e.preventDefault();
      showActionFeedback('Tab shortcut disabled');
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

    // V: Context view on selected
    if (e.key === 'v' && !isTypingTarget(e.target)) {
      e.preventDefault();
      onVideoSummarySelected();
      showActionFeedback('Context view opened');
      return;
    }

    if (!isModalOpen) {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"," "].includes(e.key)) {
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
        onNavigateImage(-1, true);
        showActionFeedback('Row up');
      }
      else if (e.key === "ArrowDown") {
        onNavigateImage(1, true);
        showActionFeedback('Row down');
      }
      else if (e.key === "Enter" || e.key === " ") {
        onOpenAtSelected();
        showActionFeedback('Opened frame details');
      }
    }

  }

  /** @param {KeyboardEvent} e */
  function handleHelpOverlayKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') showHelp = false;
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
    if (actionTimeout) clearTimeout(actionTimeout);
  });
</script>

<!-- Action feedback toast -->
{#if lastAction}
  <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
    <div class="ui-toast px-4 py-2 text-sm font-medium rounded-lg shadow-xl border">
      {lastAction}
    </div>
  </div>
{/if}

<!-- Help overlay -->
{#if showHelp}
  <!-- svelte-ignore a11y-no-interactive-element-to-noninteractive-role -->
  <div
    use:focusTrap
    class="ui-help-overlay fixed inset-0 z-[9998] flex items-center justify-center"
    on:click|self={() => (showHelp = false)}
    on:keydown={handleHelpOverlayKeydown}
    role="button"
    tabindex="0"
    aria-label="Close keyboard shortcuts"
  >
    <div class="ui-help-modal rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
      <!-- Header -->
      <div class="ui-help-header sticky top-0 border-b px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="ui-help-icon w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <h2 class="ui-help-title text-2xl font-bold">Keyboard Shortcuts</h2>
        </div>
        <button on:click={() => (showHelp = false)} class="ui-help-close p-2 rounded-lg transition-colors" aria-label="Close keyboard shortcuts">
          <svg xmlns="http://www.w3.org/2000/svg" class="ui-help-muted-icon w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- General -->
        <div>
          <h3 class="ui-help-section-title text-lg font-semibold mb-3">General</h3>
          <div class="space-y-2">
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Show this help</span>
              <kbd class="kbd">?</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Open settings</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Ctrl</kbd><span class="ui-help-muted">+</span><kbd class="kbd">K</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Toggle sidebar</span>
              <kbd class="kbd">T</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Focus query</span>
              <kbd class="kbd">Q</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Increase image size</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">+</kbd><span class="ui-help-muted">or</span><kbd class="kbd">=</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Decrease image size</span>
              <kbd class="kbd">-</kbd>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div>
          <h3 class="ui-help-section-title text-lg font-semibold mb-3">Navigation</h3>
          <div class="space-y-2">
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Switch to Search</span>
              <kbd class="kbd">1</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Move selection</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">←</kbd><kbd class="kbd">↑</kbd><kbd class="kbd">→</kbd><kbd class="kbd">↓</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Open selected frame</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Enter</kbd><span class="ui-help-muted">or</span><kbd class="kbd">Space</kbd>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div>
          <h3 class="ui-help-section-title text-lg font-semibold mb-3">Actions</h3>
          <div class="space-y-2">
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Submit selected frame</span>
              <kbd class="kbd">S</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Add to RF Positive</span>
              <kbd class="kbd">P</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Add to RF Negative</span>
              <kbd class="kbd">N</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Image similarity search</span>
              <kbd class="kbd">I</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Context view</span>
              <kbd class="kbd">V</kbd>
            </div>
          </div>
        </div>

        <!-- Modal -->
        <div>
          <h3 class="ui-help-section-title text-lg font-semibold mb-3">In Modal</h3>
          <div class="space-y-2">
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Close modal</span>
              <kbd class="kbd">Esc</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Navigate frames</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">←</kbd><kbd class="kbd">→</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Navigate rows</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>
              </div>
            </div>
          </div>
        </div>

        <!-- Video Player -->
        <div>
          <h3 class="ui-help-section-title text-lg font-semibold mb-3">Video Player</h3>
          <div class="space-y-2">
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Play / Pause</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Space</kbd><span class="ui-help-muted">or</span><kbd class="kbd">K</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Step frame backward (when paused)</span>
              <kbd class="kbd">,</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Step frame forward (when paused)</span>
              <kbd class="kbd">.</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Decrease playback speed</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Shift</kbd><span class="ui-help-muted">+</span><kbd class="kbd">&lt;</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Increase playback speed</span>
              <div class="flex items-center space-x-1">
                <kbd class="kbd">Shift</kbd><span class="ui-help-muted">+</span><kbd class="kbd">&gt;</kbd>
              </div>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Submit current frame</span>
              <kbd class="kbd">S</kbd>
            </div>
            <div class="ui-help-row flex items-center justify-between py-2 px-3 rounded-lg">
              <span class="ui-help-row-label">Close player</span>
              <kbd class="kbd">Esc</kbd>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="ui-help-footer sticky bottom-0 border-t px-6 py-4 text-center">
        <p class="ui-help-footer-text text-sm">Press <kbd class="kbd-inline">?</kbd> or <kbd class="kbd-inline">Esc</kbd> to close this dialog</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .ui-toast {
    background: var(--ui-toast-bg);
    border-color: var(--ui-toast-border);
    color: var(--ui-toast-text);
  }

  .ui-help-overlay {
    background: var(--ui-overlay-bg);
    backdrop-filter: var(--ui-overlay-backdrop);
  }

  .ui-help-modal {
    background: var(--ui-help-bg);
    color: var(--ui-text);
  }

  .ui-help-header {
    background: var(--ui-help-header-bg);
    border-color: var(--ui-border);
  }

  .ui-help-footer {
    background: var(--ui-help-footer-bg);
    border-color: var(--ui-border);
  }

  .ui-help-icon {
    color: var(--ui-help-icon);
  }

  .ui-help-title,
  .ui-help-section-title {
    color: var(--ui-help-title-text);
  }

  .ui-help-row-label,
  .ui-help-footer-text {
    color: var(--ui-help-body-text);
  }

  .ui-help-muted,
  .ui-help-muted-icon {
    color: var(--ui-help-muted-text);
  }

  .ui-help-close:hover,
  .ui-help-row:hover {
    background: var(--ui-help-row-hover-bg);
  }

  .kbd {
    padding: 0.25rem 0.5rem;
    background-color: var(--ui-code-bg);
    border: 1px solid var(--ui-code-border);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    color: var(--ui-code-text);
    box-shadow: 0 1px 2px 0 color-mix(in srgb, var(--ui-text) 8%, transparent 92%);
  }
  
  .kbd-inline {
    padding: 0.125rem 0.375rem;
    background-color: var(--ui-code-bg);
    border: 1px solid var(--ui-code-border);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    color: var(--ui-code-text);
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
