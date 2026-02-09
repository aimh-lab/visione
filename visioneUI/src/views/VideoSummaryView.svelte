<script>
  import VideoSidebar from "../components/VideoSidebar.svelte";
  import Topbar from "../components/Topbar.svelte";
  import ResultsGrid from "../components/ResultsGrid.svelte";
  import ContentControls from "../components/ContentControls.svelte";
  import ImageModal from "../components/ImageModal.svelte";

  export let isSidebarOpen = true;
  export let contentWidth = "100vw";
  export let contentScale = 1;

  export let view2Loading = false;
  export let view2Error = null;
  export let view2VideoId = null;
  export let frames = null;
  export let selectedFrameId = null;

  export let registerContainer = (el) => {};

  export let onToggleSidebar = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};

  export let onOpenFrame = (frame) => {};
  export let openByImgId = (imgId) => {};

  export let onSimilarity = (imgId) => {};
  export let addRFPositiveByImg = (imgId) => {};
  export let addRFNegativeByImg = (imgId) => {};
  export let submitByImgId = (imgId) => {};

  export let frameIsModalOpen = false;
  export let selectedFrame = null;
  export let totalFrames = 0;
  export let onCloseFrameModal = () => {};
  export let onPrevFrame = () => {};
  export let onNextFrame = () => {};

  export let openVideoPlayerBy = (imgId, videoId) => {}; // NUOVO

  let containerEl;
  $: if (containerEl) registerContainer(containerEl);

  // Converti frames in formato "rows" per ResultsGrid
  $: framesAsRows = frames ? [frames] : [];

  $: if (containerEl && selectedFrameId) {
    const id = String(selectedFrameId);
    const el = containerEl.querySelector(`[data-frame-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 18vw, 360px);"  aria-label="Video Summary">
  <VideoSidebar {isSidebarOpen} on:openOptions={() => {}} on:openFilters={() => {}} />

  <div class="flex flex-col flex-grow">
    <Topbar
      {contentWidth}
      viewMode={"byrank"}
      {isSidebarOpen}
      on:toggleSidebar={onToggleSidebar}
      on:zoomIn={onZoomIn}
      on:zoomOut={onZoomOut}
    />

    <div class="content bg-gray-100 flex-1"
         style="height:calc(100% - var(--topbar-height)); transform:scale({contentScale});">

    <div class="h-full flex flex-col">
            <ResultsGrid
              items={framesAsRows}
              selectedId={selectedFrameId}
              layout="rows"
              showVideoSummary={false}
              {registerContainer}
              on:open={(e) => onOpenFrame(e.detail.frame)}
              on:openVideoPlayer={(e) => openVideoPlayerBy(e.detail.imgId, e.detail.img.videoId)}
              on:similarity={(e) => onSimilarity(e.detail.imgId)}
              on:rfPositive={(e) => addRFPositiveByImg(e.detail.img.imgId, e.detail.img)}
              on:rfNegative={(e) => addRFNegativeByImg(e.detail.img.imgId, e.detail.img)}
              on:submit={(e) => submitByImgId(e.detail.img.imgId, e.detail.img)}
            />
         
      </div>
    </div>
  </div>
</div>

<ImageModal
  isOpen={frameIsModalOpen}
  image={selectedFrame}
  total={totalFrames}
  on:close={onCloseFrameModal}
  on:prev={onPrevFrame}
  on:next={onNextFrame}
/>
