<script>
  import { createEventDispatcher } from 'svelte';
  import { focusTrap } from '../utils/ui';
  
  export let isOpen = false;
  export let title = 'Input';
  export let icon = 'default';
  export let fields = []; // Array di { name, label, type, placeholder, value, min, max, step }
  export let description = '';
  
  const dispatch = createEventDispatcher();
  
  let formValues = {};
  
  // Inizializza form values dai fields
  $: if (isOpen && fields.length > 0) {
    formValues = fields.reduce((acc, field) => {
      acc[field.name] = field.value || '';
      return acc;
    }, {});
  }
  
  function handleSubmit() {
    dispatch('submit', formValues);
    close();
  }
  
  function close() {
    dispatch('close');
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
  }
  
  const iconMap = {
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>`,
    filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>`
  };
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      on:click={close}
      aria-label="Close modal"
    ></button>
    
    <!-- Modal -->
    <div 
      class="relative z-[1001] bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-700"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900">
        <div class="flex items-center space-x-3">
          <!-- Icon -->
          <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <div class="w-5 h-5 text-blue-400">
              {@html iconMap[icon] || iconMap.default}
            </div>
          </div>
          
          <div>
            <h3 class="text-lg font-bold text-white">{title}</h3>
            {#if description}
              <p class="text-xs text-gray-400 mt-0.5">{description}</p>
            {/if}
          </div>
        </div>
        
        <button 
          on:click={close}
          class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          aria-label="Close"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="px-6 py-5 space-y-4">
        {#each fields as field}
          {@const fieldId = `input-modal-${field.name}`}
          <div>
            <label for={fieldId} class="block text-sm font-medium text-gray-300 mb-2">
              {field.label}
              {#if field.required}
                <span class="text-red-400">*</span>
              {/if}
            </label>
            
            {#if field.type === 'textarea'}
              <textarea
                id={fieldId}
                bind:value={formValues[field.name]}
                placeholder={field.placeholder || ''}
                rows={field.rows || 3}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
              ></textarea>
            {:else if field.type === 'select'}
              <select
                id={fieldId}
                bind:value={formValues[field.name]}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
              >
                {#each field.options || [] as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            {:else}
              <input
                id={fieldId}
                type={field.type || 'text'}
                bind:value={formValues[field.name]}
                placeholder={field.placeholder || ''}
                min={field.min}
                max={field.max}
                step={field.step}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm"
              />
            {/if}
            
            {#if field.hint}
              <p class="text-xs text-gray-500 mt-1">{field.hint}</p>
            {/if}
          </div>
        {/each}
      </div>
      
      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between rounded-b-xl">
        <div class="text-xs text-gray-500">
          <kbd class="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Ctrl+Enter</kbd> to submit
        </div>
        <div class="flex space-x-3">
          <button
            on:click={close}
            class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={handleSubmit}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
  }
</style>
