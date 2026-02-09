<script>
  import SidebarSimilarity from "../components/SidebarSimilarity.svelte";
  import Topbar from "../components/Topbar.svelte";
  import SearchResults from "../components/SearchResults.svelte";
  import ImageModal from "../components/ImageModal.svelte";
  import ContentControls from "../components/ContentControls.svelte";

  // Stato/props dal genitore (invariati)
  export let isSidebarOpen = true;
  export let contentWidth = "100vw";
  export let contentScale = 1;
  export let viewMode = "byrank";

  export let similarityBaseImgId = null;
  export let similarityLoading = false;
  export let similarityError = null;
  export let rows = [];              // similarityDisplayRows
  export let simSelected = null;
  export let simIsModalOpen = false;

  export let textareas = [];         // per SidebarSimilarity (identico a SidebarSearch)
  export let searchLoading = false;  // se vuoi riusare controlli; altrimenti lascia false
  export let searchError = null;
  export let searchResultSet = null;
  export let rfPositive = [];
  export let rfNegative = [];
  export let submittedImages = [];

  export let registerContainer = (el) => {};

  // Toolbar/controls
  export let onToggleSidebar = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};
  export let onChangeViewMode = (mode) => {};

  // Sidebar azioni (riuso identico a SidebarSearch)
  export let onSelectTab = (tab) => {};
  export let onAddTextarea = (index) => {};
  export let onRemoveTextarea = (index) => {};
  export let onToggleTextarea = (index) => {};
  export let onUpdateTextarea = (index, value) => {};
  export let onRunSearch = () => {};
  export let onClearResults = () => {};
  export let onOpenFromRF = (index) => {};
  export let onOpenFromSubmitted = (index) => {};

  // Griglia azioni
  export let onVideoSummary = (videoId, imgId) => {};
  export let onSimilarity = (imgId) => {};

  export let addRFPositiveByImg = (index) => {};
  export let addRFNegativeByImg = (index) => {};
  export let submitByImgId = (index) => {};
  export let openByImgId = (imgId) => {};
  export let openVideoPlayerBy = (imgId, videoId) => {}; // NUOVO


  // Modale azioni
  export let onCloseSimModal = () => {};
  export let onPrevSim = () => {};
  export let onNextSim = () => {};
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 18vw, 360px);"  aria-label="Similarity View">
  <!-- Sidebar: ora con SidebarSimilarity, identica a SidebarSearch -->
  <SidebarSimilarity
    isSidebarOpen={isSidebarOpen}
    activeTab={"Search"}                
    {textareas}
    {searchLoading}
    {searchError}
    {searchResultSet}
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

  <!-- Colonna principale (identica a SearchView) -->
 <div class="flex flex-col flex-1 min-w-0">
    <Topbar
      {contentWidth}
      {viewMode}
      {isSidebarOpen}
      on:toggleSidebar={onToggleSidebar}
      on:zoomIn={onZoomIn}
      on:zoomOut={onZoomOut}
      on:changeViewMode={(e) => onChangeViewMode(e.detail.mode)}
    />

    <div class="content bg-gray-100 flex-1"
         style="height:calc(100% - var(--topbar-height)); transform:scale({contentScale});">

    <div class="h-full flex flex-col">
          <SearchResults
            rows={rows}
            selectedImage={simSelected}
            registerContainer={registerContainer}
            on:open={(e) => openByImgId(e.detail.img.imgId)}
            on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.img.videoId)}
            on:videoSummary={(e) => onVideoSummary(e.detail.img.videoId, e.detail.img.imgId)}
            on:similarity={(e) => onSimilarity(e.detail.imgId)}
            on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId)}
            on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId)}
            on:submit={(e) => submitByImgId(e.detail.img.imgId)}
          />
      </div>
    </div>
  </div>
</div>
<ImageModal
  isOpen={simIsModalOpen}
  image={simSelected}
  total={(rows?.flat?.().length ?? 0)}
  on:close={onCloseSimModal}
  on:prev={onPrevSim}
  on:next={onNextSim}
/>




