<script>
  import { queryTemplates } from '../stores/queryTemplates.js';
  import { toasts } from '../stores/toastStore.js';
  import { tick } from 'svelte';
  
  export let textareas = [];
  export let onLoad = (queries) => {};
  export let headerless = false;
  export let expanded = false;
  //export let onRunSearch = () => {};
  
  let isExpanded = false;
  let showSaveDialog = false;
  let saveName = '';
  let editingId = null;
  let editingName = '';
  $: effectiveExpanded = headerless ? expanded : isExpanded;
  
  $: activeQueries = textareas
    .filter(t => t.enabled && t.value?.trim())
    .map(t => t.value);
  
  $: canSave = activeQueries.length > 0;
  
  function handleSaveTemplate() {
    if (!saveName.trim()) {
      toasts.warning('Please enter a template name');
      return;
    }
    
    queryTemplates.add(saveName, activeQueries);
    toasts.success(`Template "${saveName}" saved! ✓`);
    saveName = '';
    showSaveDialog = false;
  }
  
  async function handleLoadTemplate(template) {
    onLoad(template.queries);
    toasts.info(`Loaded: ${template.name}`);
    //setTimeout(() => onRunSearch(), 300);
    //await tick();
    //onRunSearch();
  }
  
  function handleDeleteTemplate(id, name) {
    if (window.confirm(`Delete template "${name}"?`)) {
      queryTemplates.delete(id);
      toasts.info(`Deleted: ${name}`);
    }
  }
  
  function handleStartRename(template) {
    editingId = template.id;
    editingName = template.name;
  }
  
  function handleConfirmRename() {
    if (editingName.trim()) {
      queryTemplates.rename(editingId, editingName);
      toasts.success('Template renamed');
    }
    editingId = null;
    editingName = '';
  }
</script>

<div class="query-templates-panel bg-gray-900 border border-gray-700 rounded-lg">
  {#if !headerless}
    <!-- Header -->
    <button
      on:click={() => isExpanded = !isExpanded}
      class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 transition-transform {isExpanded ? 'rotate-90' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <span class="font-semibold text-gray-200">Query Templates</span>
        <span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
          {$queryTemplates.length}
        </span>
      </div>
    </button>
  {/if}
  
  <!-- Content -->
  {#if effectiveExpanded}
    <div class="px-4 py-3 border-t border-gray-700 space-y-2">
      <!-- Save current query -->
      {#if canSave}
        {#if showSaveDialog}
          <div class="bg-gray-800/50 rounded-lg p-3 space-y-2 mb-3">
            <input
              type="text"
              placeholder="Template name (e.g., 'Person → Car')"
              bind:value={saveName}
              on:keydown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              class="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div class="flex space-x-2">
              <button
                on:click={handleSaveTemplate}
                class="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                Save
              </button>
              <button
                on:click={() => showSaveDialog = false}
                class="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <button
            on:click={() => showSaveDialog = true}
            class="w-full px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded transition-colors border border-green-600/30 font-medium"
          >
            + Save Current Query
          </button>
        {/if}
      {:else}
        <div class="px-3 py-2 bg-gray-800/30 text-gray-500 text-xs rounded text-center">
          Create a query first
        </div>
      {/if}
      
      <!-- Templates list -->
      {#if $queryTemplates.length > 0}
        <div class="mt-3 space-y-1 max-h-80 overflow-y-auto">
          {#each $queryTemplates as template (template.id)}
            <div class="bg-gray-800/50 hover:bg-gray-800 rounded-lg p-2.5 flex items-center justify-between group transition-colors">
              <!-- Template info -->
              <div class="flex-1 min-w-0">
                {#if editingId === template.id}
                  <input
                    type="text"
                    bind:value={editingName}
                    on:keydown={(e) => e.key === 'Enter' && handleConfirmRename()}
                    on:blur={handleConfirmRename}
                    class="w-full px-2 py-1 bg-gray-900 border border-blue-500 rounded text-xs text-white focus:outline-none"
                  />
                {:else}
                  <div>
                    <p class="text-xs font-medium text-gray-200 truncate">{template.name}</p>
                    <p class="text-[10px] text-gray-500 truncate">
                      {template.queries.join(' → ')}
                    </p>
                  </div>
                {/if}
              </div>
              
              <!-- Actions -->
              <div class="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  on:click={() => handleLoadTemplate(template)}
                  class="p-1 hover:bg-blue-600/30 text-blue-400 rounded transition-colors"
                  title="Load template"
                  aria-label="Load template"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 19V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <path d="M7 10h10M7 14h10" stroke="currentColor" stroke-width="2" fill="none"/>
                  </svg>
                </button>
                
                <button
                  on:click={() => handleStartRename(template)}
                  class="p-1 hover:bg-yellow-600/30 text-yellow-400 rounded transition-colors"
                  title="Rename"
                  aria-label="Rename template"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                
                <button
                  on:click={() => handleDeleteTemplate(template.id, template.name)}
                  class="p-1 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                  title="Delete template"
                  aria-label="Delete template"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-4 text-gray-500 text-xs">
          No templates yet. Save one to get started!
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .query-templates-panel ::-webkit-scrollbar {
    width: 6px;
  }
  
  .query-templates-panel ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
  }
  
  .query-templates-panel ::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.3);
    border-radius: 3px;
  }
  
  .query-templates-panel ::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.5);
  }
</style>
