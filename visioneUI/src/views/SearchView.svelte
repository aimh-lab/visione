<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SidebarSearch from "../components/SidebarSearch.svelte";
  import SidebarRight from "../components/SidebarRight.svelte";
  import Topbar from "../components/Topbar.svelte";
  import SearchResults from "../components/SearchResults.svelte";
  import ImageModal from "../components/ImageModal.svelte";
  import EmptyState from '../components/EmptyState.svelte';
  import { toasts } from '../stores/toastStore.js';
  import WelcomeHero from '../components/WelcomeHero.svelte';

  const TopbarAny = Topbar as any;
  const EmptyStateAny = EmptyState as any;

  type QueryTextarea = { value: string; enabled: boolean };
  type Img = { imgId?: string; videoId?: string; title?: string; [key: string]: unknown };

  type DispatchEvents = {
    loadCachedResults: { cachedResults: unknown };
    restoreFromURL: void;
    updateURL: void;
    updateImages: { index: number; images: unknown[] };
    selectRightTab: unknown;
  };

  // Stato/props dal genitore
  export let isSidebarOpen = true;
  export let isSidebarRightOpen = true;
  export let sidebarRightTab = "RF";
  export let sidebarLeftWidth = 18;
  export let sidebarRightWidth = 18;
  export let onResizeLeftSidebar = (_width: number) => {};
  export let onResizeRightSidebar = (_width: number) => {};
  export let textareas: QueryTextarea[] = [];
  export let textareaImages: Record<number, unknown[]> = {};

  export let searchLoading = false;
  export let searchError: string | null = null;
  export let searchResultSet: unknown = null;
  export let rfPositive: Img[] = [];
  export let rfNegative: Img[] = [];
  export let submittedImages: Img[] = [];
  export let viewMode = "byrank";
  export let contentScale = 1;
  export let images: Img[] = [];

  // Modale immagini
  export let selectedImage: Img | null = null;
  export let isModalOpen = false;
  export let totalImages = 0;

  // Callback dal genitore
  export let registerContainer = (_el: Element | null) => {};
  export let onToggleSidebar = () => {};
  export let onToggleRightSidebar = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};
  export let onChangeViewMode = (_mode: string) => {};

  export let onAddTextarea = (_index: number) => {};
  export let onRemoveTextarea = (_index: number) => {};
  export let onToggleTextarea = (_index: number) => {};
  export let onUpdateTextarea = (_index: number, _value: string) => {};

  export let rows: Img[][] = [];

  export let onRunSearch = () => {};
  export let onClearResults = () => {};

  export let onOpenFromRF = (_index: number) => {};
  export let onOpenFromSubmitted = (_index: number) => {};
  export let onRemovePositive = (_e: CustomEvent) => {};
  export let onRemoveNegative = (_e: CustomEvent) => {};

  // Azioni griglia
  export let onVideoSummary = (_videoId: string, _imgId: string) => {};
  export let onSimilarity = (_imgId: string) => {};
  export let openByImgId = (_imgId: string) => {};  
  export let openVideoPlayerBy = (_imgId: string, _videoId: string) => {};

  // Azioni modale
  export let onCloseModal = () => {};
  export let onPrev = () => {};
  export let onNext = () => {};

  export let addRFPositiveByImg = (_imgId: string) => {};
  export let addRFNegativeByImg = (_imgId: string) => {};
  export let submitByImgId = (_imgId: string) => {};
  export let onLoadExample = (_queries: string[]) => {};

  const dispatch = createEventDispatcher<DispatchEvents>();
  
  type SidebarSearchRef = {
    handleImageSelected: (image: Img) => void;
    cancelImageSelection: () => void;
  };

  let container: Element | null = null;
  let sidebarSearchRef: SidebarSearchRef | null = null;
  let isSelectingImage = false;

  $: hasActiveQueries = textareas.some(t => t.enabled && t.value?.trim());
  $: isFirstVisit = !searchResultSet && !searchLoading && !hasActiveQueries;
  $: hasSearched = searchResultSet !== null;
  $: noResults = hasSearched && rows.length === 0;
  
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

  function focusLeftTextarea() {
    const input = document.querySelector('.sidebar-left textarea') as HTMLTextAreaElement | null;
    input?.focus();
  }

  function enabledTextareasCount() {
    return textareas.filter(t => t.enabled).length;
  }
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 16vw, 360px);" aria-label="Search View">
  <!-- Sidebar SINISTRA -->
<SidebarSearch
  bind:this={sidebarSearchRef}
  {isSidebarOpen}
  width={sidebarLeftWidth}
  {textareas}
  {textareaImages}
  {searchLoading}
  searchError={searchError as any}
  searchResultSet={searchResultSet as any}
  {images}
  on:addTextarea={(e) => onAddTextarea(e.detail.index)}
  on:removeTextarea={(e) => onRemoveTextarea(e.detail.index)}
  on:toggleTextarea={(e) => onToggleTextarea(e.detail.index)}
  on:updateTextarea={(e) => onUpdateTextarea(e.detail.index, e.detail.value)}
  on:runSearch={onRunSearch}
  on:clearResults={onClearResults}
  on:swapTextarea
  on:resize={(e) => onResizeLeftSidebar(e.detail.width)}
  on:toggleSidebar={onToggleSidebar}
  on:loadCachedResults={(e) => {
    dispatch('loadCachedResults', e.detail);
  }}
  on:restoreFromURL={(e) => dispatch('restoreFromURL')}
  on:updateURL={(e) => dispatch('updateURL')}
  on:updateImages={(e) => dispatch('updateImages', e.detail)}
  on:startImageSelection={handleStartImageSelection}
  on:imageSelected={() => { isSelectingImage = false; }}
/>


  <!-- CONTENUTO CENTRALE -->
  <div class="flex flex-col flex-1 min-w-0">
    <!-- ✅ NUOVO: Banner modalità selezione -->
    {#if isSelectingImage}
      <div class="sticky top-0 z-50 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-4 shadow-xl border-b-2 border-green-700">
        <div class="flex items-center justify-between max-w-6xl mx-auto">
          <div class="flex items-center space-x-4">
            <div class="bg-white/20 p-2 rounded-lg">
              <svg class="w-6 h-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <p class="text-base font-bold">🎯 Image Selection Mode Active</p>
              <p class="text-sm opacity-90">Click any result below to add it to your query</p>
            </div>
          </div>
          <button
            on:click={handleCancelImageSelection}
            class="px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-all hover:scale-105 flex items-center space-x-2 shadow-lg"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    {/if}

    <svelte:component
      this={TopbarAny}
      {viewMode}
      {isSidebarOpen}
      {isSidebarRightOpen}
      on:toggleSidebar={onToggleSidebar}
      on:toggleRightSidebar={onToggleRightSidebar}
      on:zoomIn={onZoomIn}
      on:zoomOut={onZoomOut}
      on:changeViewMode={(e: any) => onChangeViewMode(e.detail.mode)}
    />

    <div class="content bg-gray-100 flex-1"
         style="height:calc(100% - var(--topbar-height)); transform:scale({contentScale});">

      <div class="flex-1 overflow-y-auto h-full" bind:this={container}>
        {#if isFirstVisit}
          <WelcomeHero
            on:getStarted={focusLeftTextarea}
            on:loadExample={(e) => onLoadExample(e.detail)}
          />
          
        {:else if searchLoading}
          <div class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="relative inline-block mb-6">
                <div class="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-ping absolute"></div>
                <div class="w-20 h-20 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              
              <h3 class="text-lg font-semibold text-gray-200 mb-2">
                Searching temporal sequences
              </h3>
              
              <p class="text-sm text-gray-400 mb-4">
                Analyzing {enabledTextareasCount()} steps...
              </p>
              
              <div class="flex items-center justify-center space-x-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.4s;"></div>
              </div>
            </div>
          </div>
          
        {:else if searchError}
          <svelte:component
            this={EmptyStateAny}
            type="no-results"
            title="Search error"
            description={searchError}
            actionLabel="Try Again"
            onAction={onRunSearch}
          />
          
        {:else if noResults}
          <svelte:component
            this={EmptyStateAny}
            type="no-results"
            onAction={focusLeftTextarea}
          >
            <div class="text-xs text-gray-500 space-y-1">
              <p>💡 <strong>Suggestions:</strong></p>
              <ul class="list-disc list-inside text-left inline-block">
                <li>Use broader keywords</li>
                <li>Remove some temporal steps</li>
                <li>Try different phrasing</li>
              </ul>
            </div>
          </svelte:component>
          
        {:else}
          <SearchResults
            {rows}
            selectedImage={selectedImage as any}
            {viewMode}
            registerContainer={registerContainer}
            isSelectionMode={isSelectingImage}
            on:open={handleImageClick}
            on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId)}
            on:videoSummary={(e) => onVideoSummary(e.detail.img.videoId, e.detail.img.imgId)}
            on:similarity={(e) => onSimilarity(e.detail.imgId)}
            on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
            on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
            on:submit={(e) => submitByImgId(e.detail.img.imgId)}
            on:selectImage={handleImageSelectedFromGrid}
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- Sidebar DESTRA -->
  <SidebarRight
    isOpen={isSidebarRightOpen}
    activeTab={sidebarRightTab}
    width={sidebarRightWidth}
    {rfPositive}
    {rfNegative}
    {submittedImages}
    on:removePositive={onRemovePositive}
    on:removeNegative={onRemoveNegative}
    on:openFromRF={(e) => onOpenFromRF(e.detail.index)}
    on:openFromSubmitted={(e) => onOpenFromSubmitted(e.detail.index)}
    on:resize={(e) => onResizeRightSidebar(e.detail.width)}
    on:toggleRightSidebar={onToggleRightSidebar}
    on:selectTab={(e) => dispatch('selectRightTab', e.detail)}
  />
</div>

<!-- Modal FUORI dal contenitore principale -->
<ImageModal
  isOpen={isModalOpen}
  image={selectedImage as any}
  total={totalImages}
  on:close={onCloseModal}
  on:prev={onPrev}
  on:next={onNext}
  on:submit={(e) => submitByImgId(e.detail.img.imgId)}
  on:videoSummary={(e) => onVideoSummary(e.detail.img.videoId, e.detail.img.imgId)}
  on:similarity={(e) => onSimilarity(e.detail.imgId)}
  on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
  on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
  on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId)}
/>
