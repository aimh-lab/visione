<script lang="ts">
  import VideoSidebar from "../components/VideoSidebar.svelte";
  import Topbar from "../components/Topbar.svelte";
  import ResultsGrid from "../components/ResultsGrid.svelte";
  import ImageModal from "../components/ImageModal.svelte";

  const TopbarAny = Topbar as any;
  const ResultsGridAny = ResultsGrid as any;

  type Frame = { imgId?: string; videoId?: string; [key: string]: unknown };

  export let isSidebarOpen = true;
  export let contentScale = 1;

  export let frames: Frame[] | null = null;
  export let selectedFrameId: string | null = null;
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;

  export let registerContainer = (_el: Element | null) => {};

  export let onToggleSidebar = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};

  export let onOpenFrame = (_frame: Frame) => {};
  export let onSimilarity = (_imgId: string) => {};
  export let addRFPositiveByImg = (..._args: any[]) => {};
  export let addRFNegativeByImg = (..._args: any[]) => {};
  export let submitByImgId = (..._args: any[]) => {};

  export let frameIsModalOpen = false;
  export let selectedFrame: Frame | null = null;
  export let totalFrames = 0;
  export let onCloseFrameModal = () => {};
  export let onPrevFrame = () => {};
  export let onNextFrame = () => {};

  export let openVideoPlayerBy = (_imgId: string, _videoId: string) => {}; // NUOVO

  let containerEl: HTMLElement | null = null;
  $: if (containerEl) registerContainer(containerEl);

  // Converti frames in formato "rows" per ResultsGrid
  $: framesAsRows = frames ? [frames] : [];

    $: if (selectedFrameId) {
    const id = String(selectedFrameId);
      const el = document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 18vw, 360px);"  aria-label="Video Summary">
  <VideoSidebar {isSidebarOpen} on:openOptions={() => {}} on:openFilters={() => {}} />

  <div class="flex flex-col flex-grow">
    <svelte:component
      this={TopbarAny}
      viewMode={"byrank"}
      {isSidebarOpen}
      on:toggleSidebar={onToggleSidebar}
      on:zoomIn={onZoomIn}
      on:zoomOut={onZoomOut}
    />

    <div class="content bg-gray-100 flex-1"
         style="height:calc(100% - var(--topbar-height)); transform:scale({contentScale});">

    <div class="h-full flex flex-col">
            <svelte:component
              this={ResultsGridAny}
              items={framesAsRows}
              selectedId={selectedFrameId as any}
              layout="rows"
              showVideoSummary={false}
              virtualizeRows={virtualizationEnabled}
              virtualizeThreshold={virtualizationThreshold}
              {registerContainer}
                on:open={(e: any) => onOpenFrame(e.detail.frame)}
                on:openVideoPlayer={(e: any) => openVideoPlayerBy(e.detail.imgId, e.detail.img.videoId)}
                on:similarity={(e: any) => onSimilarity(e.detail.imgId)}
                on:rfPositive={(e: any) => addRFPositiveByImg(e.detail.img.imgId, e.detail.img)}
                on:rfNegative={(e: any) => addRFNegativeByImg(e.detail.img.imgId, e.detail.img)}
                on:submit={(e: any) => submitByImgId(e.detail.img.imgId, e.detail.img)}
            />
         
      </div>
    </div>
  </div>
</div>

<ImageModal
  isOpen={frameIsModalOpen}
  image={selectedFrame as any}
  total={totalFrames}
  on:close={onCloseFrameModal}
  on:prev={onPrevFrame}
  on:next={onNextFrame}
/>
