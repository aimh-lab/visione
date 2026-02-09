<script>
  import { createEventDispatcher } from "svelte";
  import { appSettingsStore } from "../stores/persistentState.js"; // ✅ Importa store
  
  export let isOpen = false;
  export let resultsAutoFit = false;
  export let keyframeSize = 160;
  export let resultsPerRow = 5;
  export let futureOptionA = "";
  export let futureOptionB = false;

  const dispatch = createEventDispatcher();
  
  // ✅ Copia locale dei valori
  let local = { keyframeSize, resultsPerRow, resultsAutoFit, futureOptionA, futureOptionB };
  
  // ✅ Aggiorna local quando modal si apre
  $: if (isOpen) local = { keyframeSize, resultsPerRow, resultsAutoFit, futureOptionA, futureOptionB };

  function close() { 
    dispatch('close'); 
  }

  // ✅ Salva in localStorage ogni volta che cambia qualcosa
  function save() {
    const kf = Math.min(400, Math.max(80, Number(local.keyframeSize) || 160));
    const perRow = Math.min(10, Math.max(1, Number(local.resultsPerRow) || 5));
    
    const newSettings = {
      keyframeSize: kf,
      resultsPerRow: perRow,
      resultsAutoFit: !!local.resultsAutoFit,
      futureOptionA: local.futureOptionA,
      futureOptionB: !!local.futureOptionB
    };


    
  // Salva nello store persistente
  appSettingsStore.update(s => {
    const updated = { ...s, ...newSettings };
    return updated;
  });
  
  // Verifica cosa c'è in localStorage
  
    
    // ✅ Dispatch evento per aggiornare UI (opzionale, se vuoi mantenerlo)
    dispatch('save', newSettings);
  }
</script>

<!-- Template invariato, cambiano solo i binding on:input e on:change -->
{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={close}></div>
    
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01c.23.56.78.92 1.39 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <h3 class="text-lg font-semibold text-gray-800">Settings</h3>
        </div>
        <button class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" on:click={close} aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 space-y-6">
        <div>
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Display</h4>
          
          <div class="flex items-center justify-between py-2">
            <label class="text-sm font-medium text-gray-700">Keyframe size</label>
            <div class="flex items-center space-x-2">
              <input
                type="number"
                min="80"
                max="400"
                step="10"
                class="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                bind:value={local.keyframeSize}
                on:input={(e) => {
                  const val = Math.min(400, Math.max(80, Number(e.currentTarget.value)||160));
                  local.keyframeSize = val;
                  document.documentElement.style.setProperty('--kf-size', `${val}px`);
                  document.documentElement.style.setProperty('--min-card-w', `${Math.round(val * 1.1)}px`);
                  save(); // ✅ Salva automaticamente
                }}
              />
              <span class="text-xs text-gray-500">px</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Layout</h4>
          
          <div class="flex items-center justify-between py-2">
            <label class="text-sm font-medium text-gray-700">Results per row</label>
            <div class="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                class="w-16 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                bind:value={local.resultsPerRow}
                disabled={local.resultsAutoFit}
                on:input={(e) => {
                  const n = Math.min(10, Math.max(1, Number(e.currentTarget.value)||5));
                  local.resultsPerRow = n;
                  save(); // ✅ Salva automaticamente
                }}
              />
              <div class="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="autofit"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  bind:checked={local.resultsAutoFit}
                  on:change={() => save()} 
                />
                <label for="autofit" class="text-xs font-medium text-gray-600 cursor-pointer">Auto-fit</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end">
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          on:click={close}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
