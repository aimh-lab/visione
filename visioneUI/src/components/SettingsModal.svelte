<script>
  import { createEventDispatcher } from "svelte";
  import { focusTrap } from "../utils/ui.ts";
  import { appSettingsStore } from "../stores/persistentState.js"; // ✅ Importa store
  
  export let isOpen = false;
  export let theme = 'default';
  export let resultsAutoFit = true;
  export let keyframeSize = 130;
  export let resultsPerRow = 8;
  export let justifyResultRows = false;
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let dresEnabled = false;
  export let dresChallengeType = 'KIS';
  export let dresSubmitServer = '';
  export let dresUsername = '';
  export let dresPassword = '';
  export let dresMemberId = '';
  export let videoBadgeOrientation = 'vertical';
  export let futureOptionA = "";
  export let futureOptionB = false;

  const dispatch = createEventDispatcher();
  
  // ✅ Copia locale dei valori
  let local = {
    theme,
    keyframeSize,
    resultsPerRow,
    resultsAutoFit,
    justifyResultRows,
    videoBadgeOrientation,
    virtualizationEnabled,
    virtualizationThreshold,
    dresEnabled,
    dresChallengeType,
    dresSubmitServer,
    dresUsername,
    dresPassword,
    dresMemberId,
    futureOptionA,
    futureOptionB
  };
  let dresExpanded = false;
  
  // ✅ Aggiorna local quando modal si apre
  $: if (isOpen) {
    local = {
      theme,
      keyframeSize,
      resultsPerRow,
      resultsAutoFit,
      justifyResultRows,
      videoBadgeOrientation,
      virtualizationEnabled,
      virtualizationThreshold,
      dresEnabled,
      dresChallengeType,
      dresSubmitServer,
      dresUsername,
      dresPassword,
      dresMemberId,
      futureOptionA,
      futureOptionB
    };
    dresExpanded = false;
  }

  function close() { 
    dispatch('close'); 
  }

  function testDresConnection() {
    dispatch('testDres', {
      dresEnabled: !!local.dresEnabled,
      dresChallengeType: ['KIS', 'AVS', 'Q&A'].includes(local.dresChallengeType) ? local.dresChallengeType : 'KIS',
      dresSubmitServer: (local.dresSubmitServer ?? '').trim(),
      dresUsername: (local.dresUsername ?? '').trim(),
      dresPassword: local.dresPassword ?? '',
      dresMemberId: (local.dresMemberId ?? '').trim()
    });
  }

  // ✅ Salva in localStorage ogni volta che cambia qualcosa
  function save() {
    const kf = Math.min(400, Math.max(80, Number(local.keyframeSize) || 130));
    const perRow = Math.min(10, Math.max(1, Number(local.resultsPerRow) || 8));
    const virtThreshold = Math.min(300, Math.max(10, Number(local.virtualizationThreshold) || 40));
    
    const newSettings = {
      theme: ['default', 'dark', 'light'].includes(local.theme) ? local.theme : 'default',
      keyframeSize: kf,
      resultsPerRow: perRow,
      resultsAutoFit: !!local.resultsAutoFit,
      justifyResultRows: !!local.justifyResultRows,
      videoBadgeOrientation: ['horizontal', 'vertical'].includes(local.videoBadgeOrientation) ? local.videoBadgeOrientation : 'vertical',
      virtualizationEnabled: !!local.virtualizationEnabled,
      virtualizationThreshold: virtThreshold,
      dresEnabled: !!local.dresEnabled,
      dresSubmitServer: (local.dresSubmitServer ?? '').trim(),
      dresUsername: (local.dresUsername ?? '').trim(),
      dresPassword: local.dresPassword ?? '',
      dresMemberId: (local.dresMemberId ?? '').trim(),
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

  function adjustNumber(field, delta, min, max) {
    const current = Number(local[field]);
    const base = Number.isFinite(current) ? current : min;
    const next = Math.min(max, Math.max(min, base + delta));
    local[field] = next;

    if (field === 'keyframeSize') {
      document.documentElement.style.setProperty('--kf-size', `${next}px`);
      document.documentElement.style.setProperty('--min-card-w', `${Math.round(next * 1.1)}px`);
    }

    save();
  }
</script>

<!-- Template invariato, cambiano solo i binding on:input e on:change -->
{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:focusTrap class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      on:click={close}
      aria-label="Close settings"
    ></button>
    
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
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

      <div class="px-5 py-4 space-y-4 overflow-y-auto">
        <div>
          <h4 class="ui-settings-section-title text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Appearance</h4>

          <div class="flex items-center justify-between py-2">
            <label for="settings-theme" class="ui-settings-label text-sm font-medium text-gray-700">Theme</label>
            <select
              id="settings-theme"
              class="ui-settings-input ui-settings-select w-36 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
              bind:value={local.theme}
              on:change={() => save()}
            >
              <option value="default">Default</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div>
          <h4 class="ui-settings-section-title text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Display</h4>
          
          <div class="flex items-center justify-between py-2">
            <label for="settings-keyframe-size" class="ui-settings-label text-sm font-medium text-gray-700">Keyframe size</label>
            <div class="flex items-center space-x-2">
              <div class="relative">
                <input
                  id="settings-keyframe-size"
                  type="number"
                  min="80"
                  max="400"
                  step="10"
                  class="ui-settings-input w-20 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                  bind:value={local.keyframeSize}
                  on:input={(e) => {
                    const val = Math.min(400, Math.max(80, Number(e.currentTarget.value)||130));
                    local.keyframeSize = val;
                    document.documentElement.style.setProperty('--kf-size', `${val}px`);
                    document.documentElement.style.setProperty('--min-card-w', `${Math.round(val * 1.1)}px`);
                    save();
                  }}
                />
                <div class="ui-settings-stepper">
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Increase keyframe size" on:click={() => adjustNumber('keyframeSize', 10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                  </button>
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease keyframe size" on:click={() => adjustNumber('keyframeSize', -10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
              <span class="ui-settings-unit text-xs text-gray-500">px</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Layout</h4>
          
          <div class="flex items-center justify-between py-2">
            <label for="settings-results-per-row" class="ui-settings-label text-sm font-medium text-gray-700">Results per row</label>
            <div class="flex items-center space-x-3">
              <div class="relative">
                <input
                  id="settings-results-per-row"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  class="ui-settings-input w-16 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                  bind:value={local.resultsPerRow}
                  disabled={local.resultsAutoFit}
                  on:input={(e) => {
                    const n = Math.min(10, Math.max(1, Number(e.currentTarget.value)||8));
                    local.resultsPerRow = n;
                    save();
                  }}
                />
                <div class="ui-settings-stepper">
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Increase results per row" disabled={local.resultsAutoFit} on:click={() => adjustNumber('resultsPerRow', 1, 1, 10)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                  </button>
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease results per row" disabled={local.resultsAutoFit} on:click={() => adjustNumber('resultsPerRow', -1, 1, 10)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
              <div class="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="autofit"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  bind:checked={local.resultsAutoFit}
                  on:change={() => save()} 
                />
                <label for="autofit" class="ui-settings-hint text-xs font-medium text-gray-600 cursor-pointer">Auto-fit</label>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between py-2">
            <label for="settings-video-badge-orientation" class="ui-settings-label text-sm font-medium text-gray-700">Video badge</label>
            <select
              id="settings-video-badge-orientation"
              class="ui-settings-input ui-settings-select w-36 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
              bind:value={local.videoBadgeOrientation}
              on:change={() => save()}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>

          <div class="flex items-center justify-between py-2">
            <label for="settings-justify-result-rows" class="ui-settings-label text-sm font-medium text-gray-700">Justify result rows</label>
            <input
              id="settings-justify-result-rows"
              type="checkbox"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              bind:checked={local.justifyResultRows}
              on:change={() => save()}
            />
          </div>

          <div class="flex items-center justify-between py-2">
            <label for="virtualization-enabled" class="ui-settings-label text-sm font-medium text-gray-700">Virtualize results</label>
            <input
              id="virtualization-enabled"
              type="checkbox"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              bind:checked={local.virtualizationEnabled}
              on:change={() => save()}
            />
          </div>

          <div class="flex items-center justify-between py-2">
            <label for="virtualization-threshold" class="ui-settings-label text-sm font-medium text-gray-700">Virtualization threshold (rows)</label>
            <div class="relative">
              <input
                id="virtualization-threshold"
                type="number"
                min="10"
                max="300"
                step="5"
                class="ui-settings-input w-20 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                bind:value={local.virtualizationThreshold}
                disabled={!local.virtualizationEnabled}
                on:input={(e) => {
                  const n = Math.min(300, Math.max(10, Number(e.currentTarget.value) || 40));
                  local.virtualizationThreshold = n;
                  save();
                }}
              />
              <div class="ui-settings-stepper">
                <button type="button" class="ui-settings-stepper-btn" aria-label="Increase virtualization threshold" disabled={!local.virtualizationEnabled} on:click={() => adjustNumber('virtualizationThreshold', 5, 10, 300)}>
                  <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                </button>
                <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease virtualization threshold" disabled={!local.virtualizationEnabled} on:click={() => adjustNumber('virtualizationThreshold', -5, 10, 300)}>
                  <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            class="ui-settings-subsection w-full mb-2 px-3 py-2 inline-flex items-center justify-between text-left hover:border-blue-300 transition-colors"
            on:click={() => (dresExpanded = !dresExpanded)}
            aria-expanded={dresExpanded}
            aria-controls="dres-settings-panel"
            title={dresExpanded ? 'Collapse DRES settings' : 'Expand DRES settings'}
          >
            <div>
              <h4 class="ui-settings-section-title text-xs font-semibold text-gray-500 uppercase tracking-wider">DRES Submit</h4>
              <p class="ui-settings-hint text-[11px]">Connection and credentials</p>
            </div>
            <svg class="w-4 h-4 text-gray-500 transition-transform {dresExpanded ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {#if dresExpanded}
            <div id="dres-settings-panel" class="ui-settings-subsection mt-2 space-y-2.5 p-3">
              <p class="ui-settings-hint text-xs">
                Configure endpoint and credentials used for manual DRES submissions.
              </p>

              <div class="flex items-center justify-between py-1">
                <label for="dres-enabled" class="ui-settings-label text-sm font-medium text-gray-700">Enable DRES submit</label>
                <input
                  id="dres-enabled"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  bind:checked={local.dresEnabled}
                  on:change={() => save()}
                />
              </div>

            <div>
              <label for="dres-server" class="ui-settings-label block text-sm font-medium mb-1">Submit server URL</label>
              <input
                id="dres-server"
                type="text"
                placeholder="https://dres.example.org"
                class="ui-settings-input w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                bind:value={local.dresSubmitServer}
                disabled={!local.dresEnabled}
                on:change={() => save()}
              />
            </div>

            <div>
              <label for="dres-user" class="ui-settings-label block text-sm font-medium mb-1">Username</label>
              <input
                id="dres-user"
                type="text"
                class="ui-settings-input w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                bind:value={local.dresUsername}
                disabled={!local.dresEnabled}
                on:change={() => save()}
              />
            </div>

            <div>
              <label for="dres-password" class="ui-settings-label block text-sm font-medium mb-1">Password</label>
              <input
                id="dres-password"
                type="password"
                class="ui-settings-input w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                bind:value={local.dresPassword}
                disabled={!local.dresEnabled}
                on:change={() => save()}
              />
            </div>

              <div>
                <label for="dres-member-id" class="ui-settings-label block text-sm font-medium mb-1">Member ID (optional)</label>
                <input
                  id="dres-member-id"
                  type="text"
                  class="ui-settings-input w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                  bind:value={local.dresMemberId}
                  disabled={!local.dresEnabled}
                  on:change={() => save()}
                />
              </div>

              <div class="pt-1">
                <button
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={testDresConnection}
                  disabled={!local.dresEnabled || !local.dresSubmitServer || !local.dresUsername || !local.dresPassword}
                >
                  Test DRES connection
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end">
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
