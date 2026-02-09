<script>
  import { createEventDispatcher } from "svelte";
  import SubmitBadge from "./SubmitBadge.svelte";
  import OverlayButton from "./OverlayButton.svelte";
  import FrameTimeline from './FrameTimeline.svelte';

  export let img;
  export let selected = false;

  const dispatch = createEventDispatcher();

  const handleOpen         = () => dispatch("open",       { index: img.index, img });
  const handleVideoSummary = (e) => { e.stopPropagation(); dispatch("videoSummary", { img }); };
  const handleSimilarity   = (e) => { e.stopPropagation(); dispatch("similarity",   { imgId: img.imgId }); };
  const handleRFPositive   = (e) => { e.stopPropagation(); dispatch("rfPositive",   { index: img.index, img }); };
  const handleRFNegative   = (e) => { e.stopPropagation(); dispatch("rfNegative",   { index: img.index, img }); };
  const handleSubmit       = (e) => { e.stopPropagation(); dispatch("submit",       { index: img.index, img }); };
  
  // ✅ Estrai dati temporali
  $: timestamp = img.raw?.timestamp || img.timestamp || 0;
  $: videoDuration = img.raw?.videoDuration || img.videoDuration || 0;
  
  // ✅ Mostra timeline solo se abbiamo dati validi
  $: hasTimelineData = timestamp > 0 || videoDuration > 0;
</script>

<div class="image-card-wrapper">
  <button
    data-index={img.index}
    data-img-id={img.imgId}
    class="group relative bg-gray-300 rounded-t-lg overflow-hidden flex items-center justify-center
           cursor-pointer hover:bg-gray-400 transition-all focus:outline-none border-4 border-transparent"
    class:thumb-selected={selected}
    class:rounded-b-lg={!hasTimelineData}
    on:click={handleOpen}
  >
    <!-- Velo scuro -->
    <div class="image-overlay absolute inset-0 z-10 transition-colors pointer-events-none"></div>

    <!-- Overlay buttons -->
    <OverlayButton positionClass="top-2 left-2" title="Video Summary" aria={`Video Summary immagine ${img.index+1}`} on:click={handleVideoSummary}>
      <svg class="w-6 h-6 text-white drop-shadow-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </OverlayButton>

    <OverlayButton positionClass="top-2 left-10" title="Image similarity" aria={`Similarity per immagine ${img.index+1}`} on:click={handleSimilarity}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           class="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="9" cy="12" r="4" class="opacity-90"/>
        <circle cx="15" cy="12" r="4" class="opacity-90"/>
      </svg>
    </OverlayButton>

    <OverlayButton positionClass="top-0 left-16" title="RF positivo" aria={`RF positivo immagine ${img.index+1}`} on:click={handleRFPositive}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           class="w-8 h-8 text-green-400 drop-shadow-lg" fill="currentColor">
        <path d="M2 12h4v10H2z"/><path d="M8 12c0-1 0-3 2-4 1-1 3-1 4 0 1 1 1 3 0 4l-2 3v5H8v-8z"/>
      </svg>
    </OverlayButton>

    <OverlayButton positionClass="top-1 left-20" title="RF negativo" aria={`RF negativo immagine ${img.index+1}`} on:click={handleRFNegative}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           class="w-8 h-8 text-red-400 drop-shadow-lg" fill="currentColor">
        <path d="M22 12h-4V2h4z"/><path d="M16 12c0 1 0 3-2 4-1 1-3 1-4 0-1-1-1-3 0-4l2-3V4h5v8z"/>
      </svg>
    </OverlayButton>

    <OverlayButton positionClass="top-2 right-2" title="Submit risultato" aria={`Submit immagine ${img.index+1}`} on:click={handleSubmit}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           class="w-6 h-6 text-green-500 drop-shadow-lg bg-white/10 rounded-full p-0.5"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V7"/><path d="M5 12l7-7 7 7"/>
      </svg>
    </OverlayButton>

    <SubmitBadge submitted={!!img.submitted} />

    {#if img.url}
      <img src={img.url} alt={img.title} loading="lazy" class="block w-auto h-40 object-contain" />
    {:else}
      <div class="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
        Image {img.index + 1}
      </div>
    {/if}
  </button>

  <!-- ✅ TIMELINE sotto l'immagine -->
  {#if hasTimelineData}
    <div class="timeline-container bg-gray-800 px-2 py-2 rounded-b-lg border-4 border-t-0 border-transparent"
         class:thumb-selected={selected}>
      <FrameTimeline 
        {timestamp} 
        {videoDuration}
        showLabel={true}
      />
    </div>
  {/if}
</div>

<style>
  .image-card-wrapper {
    display: flex;
    flex-direction: column;
  }
  
  .thumb-selected { 
    border-color: #dc2626 !important; 
  }
  
  .timeline-container.thumb-selected {
    border-color: #dc2626 !important;
    border-top: none;
  }
  
  .image-overlay { 
    background-color: rgba(0,0,0,0); 
    pointer-events: none; 
    transition: background-color .18s ease; 
  }
  
  .group:hover .image-overlay { 
    background-color: rgba(0,0,0,0.28); 
  }
</style>
