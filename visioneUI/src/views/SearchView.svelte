<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SidebarSearch from "../components/SidebarSearch.svelte";
  import SidebarRight from "../components/SidebarRight.svelte";
  import SearchResults from "../components/SearchResults.svelte";
  import ImageModal from "../components/ImageModal.svelte";
  import EmptyState from '../components/EmptyState.svelte';
  import WelcomeHero from '../components/WelcomeHero.svelte';

  type QueryTextarea = { value: string; enabled: boolean; similarityImgId?: string };
  type Img = { imgId?: string; videoId?: string; title?: string; [key: string]: unknown };
  type AvailableModel = string | { name?: string; modalities?: string[] };

  type DispatchEvents = {
    loadCachedResults: { cachedResults: unknown };
    restoreFromURL: void;
    restoreRecentSearch: { textareas: QueryTextarea[] };
    updateURL: void;
    updateImages: { index: number; images: unknown[] };
    replaceSimilarityImage: { index: number; imgId: string | null; url: string; name: string };
    closeSimilarityStep: { index: number };
    selectRightTab: unknown;
    clearQueryInputs: void;
    updateRFEnabled: { enabled: boolean };
    updateRFMethod: { method: string };
  };

  // Parent-provided state/props
  export let isSidebarOpen = true;
  export let isSidebarRightOpen = false;
  export let sidebarRightTab = "RF";
  export let sidebarLeftWidth = 18;
  export let sidebarRightWidth = 18;
  export let onResizeLeftSidebar = (_width: number) => {};
  export let onResizeRightSidebar = (_width: number) => {};
  export let textareas: QueryTextarea[] = [];
  export let searchTextareasSnapshot: QueryTextarea[] | null = null;
  export let translatedQueryHints: Record<number, { from: string; to: string }> = {};
  export let availableModels: AvailableModel[] = [];
  export let modelSelectionPerStepEnabled = true;
  export let showAutoTranslateToggle = true;
  export let autoTranslateEnabled = true;
  export let onToggleAutoTranslate = () => {};
  export let textareaImages: Record<number, unknown[]> = {};

  export let searchLoading = false;
  export let searchError: string | null = null;
  export let searchResultSet: unknown = null;
  export let rfPositive: Img[] = [];
  export let rfNegative: Img[] = [];
  export let rfEnabled = true;
  export let rfMethod = 'svm';
  export let submittedImages: Img[] = [];
  export let viewMode = "byrank";
  export let videoBadgeOrientation = "vertical";
  export let contentScale = 1;
  export let images: Img[] = [];
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let justifyResultRows = false;
  export let tupleIndicatorMode = 'badge+bar';
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let imageModalScale = 100;
  export let runtimeProfile = {};
  export let discoveryMetadataFields: string[] = [];
  export let showLocalTimeInTitles = true;
  export let resultsetBadgeLabelMode = "both";
  export let submittedAnswers: Array<Record<string, unknown>> = [];
  export let submitTextAnswer = (_text: string) => {};
  export let askQaAgent = (_question: string) => Promise.resolve({});
  export let stopQaAgent = () => {};
  export let qaAgentStream: {
    isStreaming: boolean;
    events: Array<Record<string, unknown>>;
    finalAnswer: string;
    error: string;
  } = { isStreaming: false, events: [], finalAnswer: '', error: '' };
  export let qaStreamPanelHeight = 288;
  export let onUpdateQaAgentPanelPrefs = (_patch: { qaStreamPanelHeight?: number }) => {};
  export let sessionResetKey = 0;
  export let queryStateRevision = 0;

  // Image modal
  export let selectedImage: Img | null = null;
  export let isModalOpen = false;
  export let totalImages = 0;

  // Parent callbacks
  export let registerContainer = (_el: Element | null) => {};
  export let onToggleSidebar = () => {};
  export let onToggleRightSidebar = () => {};

  export let onAddTextarea = (_index: number) => {};
  export let onRemoveTextarea = (_index: number) => {};
  export let onToggleTextarea = (_index: number) => {};
  export let onUpdateTextarea = (_index: number, _value: string) => {};
  export let onSwapTextarea = (_indexA: number, _indexB: number, _mode: "swap" | "move" = "swap") => {};

  export let rows: Img[][] = [];

  export let onRunSearch = () => {};
  export let onClearResults = () => {};
  export let registerFocusSearchHandler = (_fn: () => void) => {};

  export let onOpenFromRF = (_index: number) => {};
  export let onOpenFromSubmitted = (_index: number) => {};
  export let onRemovePositive = (_e: CustomEvent) => {};
  export let onRemoveNegative = (_e: CustomEvent) => {};
  export let onAddSubmittedToRFPositive = () => {};

  // Grid actions
  export let onVideoSummary = (_videoId: string, _imgId: string) => {};
  export let onSimilarity = (_imgId: string, _img?: Img | null) => {};
  export let onPinImage = (_img?: Img | null) => {};
  export let isImagePinned = (_imgId: string) => false;
  export let openByImgId = (_imgId: string) => {};  
  export let openVideoPlayerBy = (_imgId: string, _videoId: string, _startAt?: number, _img?: Img | null) => {};

  // Modal actions
  export let onCloseModal = () => {};
  export let onPrev = () => {};
  export let onNext = () => {};
  export let onAdjustImageModalScale = (_delta: number) => {};

  export let addRFPositiveByImg = (_imgId: string) => {};
  export let addRFNegativeByImg = (_imgId: string) => {};
  export let submitByImgId = (_imgId: string) => {};
  export let onLoadExample = (_queries: string[]) => {};

  const dispatch = createEventDispatcher<DispatchEvents>();
  
  type SidebarSearchRef = {
    handleImageSelected: (image: Img) => void;
    cancelImageSelection: () => void;
    focusSearchInput: () => void;
    triggerSearchWithMetadata: () => void;
  };

  let sidebarSearchRef: SidebarSearchRef | null = null;
  let lastRegisteredFocusHandler: (() => void) | null = null;
  let isSelectingImage = false;

  function focusLeftTextarea() {
    sidebarSearchRef?.focusSearchInput?.();
  }

  export function triggerSearchLikeButton() {
    sidebarSearchRef?.triggerSearchWithMetadata?.();
  }

  $: {
    if (sidebarSearchRef && lastRegisteredFocusHandler !== focusLeftTextarea) {
      registerFocusSearchHandler(focusLeftTextarea);
      lastRegisteredFocusHandler = focusLeftTextarea;
    }
  }

  $: hasActiveQueries = textareas.some(t => t.enabled && t.value?.trim());
  $: isFirstVisit = !searchResultSet && !searchLoading && !hasActiveQueries;
  $: hasSearched = searchResultSet !== null;
  $: noResults = hasSearched && rows.length === 0;
  $: enabledSteps = enabledTextareasCount(searchLoading && searchTextareasSnapshot?.length ? searchTextareasSnapshot : textareas);
  
  function handleStartImageSelection(_e: CustomEvent<{ textareaIndex: number }>) {
    isSelectingImage = true;
  }

  function handleImageSelectedFromGrid(e: CustomEvent<Img>) {
    const image = e.detail;
    sidebarSearchRef?.handleImageSelected(image);
    isSelectingImage = false;
  }

  function handleCancelImageSelection() {
    sidebarSearchRef?.cancelImageSelection();
    isSelectingImage = false;
  }

  function handleImageClick(e: CustomEvent<{ img: Img }>) {
    if (isSelectingImage) {
      handleImageSelectedFromGrid(e);
    } else {
      openByImgId(String(e.detail.img.imgId ?? ""));
    }
  }

  function enabledTextareasCount(items: QueryTextarea[] = []) {
    return items.filter(t => {
      const text = String(t.value || '').trim();
      const simId = String(t.similarityImgId || '').trim();
      return t.enabled && (text.length > 0 || simId.length > 0);
    }).length;
  }
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 16vw, 360px);" aria-label="Search View">
  <!-- Left sidebar -->
<SidebarSearch
  bind:this={sidebarSearchRef}
  {isSidebarOpen}
  width={sidebarLeftWidth}
  {textareas}
  {translatedQueryHints}
  {availableModels}
  {modelSelectionPerStepEnabled}
  {showAutoTranslateToggle}
  {autoTranslateEnabled}
  {onToggleAutoTranslate}
  {runtimeProfile}
  {discoveryMetadataFields}
  {textareaImages}
  {challengeType}
  {askQaAgent}
  {stopQaAgent}
  {qaAgentStream}
  {qaStreamPanelHeight}
  onUpdateQaAgentPanelPrefs={onUpdateQaAgentPanelPrefs}
  {sessionResetKey}
  {queryStateRevision}
  {searchLoading}
  searchError={searchError as any}
  searchResultSet={searchResultSet as any}
  {images}
  on:addTextarea={(e) => onAddTextarea(e.detail.index)}
  on:removeTextarea={(e) => onRemoveTextarea(e.detail.index)}
  on:toggleTextarea={(e) => onToggleTextarea(e.detail.index)}
  on:updateTextarea={(e) => onUpdateTextarea(e.detail.index, e.detail.value)}
  on:updateModel
  on:runSearch={onRunSearch}
  on:clearResults={onClearResults}
  on:clearQueryInputs={() => dispatch('clearQueryInputs')}
  on:swapTextarea={(e) => onSwapTextarea(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap')}
  on:resize={(e) => onResizeLeftSidebar(e.detail.width)}
  on:toggleSidebar={onToggleSidebar}
  on:loadCachedResults={(e) => {
    dispatch('loadCachedResults', e.detail);
  }}
  on:restoreRecentSearch={(e) => dispatch('restoreRecentSearch', e.detail)}
  on:restoreFromURL={(e) => dispatch('restoreFromURL')}
  on:updateURL={(e) => dispatch('updateURL')}
  on:updateImages={(e) => dispatch('updateImages', e.detail)}
  on:replaceSimilarityImage={(e) => dispatch('replaceSimilarityImage', e.detail)}
  on:closeSimilarityStep={(e) => dispatch('closeSimilarityStep', e.detail)}
  on:startImageSelection={handleStartImageSelection}
  on:imageSelected={() => { isSelectingImage = false; }}
/>


  <!-- Main content -->
  <div class="flex flex-col flex-1 min-w-0">
    <!-- Selection mode banner -->
    {#if isSelectingImage}
      <div class="sticky top-0 z-40 border-b border-green-200 bg-green-50/95 backdrop-blur px-4 py-3">
        <div class="flex items-center justify-between max-w-6xl mx-auto">
          <div class="flex items-center space-x-3">
            <div class="bg-green-100 p-2 rounded-lg">
              <svg class="w-5 h-5 text-green-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-green-800">Image selection mode active</p>
              <p class="text-xs text-green-700">Click any result below to attach it to the current query step</p>
            </div>
          </div>
          <button
            on:click={handleCancelImageSelection}
            class="px-3.5 py-2 bg-white text-green-800 border border-green-300 hover:bg-green-100 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    {/if}

    <div class="content bg-gray-100 flex-1 overflow-x-hidden"
         style="height:100%; zoom:{contentScale};">

      <div class="flex-1 h-full" class:overflow-y-auto={isFirstVisit} class:overflow-hidden={!isFirstVisit}>
        {#if isFirstVisit}
          <WelcomeHero
            on:getStarted={focusLeftTextarea}
            on:loadExample={(e) => onLoadExample(e.detail)}
          />
          
        {:else if searchLoading}
          <div class="flex items-center justify-center h-full px-6">
            <div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
              <div class="relative inline-block mb-5">
                <div class="w-16 h-16 border-4 border-blue-200 rounded-full animate-ping absolute"></div>
                <div class="w-16 h-16 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              
              <h3 class="text-lg font-semibold text-gray-800 mb-2">
                Searching temporal sequences
              </h3>
              
              <p class="text-sm text-gray-500 leading-relaxed mb-4">
                Analyzing {enabledSteps} active steps...
              </p>
              
              <div class="flex items-center justify-center space-x-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.4s;"></div>
              </div>
            </div>
          </div>
          
        {:else if searchError}
          <div class="flex items-center justify-center h-full px-6">
            <div class="w-full max-w-2xl rounded-2xl border border-red-200 bg-white shadow-sm p-8 text-center">
              <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-800 mb-2">Search error</h3>
              <p class="text-sm text-gray-500 leading-relaxed mb-5">{searchError}</p>
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                on:click={onRunSearch}
              >
                Try Again
              </button>
            </div>
          </div>
          
        {:else if noResults}
          <div class="flex items-center justify-center h-full px-6">
            <div class="w-full max-w-2xl rounded-2xl border border-blue-200 bg-white shadow-sm p-8 text-center">
              <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-800 mb-2">No results found</h3>
              <p class="text-sm text-gray-500 leading-relaxed mb-5">Try adjusting your query steps or using broader keywords.</p>

              <div class="text-xs text-gray-600 space-y-1 mb-5">
                <p><strong>Suggestions</strong></p>
                <ul class="list-disc list-inside text-left inline-block">
                  <li>Use broader keywords</li>
                  <li>Remove some temporal steps</li>
                  <li>Try different phrasing</li>
                </ul>
              </div>

              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                on:click={focusLeftTextarea}
              >
                Refine Query
              </button>
            </div>
          </div>
          
        {:else}
          <SearchResults
            {rows}
            selectedImage={selectedImage as any}
            {viewMode}
            {videoBadgeOrientation}
            {virtualizationEnabled}
            {virtualizationThreshold}
            {justifyResultRows}
            {tupleIndicatorMode}
            {showSubmitUI}
            {challengeType}
            {runtimeProfile}
            {showLocalTimeInTitles}
            {resultsetBadgeLabelMode}
            modalOpen={isModalOpen}
            {rfPositive}
            {rfNegative}
            registerContainer={registerContainer}
            isSelectionMode={isSelectingImage}
            on:open={handleImageClick}
            on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId, e.detail.startAt, e.detail.img ?? null)}
            on:videoSummary={(e) => onVideoSummary(e.detail.img.videoId, e.detail.img.imgId)}
            on:similarity={(e) => onSimilarity(e.detail.imgId, e.detail.frame ?? e.detail.img ?? null)}
            on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
            on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
            on:submit={(e) => submitByImgId(e.detail.img.imgId)}
            on:selectImage={handleImageSelectedFromGrid}
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- Right sidebar -->
  <SidebarRight
    isOpen={isSidebarRightOpen}
    activeTab={sidebarRightTab}
    width={sidebarRightWidth}
    {rfPositive}
    {rfNegative}
    {rfEnabled}
    {rfMethod}
    {submittedImages}
    {submittedAnswers}
    {challengeType}
    showSubmittedTab={showSubmitUI}
    {submitTextAnswer}
    on:removePositive={onRemovePositive}
    on:removeNegative={onRemoveNegative}
    on:openFromRF={(e) => onOpenFromRF(e.detail.index)}
    on:openFromSubmitted={(e) => onOpenFromSubmitted(e.detail.index)}
    on:addSubmittedToRFPositive={onAddSubmittedToRFPositive}
    on:resize={(e) => onResizeRightSidebar(e.detail.width)}
    on:toggleRightSidebar={onToggleRightSidebar}
    on:selectTab={(e) => dispatch('selectRightTab', e.detail)}
    on:updateRFEnabled={(e) => dispatch('updateRFEnabled', e.detail)}
    on:updateRFMethod={(e) => dispatch('updateRFMethod', e.detail)}
  />
</div>

<!-- Modal outside the main container -->
<ImageModal
  isOpen={isModalOpen}
  image={selectedImage as any}
  total={totalImages}
  modalScale={imageModalScale}
  {showSubmitUI}
  {challengeType}
  {runtimeProfile}
  {showLocalTimeInTitles}
  isPinned={isImagePinned(String(selectedImage?.imgId || ''))}
  on:close={onCloseModal}
  on:prev={onPrev}
  on:next={onNext}
  on:adjustScale={(e) => onAdjustImageModalScale(Number(e?.detail?.delta || 0))}
  on:submit={(e) => submitByImgId(e.detail.img.imgId)}
  on:pinImage={(e) => onPinImage(e.detail.img)}
  on:videoSummary={(e) => {
    onCloseModal();
    onVideoSummary(e.detail.img.videoId, e.detail.img.imgId);
  }}
  on:similarity={(e) => {
    onCloseModal();
    onSimilarity(e.detail.imgId, e.detail.img ?? null);
  }}
  on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
  on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
  on:openVideoPlayer={(e) => {
    onCloseModal();
    openVideoPlayerBy(e.detail.imgId, e.detail.videoId, e.detail.startAt, e.detail.img ?? null);
  }}
/>
