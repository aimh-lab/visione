<script lang="ts">
  import VideoSidebar from "../components/VideoSidebar.svelte";
  import ResultsGrid from "../components/ResultsGrid.svelte";
  import ImageModal from "../components/ImageModal.svelte";
  const ResultsGridAny = ResultsGrid as any;

  type Frame = { imgId?: string; videoId?: string; [key: string]: unknown };

  export let isSidebarOpen = true;
  export let contentScale = 1;

  export let frames: Frame[] | null = null;
  export let loading = false;
  export let error: string | null = null;
  export let selectedFrameId: string | null = null;
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let justifyResultRows = false;
  export let videoBadgeOrientation = "vertical";
  export let showSubmitUI = false;
  export let challengeType = "KIS";

  export let registerContainer = (_el: Element | null) => {};

  export let onToggleSidebar = () => {};

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

  export let openVideoPlayerBy = (_imgId: string, _videoId: string, _startAt?: number) => {}; // NUOVO

  let containerEl: HTMLElement | null = null;
  $: if (containerEl) registerContainer(containerEl);

  // Converti frames in formato "rows" per ResultsGrid
  $: framesAsRows = frames ? [frames] : [];
  $: hasFrames = (frames?.length ?? 0) > 0;

    $: if (selectedFrameId) {
    const id = String(selectedFrameId);
      const el = document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
</script>

<div class="flex h-full w-full" style="--sidebar-width: clamp(200px, 18vw, 360px);"  aria-label="Video Summary">
  <VideoSidebar {isSidebarOpen} on:openOptions={() => {}} on:openFilters={() => {}} />

  <div class="flex flex-col flex-grow">
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
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Loading video keyframes</h3>
            <p class="text-sm text-gray-500 leading-relaxed">Fetching timeline frames for this video...</p>
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
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Video summary error</h3>
            <p class="text-sm text-gray-500 leading-relaxed mb-5">{error}</p>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              on:click={onToggleSidebar}
            >
              Back to Search
            </button>
          </div>
        </div>
      {:else if !hasFrames}
        <div class="flex items-center justify-center h-full px-6">
          <div class="w-full max-w-2xl rounded-2xl border border-blue-200 bg-white shadow-sm p-8 text-center">
            <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-800 mb-2">No keyframes to display</h3>
            <p class="text-sm text-gray-500 leading-relaxed mb-5">Open a video from results to populate this timeline view.</p>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              on:click={onToggleSidebar}
            >
              Open Search Panel
            </button>
          </div>
        </div>
      {:else}
            <svelte:component
              this={ResultsGridAny}
              items={framesAsRows}
              selectedId={selectedFrameId as any}
              layout="rows"
              showVideoSummary={false}
              {videoBadgeOrientation}
              {showSubmitUI}
              {challengeType}
              {justifyResultRows}
              virtualizeRows={virtualizationEnabled}
              virtualizeThreshold={virtualizationThreshold}
              {registerContainer}
                on:open={(e: any) => onOpenFrame(e.detail.frame)}
                on:openVideoPlayer={(e: any) => openVideoPlayerBy(e.detail.imgId, e.detail.videoId ?? e.detail.img.videoId, e.detail.startAt)}
                on:similarity={(e: any) => onSimilarity(e.detail.imgId)}
                on:rfPositive={(e: any) => addRFPositiveByImg(e.detail.img.imgId, e.detail.img)}
                on:rfNegative={(e: any) => addRFNegativeByImg(e.detail.img.imgId, e.detail.img)}
                on:submit={(e: any) => submitByImgId(e.detail.img.imgId, e.detail.img)}
            />
      {/if}
         
      </div>
    </div>
  </div>
</div>

<ImageModal
  isOpen={frameIsModalOpen}
  image={selectedFrame as any}
  total={totalFrames}
  {showSubmitUI}
  {challengeType}
  on:close={onCloseFrameModal}
  on:prev={onPrevFrame}
  on:next={onNextFrame}
/>
