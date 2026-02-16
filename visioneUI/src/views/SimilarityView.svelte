<script lang="ts">
  import SidebarSimilarity from "../components/SidebarSimilarity.svelte";
  import Topbar from "../components/Topbar.svelte";
  import SearchResults from "../components/SearchResults.svelte";
  import ImageModal from "../components/ImageModal.svelte";

  const TopbarAny = Topbar as any;

  type QueryTextarea = { value: string; enabled: boolean };
  type Img = { imgId?: string; videoId?: string; [key: string]: unknown };

  // Stato/props dal genitore (invariati)
  export let isSidebarOpen = true;
  export let contentScale = 1;
  export let viewMode = "byrank";

  export let rows: Img[][] = [];              // similarityDisplayRows
  export let simSelected: Img | null = null;
  export let simIsModalOpen = false;

  export let textareas: QueryTextarea[] = [];         // per SidebarSimilarity (identico a SidebarSearch)
  export let searchError: string | null = null;
  export let searchResultSet: unknown = null;
  export let rfPositive: Img[] = [];
  export let rfNegative: Img[] = [];
  export let submittedImages: Img[] = [];

  export let registerContainer = (_el: Element | null) => {};

  // Toolbar/controls
  export let onToggleSidebar = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};
  export let onChangeViewMode = (_mode: string) => {};

  // Sidebar azioni (riuso identico a SidebarSearch)
  export let onSelectTab = (_tab: string) => {};
  export let onAddTextarea = (_index: number) => {};
  export let onRemoveTextarea = (_index: number) => {};
  export let onToggleTextarea = (_index: number) => {};
  export let onUpdateTextarea = (_index: number, _value: string) => {};
  export let onRunSearch = () => {};
  export let onClearResults = () => {};
  export let onOpenFromRF = (_index: number) => {};
  export let onOpenFromSubmitted = (_index: number) => {};

  // Griglia azioni
  export let onVideoSummary = (_videoId: string, _imgId: string) => {};
  export let onSimilarity = (_imgId: string) => {};

  export let addRFPositiveByImg = (_imgId: string) => {};
  export let addRFNegativeByImg = (_imgId: string) => {};
  export let submitByImgId = (_imgId: string) => {};
  export let openByImgId = (_imgId: string) => {};
  export let openVideoPlayerBy = (_imgId: string, _videoId: string) => {}; // NUOVO


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

  <!-- Colonna principale (identica a SearchView) -->
 <div class="flex flex-col flex-1 min-w-0">
    <svelte:component
      this={TopbarAny}
      {viewMode}
      {isSidebarOpen}
      on:toggleSidebar={onToggleSidebar}
      on:zoomIn={onZoomIn}
      on:zoomOut={onZoomOut}
      on:changeViewMode={(e: any) => onChangeViewMode(e.detail.mode)}
    />

    <div class="content bg-gray-100 flex-1"
         style="height:calc(100% - var(--topbar-height)); transform:scale({contentScale});">

    <div class="h-full flex flex-col">
          <SearchResults
            rows={rows}
            selectedImage={simSelected as any}
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
  image={simSelected as any}
  total={(rows?.flat?.().length ?? 0)}
  on:close={onCloseSimModal}
  on:prev={onPrevSim}
  on:next={onNextSim}
/>




