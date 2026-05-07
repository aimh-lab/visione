<script lang="ts">
  import SidebarSimilarity from "../components/SidebarSimilarity.svelte";
  import SearchResults from "../components/SearchResults.svelte";
  import ImageModal from "../components/ImageModal.svelte";

  type QueryTextarea = { value: string; enabled: boolean };
  type Img = { imgId?: string; videoId?: string; [key: string]: unknown };

  // Parent-provided state/props (unchanged)
  export let isSidebarOpen = true;
  export let contentScale = 1;
  export let viewMode = "byrank";
  export let videoBadgeOrientation = "vertical";

  export let rows: Img[][] = [];              // similarityDisplayRows
  export let loading = false;
  export let error: string | null = null;
  export let simSelected: Img | null = null;
  export let simIsModalOpen = false;
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let justifyResultRows = false;
  export let tupleIndicatorMode = 'badge+bar';
  export let showSubmitUI = false;
  export let challengeType = "KIS";
  export let imageModalScale = 100;
  export let runtimeProfile = {};
  export let showLocalTimeInTitles = true;
  export let resultsetBadgeLabelMode = "both";

  export let textareas: QueryTextarea[] = [];         // for SidebarSimilarity (same shape as SidebarSearch)
  export let searchError: string | null = null;
  export let searchResultSet: unknown = null;
  export let rfPositive: Img[] = [];
  export let rfNegative: Img[] = [];
  export let submittedImages: Img[] = [];

  export let registerContainer = (_el: Element | null) => {};

  // Toolbar/controls
  export let onToggleSidebar = () => {};

  // Sidebar actions (same behavior as SidebarSearch)
  export let onSelectTab = (_tab: string) => {};
  export let onAddTextarea = (_index: number) => {};
  export let onRemoveTextarea = (_index: number) => {};
  export let onToggleTextarea = (_index: number) => {};
  export let onUpdateTextarea = (_index: number, _value: string) => {};
  export let onRunSearch = () => {};
  export let onClearResults = () => {};
  export let onOpenFromRF = (_index: number) => {};
  export let onOpenFromSubmitted = (_index: number) => {};

  // Grid actions
  export let onVideoSummary = (_videoId: string, _imgId: string) => {};
  export let onSimilarity = (_imgId: string, _img?: Img | null) => {};

  export let addRFPositiveByImg = (_imgId: string) => {};
  export let addRFNegativeByImg = (_imgId: string) => {};
  export let submitByImgId = (_imgId: string) => {};
  export let openByImgId = (_imgId: string) => {};
  export let openVideoPlayerBy = (_imgId: string, _videoId: string, _startAt?: number) => {};


  // Modal actions
  export let onCloseSimModal = () => {};
  export let onPrevSim = () => {};
  export let onNextSim = () => {};

  $: similarityTotal = rows.reduce((acc, row) => acc + (row?.length || 0), 0);
  $: hasSimilarityResults = similarityTotal > 0;
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 18vw, 360px);"  aria-label="Similarity View">
  <!-- Sidebar: uses SidebarSimilarity, aligned with SidebarSearch -->
  <SidebarSimilarity
    isSidebarOpen={isSidebarOpen}
    activeTab={"Search"}                
    {textareas}
    searchError={searchError as any}
    searchResultSet={searchResultSet as any}
    {rfPositive}
    {rfNegative}
    {submittedImages}
    on:selectTab={(e) => onSelectTab(e.detail.tab)}
    on:addTextarea={(e) => onAddTextarea(e.detail.index)}
    on:removeTextarea={(e) => onRemoveTextarea(e.detail.index)}
    on:toggleTextarea={(e) => onToggleTextarea(e.detail.index)}
    on:updateTextarea={(e) => onUpdateTextarea(e.detail.index, e.detail.value)}
    on:runSearch={onRunSearch}
    on:clearResults={onClearResults}
    on:openFromRF={(e) => onOpenFromRF(e.detail.index)}
    on:openFromSubmitted={(e) => onOpenFromSubmitted(e.detail.index)}
  />

  <!-- Main column (same structure as SearchView) -->
 <div class="flex flex-col flex-1 min-w-0">
    <div class="content bg-gray-100 flex-1"
         style="height:100%; zoom:{contentScale};">

    <div class="h-full flex flex-col">
      {#if loading}
        <div class="flex items-center justify-center h-full px-6">
          <div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
            <div class="relative inline-block mb-5">
              <div class="w-16 h-16 border-4 border-blue-200 rounded-full animate-ping absolute"></div>
              <div class="w-16 h-16 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Searching similar frames</h3>
            <p class="text-sm text-gray-500 leading-relaxed">Analyzing visual candidates...</p>
          </div>
        </div>
      {:else if error}
        <div class="flex items-center justify-center h-full px-6">
          <div class="w-full max-w-2xl rounded-2xl border border-red-200 bg-white shadow-sm p-8 text-center">
            <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Similarity search error</h3>
            <p class="text-sm text-gray-500 leading-relaxed mb-5">{error}</p>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              on:click={onToggleSidebar}
            >
              Review Query
            </button>
          </div>
        </div>
      {:else if !hasSimilarityResults}
        <div class="flex items-center justify-center h-full px-6">
          <div class="w-full max-w-2xl rounded-2xl border border-blue-200 bg-white shadow-sm p-8 text-center">
            <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">No similar frames yet</h3>
            <p class="text-sm text-gray-500 leading-relaxed mb-5">Run similarity from a frame to populate this view.</p>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              on:click={onToggleSidebar}
            >
              Open Controls
            </button>
          </div>
        </div>
      {:else}
          <SearchResults
            rows={rows}
            selectedImage={simSelected as any}
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
            registerContainer={registerContainer}
            on:open={(e) => openByImgId(e.detail.img.imgId)}
            on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId ?? e.detail.img.videoId, e.detail.startAt)}
            on:videoSummary={(e) => onVideoSummary(e.detail.img.videoId, e.detail.img.imgId)}
            on:similarity={(e) => onSimilarity(e.detail.imgId, e.detail.frame ?? e.detail.img ?? null)}
            on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
            on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
            on:submit={(e) => submitByImgId(e.detail.img.imgId)}
          />
      {/if}
      </div>
    </div>
  </div>
</div>
<ImageModal
  isOpen={simIsModalOpen}
  image={simSelected as any}
  total={similarityTotal}
  modalScale={imageModalScale}
  {showSubmitUI}
  {challengeType}
  {runtimeProfile}
  {showLocalTimeInTitles}
  on:close={onCloseSimModal}
  on:prev={onPrevSim}
  on:next={onNextSim}
  on:openVideoPlayer={(e) => {
    onCloseSimModal();
    openVideoPlayerBy(e.detail.imgId, e.detail.videoId, e.detail.startAt);
  }}
/>
