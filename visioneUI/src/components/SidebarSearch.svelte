<script>
  import { createEventDispatcher } from "svelte";
  import { pushState } from "$app/navigation";
  import SearchControls from "../components/SearchControls.svelte";
  import TextareasManager from "./TextareasManager.svelte";
  import RecentSearches from "../components/RecentSearches.svelte";
  import QueryTemplatesPanel from './QueryTemplatesPanel.svelte';
  import { recentSearches } from "../stores/recentSearches.js";
  import { queryTemplates } from "../stores/queryTemplates.js";
  import { marked } from 'marked';

  export let isSidebarOpen = true;
  export let textareas = [];
  export let translatedQueryHints = {};
  export let availableModels = [];
  export let modelSelectionPerStepEnabled = true;
  export let showAutoTranslateToggle = true;
  export let autoTranslateEnabled = true;
  export let onToggleAutoTranslate = () => {};
  export let runtimeProfile = {};
  export let discoveryMetadataFields = [];
  export let searchLoading = false;
  export let searchError = null;
  export let searchResultSet = null;
  export let width = 18;
  export let images = []; 
  export let textareaImages = {};
  export let challengeType = 'KIS';
  export let submitTextAnswer = (_text) => {};
  export let askQaAgent = (_question, _maxIterations) => Promise.resolve({});
  export let stopQaAgent = () => {};
  export let qaAgentSubmitCandidate = '';
  export let qaToolResultLimit = 50;
  export let qaToolResultsExpandedByDefault = true;
  export let onUpdateQaAgentDisplayPrefs = (_patch) => {};
  export let qaAgentStream = /** @type {{ isStreaming: boolean, events: Array<Record<string, unknown>>, finalAnswer: string, error: string }} */ ({
    isStreaming: false,
    events: [],
    finalAnswer: '',
    error: ''
  });

  
  let isSelectingImage = false;
  let selectingForTextarea = null;
  let textareasManagerRef;
  let qaAgentQuestion = '';
  let qaAgentMaxIterations = '';

  const dispatch = createEventDispatcher();

  const addTA = (i) => dispatch("addTextarea", { index: i });
  const removeTA = (i) => dispatch("removeTextarea", { index: i });
  const toggleTA = (i) => dispatch("toggleTextarea", { index: i });
  const updateTA = (i, value) => dispatch("updateTextarea", { index: i, value });
  const doSearch = () => {
    if (typeof textareasManagerRef?.triggerSearchWithMetadata === 'function') {
      textareasManagerRef.triggerSearchWithMetadata();
      return;
    }
    dispatch("runSearch");
  };
  const clearQueryInputs = () => dispatch("clearQueryInputs");
  const handleSearchFromTextarea = (e) => dispatch("runSearch", e?.detail || {});
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

  function toEventLabel(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (!normalized) return 'EVENT';
    return normalized.replace(/_/g, ' ').toUpperCase();
  }

  function toEventText(evt) {
    const data = evt?.data;
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    if (typeof data.content === 'string') return data.content;
    if (typeof data.plan === 'string') return data.plan;
    if (typeof data.review === 'string') return data.review;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.results)) return `${data.results.length} result(s)`;
    if (Array.isArray(data.sources)) return `${data.sources.length} source(s)`;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function renderMarkdown(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return marked.parse(text, { breaks: true });
  }

  function getEventTypeClass(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'plan') return 'qa-event-plan';
    if (normalized === 'plan_review') return 'qa-event-plan-review';
    if (normalized === 'thinking') return 'qa-event-thinking';
    if (normalized === 'tool_call') return 'qa-event-tool-call';
    if (normalized === 'tool_result') return 'qa-event-tool-result';
    if (normalized === 'evaluation') return 'qa-event-evaluation';
    if (normalized === 'answer') return 'qa-event-answer';
    if (normalized === 'error') return 'qa-event-error';
    return 'qa-event-default';
  }

  function isMarkdownEvent(type) {
    const normalized = String(type || '').trim().toLowerCase();
    return normalized === 'plan' || normalized === 'plan_review' || normalized === 'thinking' || normalized === 'evaluation' || normalized === 'answer';
  }

  function getEventMarkdownContent(evt) {
    const data = evt?.data;
    if (!data || typeof data !== 'object') return String(data || '');
    if (typeof data.plan === 'string') return data.plan;
    if (typeof data.review === 'string') return data.review;
    if (typeof data.content === 'string') return data.content;
    if (typeof data.detail === 'string') return data.detail;
    return JSON.stringify(data, null, 2);
  }

  function getToolResults(evt) {
    const results = evt?.data?.results;
    return Array.isArray(results) ? results : [];
  }

  function getVisibleToolResults(evt) {
    const allResults = getToolResults(evt);
    if (qaToolResultLimit <= 0) return allResults;
    return allResults.slice(0, qaToolResultLimit);
  }

  function extractSubmitCandidateFromText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const boldMatch = raw.match(/\*\*([^*]+)\*\*/);
    if (boldMatch?.[1]) {
      return String(boldMatch[1]).trim().replace(/^['"`\s]+|['"`\s]+$/g, '');
    }

    const quoteMatch = raw.match(/["']([^"']{2,80})["']/);
    if (quoteMatch?.[1]) {
      return String(quoteMatch[1]).trim().replace(/^['"`\s]+|['"`\s]+$/g, '');
    }

    const lines = raw
      .split('\n')
      .map((ln) => ln.trim())
      .filter(Boolean)
      .filter((ln) => !ln.startsWith('```'));

    const compact = lines
      .filter((ln) => {
        const lower = ln.toLowerCase();
        return !(lower.startsWith('plan') || lower.startsWith('reasoning') || lower.startsWith('evidence') || lower.startsWith('sources'));
      })
      .join(' ')
      .trim();

    const candidate = compact || raw;

    const patterns = [
      /(?:located at|is|was|were|named|called)\s+(.+?)(?:\s+in\s+|\s+on\s+|\s+at\s+|,|\.|$)/i,
      /(?:answer is|answer:|it is)\s+(.+?)(?:,|\.|$)/i
    ];
    for (const pattern of patterns) {
      const m = candidate.match(pattern);
      if (m?.[1]) {
        return String(m[1])
          .trim()
          .replace(/^the\s+/i, '')
          .replace(/^['"`\s]+|['"`\s]+$/g, '');
      }
    }

    const firstSentence = candidate.split(/\.\s|\n|;/, 1)[0]?.trim() || candidate;
    return firstSentence
      .replace(/^the\s+/i, '')
      .replace(/^['"`\s]+|['"`\s]+$/g, '')
      .trim();
  }

  $: qaSubmitCandidateEffective = String(qaAgentSubmitCandidate || '').trim()
    || extractSubmitCandidateFromText(qaAgentStream?.finalAnswer);

  function setQaToolResultLimit(nextLimit) {
    const normalized = Number(nextLimit);
    if (!Number.isFinite(normalized)) return;
    qaToolResultLimit = normalized;
    onUpdateQaAgentDisplayPrefs({ qaToolResultLimit: normalized });
  }

  function setQaToolResultsExpandedByDefault(nextValue) {
    const safe = !!nextValue;
    qaToolResultsExpandedByDefault = safe;
    onUpdateQaAgentDisplayPrefs({ qaToolResultsExpandedByDefault: safe });
  }

  function getToolCallArgs(evt) {
    const data = evt?.data;
    if (!data || typeof data !== 'object') return '';
    const { script, ...other } = data.arguments || {};
    return JSON.stringify(other, null, 2);
  }

  async function runQaAgent() {
    const question = String(qaAgentQuestion || '').trim();
    if (!question) return;
    const maxIterations = Number(qaAgentMaxIterations);
    await askQaAgent(question, Number.isFinite(maxIterations) && maxIterations > 0 ? maxIterations : null);
  }

  async function submitFinalAnswer() {
    const answer = String(qaSubmitCandidateEffective || '').trim();
    if (!answer) return;
    await submitTextAnswer(answer);
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
    <div class="flex-1 overflow-y-auto pt-1.5 pb-1.5 pl-1.5 pr-2.5 space-y-2 custom-scrollbar">
        <!-- Query Builder -->
        <div class="bg-gray-800/50 rounded-lg p-1.5 border border-gray-700 shadow-lg">
          <div class="mb-1 flex items-center justify-between gap-2 pr-0.5">
            <div class="flex min-w-0 items-center gap-2">
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

            {#if showAutoTranslateToggle}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-slate-700/35"
                title={autoTranslateEnabled ? 'Auto-translate ON (click to disable)' : 'Auto-translate OFF (click to enable)'}
                aria-label={autoTranslateEnabled ? 'Disable auto-translate' : 'Enable auto-translate'}
                aria-pressed={autoTranslateEnabled}
                on:click={onToggleAutoTranslate}
              >
                <img
                  src="/icons/translate.svg"
                  alt=""
                  aria-hidden="true"
                  class="w-3.5 h-3.5 object-contain transition-opacity {autoTranslateEnabled ? 'opacity-100 saturate-125' : 'opacity-55 grayscale'}"
                  loading="lazy"
                />
                <span
                  class="relative inline-flex h-3.5 w-6 items-center rounded-full border transition-colors {autoTranslateEnabled
                    ? 'border-emerald-400/70 bg-emerald-500/35'
                    : 'border-slate-500/70 bg-slate-700/70'}"
                >
                  <span
                    class="inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform {autoTranslateEnabled
                      ? 'translate-x-3'
                      : 'translate-x-0.5'}"
                  ></span>
                </span>
              </button>
            {/if}
          </div>
          
          <TextareasManager
            bind:this={textareasManagerRef}
            {textareas}
            {translatedQueryHints}
            {availableModels}
            {modelSelectionPerStepEnabled}
            {runtimeProfile}
            {discoveryMetadataFields}
            availableImages={images}
            {textareaImages}
            on:updateImages={(e) => dispatch('updateImages', e.detail)}
            on:replaceSimilarityImage={(e) => dispatch('replaceSimilarityImage', e.detail)}
            on:closeSimilarityStep={(e) => dispatch('closeSimilarityStep', e.detail)}
            on:add={(e) => addTA(e.detail.index)}
            on:remove={(e) => removeTA(e.detail.index)}
            on:toggle={(e) => toggleTA(e.detail.index)}
            on:update={(e) => updateTA(e.detail.index, e.detail.value)}
            on:updateModel
            on:search={handleSearchFromTextarea}
            on:swap={(e) => {
              swapTA(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap');
            }}
              on:startImageSelection
              on:imageSelected
          />

          <!-- Banner informativo durante la selezione -->
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
          
          <div class="mt-1.5 pl-8 flex items-center gap-2">
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
                  class="inline-flex items-center justify-center px-2.5 py-2.5 bg-red-900/30 hover:bg-red-900/45 text-red-200 hover:text-red-100 text-sm rounded-lg border border-red-700/45 hover:border-red-600/60 transition-all"
                  title="Reset query"
                  aria-label="Reset query"
                  aria-haspopup="menu"
                  aria-expanded={isResetMenuOpen}
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/>
                    <path d="M19 6l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
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
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/>
                        <path d="M19 6l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                      Reset query
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        {#if challengeType === 'Q&A'}
          <div class="bg-slate-900/30 rounded-lg p-2 border border-slate-700 shadow-lg mt-2">
            <div class="flex items-center justify-between gap-2 mb-2">
              <h4 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Q&A Agent Stream</h4>
              {#if qaAgentStream?.isStreaming}
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-200">streaming</span>
              {/if}
            </div>

            <textarea
              class="w-full min-h-[64px] p-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask a question about the lifelog..."
              bind:value={qaAgentQuestion}
            ></textarea>

            <div class="mt-2 flex items-center gap-2">
              <input
                class="w-20 p-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="number"
                min="1"
                max="10"
                placeholder="iter"
                bind:value={qaAgentMaxIterations}
              />
              <button
                class="flex-1 px-3 py-2 text-sm font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={!qaAgentQuestion?.trim() || qaAgentStream?.isStreaming}
                on:click={runQaAgent}
              >
                Ask agent
              </button>
              <button
                class="px-3 py-2 text-sm font-semibold rounded-md border border-red-500/60 text-red-200 hover:bg-red-900/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={!qaAgentStream?.isStreaming}
                on:click={stopQaAgent}
              >
                Stop
              </button>
            </div>

            <div class="mt-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="px-2 py-1 text-[10px] rounded border transition-colors {qaToolResultLimit === 50 ? 'bg-blue-900/45 border-blue-600/70 text-blue-100' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'}"
                  on:click={() => setQaToolResultLimit(50)}
                >
                  Top 50
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-[10px] rounded border transition-colors {qaToolResultLimit === 20 ? 'bg-blue-900/45 border-blue-600/70 text-blue-100' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'}"
                  on:click={() => setQaToolResultLimit(20)}
                >
                  Top 20
                </button>
                <button
                  type="button"
                  class="px-2 py-1 text-[10px] rounded border transition-colors {qaToolResultLimit <= 0 ? 'bg-blue-900/45 border-blue-600/70 text-blue-100' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'}"
                  on:click={() => setQaToolResultLimit(0)}
                >
                  All
                </button>
              </div>

              <label class="inline-flex items-center gap-1 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  class="accent-blue-500"
                  bind:checked={qaToolResultsExpandedByDefault}
                  on:change={(e) => setQaToolResultsExpandedByDefault(e.currentTarget.checked)}
                />
                Expand results
              </label>
            </div>

            {#if qaSubmitCandidateEffective}
              <button
                class="mt-2 w-full px-3 py-1.5 text-sm font-semibold rounded-md bg-emerald-700/70 hover:bg-emerald-600/80 text-emerald-50 transition-colors"
                on:click={submitFinalAnswer}
              >
                Submit final answer to DRES
              </button>
              <div class="mt-1 text-xs text-emerald-200/90 break-words">
                Candidate: {qaSubmitCandidateEffective}
              </div>
              <div class="text-[11px] text-slate-300/90">
                Source: {qaAgentSubmitCandidate ? 'answer_submit' : 'fallback from answer'}
              </div>
            {/if}

            {#if qaAgentStream?.error}
              <div class="mt-2 p-2 rounded border border-red-700/60 bg-red-900/20 text-xs break-words">
                {qaAgentStream.error}
              </div>
            {/if}

            {#if Array.isArray(qaAgentStream?.events) && qaAgentStream.events.length > 0}
              <div class="mt-2 max-h-72 overflow-y-auto space-y-2 pr-1 qa-stream-panel">
                {#each qaAgentStream.events as evt}
                  <div class="p-2 rounded-md border qa-event-block {getEventTypeClass(evt?.type)}">
                    <div class="text-[11px] font-semibold tracking-wide mb-1 qa-event-label">{toEventLabel(evt?.type)}</div>

                    {#if String(evt?.type || '').toLowerCase() === 'tool_result'}
                      {@const allResults = getToolResults(evt)}
                      {@const results = getVisibleToolResults(evt)}
                      <details open={qaToolResultsExpandedByDefault}>
                        <summary class="text-sm text-slate-300 cursor-pointer">Show {results.length} result(s){results.length < allResults.length ? ` of ${allResults.length}` : ''}</summary>
                        <div class="qa-tool-results-grid mt-2">
                          {#each results as result}
                            <div class="qa-result-card">
                              {#if result?.image_url}
                                <img src={result.image_url} alt={String(result?.id || 'result')} loading="lazy" />
                              {/if}
                              {#if result?.id}
                                <div class="qa-result-id">{result.id}</div>
                              {/if}
                              {#if result?.metadata && typeof result.metadata === 'object'}
                                <div class="qa-result-meta">
                                  {#each Object.entries(result.metadata).slice(0, 8) as [k, v]}
                                    <div><strong>{k}:</strong> {String(v)}</div>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </details>
                    {:else if String(evt?.type || '').toLowerCase() === 'tool_call'}
                      <pre class="text-sm whitespace-pre-wrap break-words text-slate-200 bg-slate-900/60 rounded p-2 border border-slate-700">{getToolCallArgs(evt)}</pre>
                    {:else if isMarkdownEvent(evt?.type)}
                      <div class="qa-event-body markdown-body text-sm text-slate-100">{@html renderMarkdown(getEventMarkdownContent(evt))}</div>
                    {:else}
                      <pre class="text-sm whitespace-pre-wrap break-words text-slate-200">{toEventText(evt)}</pre>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Recent + Templates compact row -->
        {#if !searchLoading}
          <div class="pt-1.5 border-t border-gray-700/50 space-y-1.5 utility-panel-container">
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

  <!-- Resize handle sempre visibile, fuori dall'if -->
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
  width: 18px;
  height: 56px;
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
  right: -8px;
  border-radius: 0 8px 8px 0;
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

.qa-stream-panel {
  scrollbar-width: thin;
}

.qa-event-block {
  border-left-width: 3px;
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(71, 85, 105, 0.55);
}

.qa-event-label {
  color: #cbd5e1;
}

.qa-event-plan {
  background: #1a2533;
  border-color: #60a5fa;
}

.qa-event-plan-review {
  background: #1f1a33;
  border-color: #9575cd;
}

.qa-event-thinking {
  background: #1a1f2c;
  border-color: #b39ddb;
}

.qa-event-tool-call {
  background: #1f2618;
  border-color: #f59e0b;
}

.qa-event-tool-result {
  background: #1a1f2c;
  border-color: #94a3b8;
}

.qa-event-evaluation {
  background: #1a2020;
  border-color: #4dd0e1;
}

.qa-event-answer {
  background: #162216;
  border-color: #66bb6a;
}

.qa-event-error {
  background: #2a1515;
  border-color: #ef5350;
}

.qa-tool-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.qa-result-card {
  background: #1f2937;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px;
  font-size: 11px;
  overflow: hidden;
}

.qa-result-card img {
  width: 100%;
  border-radius: 4px;
  margin-bottom: 6px;
  display: block;
}

.qa-result-id {
  font-weight: 700;
  color: #93c5fd;
  word-break: break-all;
  margin-bottom: 4px;
}

.qa-result-meta {
  color: #cbd5e1;
  line-height: 1.35;
}

.qa-event-body :global(p) {
  margin: 0 0 6px 0;
}

.qa-event-body :global(p:last-child) {
  margin-bottom: 0;
}

.qa-event-body :global(ul),
.qa-event-body :global(ol) {
  margin: 4px 0 6px 16px;
}

.qa-event-body :global(code) {
  background: #1f2937;
  padding: 1px 4px;
  border-radius: 3px;
}

.qa-event-body :global(pre) {
  background: #1f2937;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px;
  overflow-x: auto;
  margin: 6px 0;
}
</style>
