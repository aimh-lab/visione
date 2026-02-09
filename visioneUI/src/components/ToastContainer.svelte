<script>
  import { toasts } from '../stores/toastStore.js';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
</script>

<div class="fixed top-20 right-4 z-[9999] flex flex-col space-y-2 max-w-sm pointer-events-none">
  {#each $toasts as toast (toast.id)}
    <div
      class="pointer-events-auto rounded-lg shadow-2xl flex items-start space-x-3 backdrop-blur-md border overflow-hidden
             {toast.type === 'success' ? 'bg-green-600/95 border-green-500/50 text-white' : ''}
             {toast.type === 'error' ? 'bg-red-600/95 border-red-500/50 text-white' : ''}
             {toast.type === 'warning' ? 'bg-yellow-600/95 border-yellow-500/50 text-white' : ''}
             {toast.type === 'info' ? 'bg-blue-600/95 border-blue-500/50 text-white' : ''}"
      in:fly={{ x: 300, duration: 300, easing: quintOut }}
      out:fade={{ duration: 200 }}
    >
      <!-- Icon + Message -->
      <div class="flex items-start space-x-3 px-4 py-3 flex-1">
        <!-- Icon -->
        <div class="flex-shrink-0 mt-0.5">
          {#if toast.type === 'success'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          {:else if toast.type === 'error'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          {:else if toast.type === 'warning'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          {:else}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          {/if}
        </div>
        
        <!-- Message -->
        <span class="text-sm font-medium leading-relaxed">{toast.message}</span>
      </div>
      
      <!-- Close button -->
      <button
        on:click={() => toasts.remove(toast.id)}
        class="px-3 py-3 hover:bg-white/10 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      
      <!-- Progress bar (optional) -->
      {#if toast.duration > 0}
        <div 
          class="absolute bottom-0 left-0 h-1 bg-white/30"
          style="animation: shrink {toast.duration}ms linear forwards;"
        ></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
</style>
