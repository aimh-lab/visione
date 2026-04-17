<!-- src/components/VideoOverlay.svelte -->
<script>
  import { createEventDispatcher, onMount } from "svelte";
  export let videoUrl = "";
  export let start = 0;
  export let end = 0;
  const dispatch = createEventDispatcher();
  let videoEl;

  onMount(() => {
    // Seek quando metadata pronti
    const onLoaded = () => {
      try { videoEl.currentTime = start; } catch {}
      videoEl.play().catch(() => {});
    };
    const onTimeUpdate = () => {
      if (videoEl.currentTime >= end) {
        videoEl.pause();
        dispatch("close");
      }
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      videoEl?.removeEventListener("loadedmetadata", onLoaded);
      videoEl?.removeEventListener("timeupdate", onTimeUpdate);
      try { videoEl?.pause(); } catch {}
    };
  });
</script>

<div
  class="absolute inset-0 z-40"
  on:mouseleave={() => dispatch("close")}
  on:click={() => dispatch("close")}
  on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && dispatch("close")}
  role="button"
  tabindex="0"
  aria-label="Close video preview"
>
  <video
    bind:this={videoEl}
    src={videoUrl}
    class="w-full h-full object-cover rounded-lg"
    autoplay
    muted
    playsinline
  ></video>
</div>

<style>
/* optional: shadow/outline to separate from the image */
</style>
