<script>
  export let timestamp = 0; // in secondi
  export let videoDuration = 0; // durata totale video in secondi
  export let showLabel = true;
  export let compact = false;
  
  $: timestampPercent = videoDuration > 0 ? (timestamp / videoDuration) * 100 : 0;
  
  function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="frame-timeline" class:compact>
  <!-- Timeline bar -->
  <div class="relative h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
    <!-- Progress fill -->
    <div 
      class="absolute h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
      style="width: {timestampPercent}%"
    ></div>
    
    <!-- Position marker -->
    <div 
      class="absolute w-1.5 h-3 bg-blue-400 rounded-full -top-0.75 shadow-lg transition-all duration-300"
      style="left: calc({timestampPercent}% - 3px)"
    >
      <!-- Pulse effect -->
      <div class="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
    </div>
  </div>
  
  <!-- Timestamp labels -->
  {#if showLabel}
    <div class="flex justify-between items-center mt-1 text-[10px] font-medium">
      <span class="text-gray-500">0:00</span>
      <span class="text-blue-400 font-bold">{formatTime(timestamp)}</span>
      <span class="text-gray-500">{formatTime(videoDuration)}</span>
    </div>
  {/if}
</div>

<style>
  .frame-timeline {
    width: 100%;
  }
  
  .frame-timeline.compact .relative {
    height: 1px;
  }
  
  .frame-timeline.compact .w-1\.5 {
    width: 1px;
    height: 2px;
  }
  
  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }
  
  .animate-ping {
    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
</style>
