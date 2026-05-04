<script>
  import { createEventDispatcher } from "svelte";
  import { focusTrap } from "../utils/ui";
  
  export let isOpen = false;
  export let theme = 'default';
  export let resultsAutoFit = true;
  export let keyframeSize = 130;
  export let resultsPerRow = 8;
  export let justifyResultRows = false;
  export let cacheEnabled = true;
  export let dedupeResults = true;
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let dresEnabled = false;
  export let dresChallengeType = 'KIS';
  export let dresSubmitServer = '';
  export let dresUsername = '';
  export let dresPassword = '';
  export let dresMemberId = '';
  export let autoTranslateQueries = true;
  export let showAutoTranslateToggle = true;
  export let temporalWindowSeconds = 50;
  export let videoPlayerModalMode = 'profile';
  export let imageModalScale = 100;
  export let slideshowModalScale = 100;
  export let modelSelectionPerStepEnabled = true;
  export let defaultTextModel = 'openclip_clip_vit_b_32';
  export let defaultImageModel = 'dinov2_base';
  export let availableModels = [];
  export let videoBadgeOrientation = 'vertical';
  export let futureOptionA = "";
  export let futureOptionB = false;

  const dispatch = createEventDispatcher();
  const FALLBACK_TEXT_MODEL = 'openclip_clip_vit_b_32';
  const FALLBACK_IMAGE_MODEL = 'dinov2_base';

  function normalizeAvailableModelEntry(input) {
    if (typeof input === 'string') {
      const name = input.trim();
      if (!name) return null;
      return { name, modalities: ['text', 'image'] };
    }

    if (!input || typeof input !== 'object') return null;
    const name = String(input?.name || '').trim();
    if (!name) return null;

    const modalities = Array.isArray(input?.modalities)
      ? input.modalities.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
      : [];

    return {
      name,
      modalities: modalities.length > 0 ? Array.from(new Set(modalities)) : ['text', 'image']
    };
  }

  function supportsTextModel(entry) {
    return entry.modalities.includes('text') || entry.modalities.includes('image+text');
  }

  function supportsImageModel(entry) {
    return entry.modalities.includes('image') || entry.modalities.includes('image+text');
  }

  let normalizedModelEntries = [];
  let textModelOptions = [];
  let imageModelOptions = [];

  $: normalizedModelEntries = (Array.isArray(availableModels) ? availableModels : [])
    .map((m) => normalizeAvailableModelEntry(m))
    .filter((m) => !!m);

  $: discoveredTextModels = Array.from(new Set(
    normalizedModelEntries.filter(supportsTextModel).map((m) => m.name).filter(Boolean)
  ));

  $: discoveredImageModels = Array.from(new Set(
    normalizedModelEntries.filter(supportsImageModel).map((m) => m.name).filter(Boolean)
  ));

  $: textModelOptions = discoveredTextModels.length > 0
    ? discoveredTextModels
    : [FALLBACK_TEXT_MODEL];

  $: imageModelOptions = discoveredImageModels.length > 0
    ? discoveredImageModels
    : [FALLBACK_IMAGE_MODEL];

  function buildLocalState() {
    return {
      theme,
      keyframeSize,
      resultsPerRow,
      resultsAutoFit,
      cacheEnabled,
      dedupeResults,
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
      autoTranslateQueries,
      showAutoTranslateToggle,
      temporalWindowSeconds,
      videoPlayerModalMode,
      imageModalScale,
      slideshowModalScale,
      modelSelectionPerStepEnabled,
      defaultTextModel,
      defaultImageModel,
      futureOptionA,
      futureOptionB
    };
  }

  let local = buildLocalState();
  let activeSettingsTab = 'general';
  let wasOpen = false;
  let themeTouched = false;
  let hasLocalEdits = false;
  const settingsTabs = [
    { id: 'general', label: 'General' },
    { id: 'search', label: 'Search' },
    { id: 'models', label: 'Models' },
    { id: 'performance', label: 'Performance' },
    { id: 'dres', label: 'DRES' }
  ];

  $: if (isOpen && !hasLocalEdits) {
    local = buildLocalState();
  }
  
  $: if (isOpen && !wasOpen) {
    local = buildLocalState();
    hasLocalEdits = false;
    themeTouched = false;
    activeSettingsTab = 'general';
  }

  $: wasOpen = isOpen;

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

  function save() {
    hasLocalEdits = true;
    const kf = Math.min(400, Math.max(80, Number(local.keyframeSize) || 130));
    const perRow = Math.min(10, Math.max(1, Number(local.resultsPerRow) || 8));
    const virtThreshold = Math.min(300, Math.max(10, Number(local.virtualizationThreshold) || 40));
    const safeTemporalWindowSeconds = Math.min(99999, Math.max(1, Number(local.temporalWindowSeconds) || 50));
    const safeVideoPlayerModalMode = ['profile', 'video', 'slideshow'].includes(local.videoPlayerModalMode)
      ? local.videoPlayerModalMode
      : 'profile';
    const safeImageModalScale = Math.min(400, Math.max(80, Math.round(Number(local.imageModalScale) || 160)));
    const safeSlideshowModalScale = Math.min(400, Math.max(80, Math.round(Number(local.slideshowModalScale) || 160)));
    const safeDefaultTextModelRaw = String(local.defaultTextModel || '').trim();
    const safeDefaultImageModelRaw = String(local.defaultImageModel || '').trim();
    const safeDefaultTextModel = textModelOptions.includes(safeDefaultTextModelRaw)
      ? safeDefaultTextModelRaw
      : (textModelOptions[0] || FALLBACK_TEXT_MODEL);
    const safeDefaultImageModel = imageModelOptions.includes(safeDefaultImageModelRaw)
      ? safeDefaultImageModelRaw
      : (imageModelOptions[0] || FALLBACK_IMAGE_MODEL);
    const currentTheme = ['default', 'dark', 'light'].includes(theme) ? theme : 'default';
    const safeTheme = themeTouched
      ? (['default', 'dark', 'light'].includes(local.theme) ? local.theme : currentTheme)
      : currentTheme;
    
    const newSettings = {
      theme: safeTheme,
      keyframeSize: kf,
      resultsPerRow: perRow,
      resultsAutoFit: !!local.resultsAutoFit,
      cacheEnabled: !!local.cacheEnabled,
      dedupeResults: !!local.dedupeResults,
      justifyResultRows: !!local.justifyResultRows,
      videoBadgeOrientation: ['horizontal', 'vertical'].includes(local.videoBadgeOrientation) ? local.videoBadgeOrientation : 'vertical',
      virtualizationEnabled: !!local.virtualizationEnabled,
      virtualizationThreshold: virtThreshold,
      dresEnabled: !!local.dresEnabled,
      dresChallengeType: ['KIS', 'AVS', 'Q&A'].includes(local.dresChallengeType) ? local.dresChallengeType : 'KIS',
      dresSubmitServer: (local.dresSubmitServer ?? '').trim(),
      dresUsername: (local.dresUsername ?? '').trim(),
      dresPassword: local.dresPassword ?? '',
      dresMemberId: (local.dresMemberId ?? '').trim(),
      autoTranslateQueries: !!local.autoTranslateQueries,
      showAutoTranslateToggle: !!local.showAutoTranslateToggle,
      temporalWindowSeconds: safeTemporalWindowSeconds,
      videoPlayerModalMode: safeVideoPlayerModalMode,
      imageModalScale: safeImageModalScale,
      slideshowModalScale: safeSlideshowModalScale,
      modelSelectionPerStepEnabled: !!local.modelSelectionPerStepEnabled,
      defaultTextModel: safeDefaultTextModel,
      defaultImageModel: safeDefaultImageModel,
      futureOptionA: local.futureOptionA,
      futureOptionB: !!local.futureOptionB
    };

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

  function handleTemporalWindowInput(event) {
    hasLocalEdits = true;
    const raw = String(event?.currentTarget?.value ?? '');
    if (raw.trim() === '') {
      // Allow clearing the field while typing; commit happens on blur.
      local.temporalWindowSeconds = '';
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    local.temporalWindowSeconds = Math.min(99999, Math.max(1, Math.trunc(parsed)));
    save();
  }

  function commitTemporalWindowInput() {
    const parsed = Number(local.temporalWindowSeconds);
    local.temporalWindowSeconds = Number.isFinite(parsed)
      ? Math.min(99999, Math.max(1, Math.trunc(parsed)))
      : 50;
    save();
  }

  function handleKeyframeSizeInput(event) {
    hasLocalEdits = true;
    const raw = String(event?.currentTarget?.value ?? '');
    if (raw.trim() === '') {
      local.keyframeSize = '';
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    local.keyframeSize = Math.min(400, Math.trunc(parsed));

    // Keep live preview responsive only when value is in a sensible visual range.
    if (local.keyframeSize >= 80 && local.keyframeSize <= 400) {
      document.documentElement.style.setProperty('--kf-size', `${local.keyframeSize}px`);
      document.documentElement.style.setProperty('--min-card-w', `${Math.round(local.keyframeSize * 1.1)}px`);
    }
  }

  function commitKeyframeSizeInput() {
    const parsed = Number(local.keyframeSize);
    const safe = Number.isFinite(parsed)
      ? Math.min(400, Math.max(80, Math.trunc(parsed)))
      : 130;

    local.keyframeSize = safe;
    document.documentElement.style.setProperty('--kf-size', `${safe}px`);
    document.documentElement.style.setProperty('--min-card-w', `${Math.round(safe * 1.1)}px`);
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
    
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg h-[66vh] max-h-[36rem] min-h-[24rem] flex flex-col overflow-hidden">
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

      <div class="px-5 pt-2 pb-0 border-b {local.theme === 'dark' ? 'border-slate-700 bg-transparent' : 'border-gray-200 bg-transparent'}">
        <div class="flex items-end gap-1 overflow-x-auto">
          {#each settingsTabs as tab}
            <button
              type="button"
              class="px-3 py-1 rounded-t-md text-[11px] font-medium border transition-colors whitespace-nowrap {activeSettingsTab === tab.id
                ? (local.theme === 'dark'
                  ? 'bg-slate-900 text-slate-100 border-slate-600 border-b-slate-900'
                  : 'bg-white text-gray-800 border-gray-300 border-b-white shadow-[0_-1px_0_rgba(255,255,255,0.65)_inset]')
                : (local.theme === 'dark'
                  ? 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-200'
                  : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-700')}"
              on:click={() => (activeSettingsTab = tab.id)}
              aria-pressed={activeSettingsTab === tab.id}
            >
              {tab.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="px-5 py-4 overflow-y-auto">
        {#if activeSettingsTab === 'general'}
          <div class="space-y-3">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">General</h4>

            <div class="flex items-center justify-between py-2">
              <label for="settings-theme" class="ui-settings-label text-sm font-medium text-gray-700">Theme</label>
              <select
                id="settings-theme"
                class="ui-settings-input ui-settings-select w-36 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                bind:value={local.theme}
                on:change={() => {
                  themeTouched = true;
                  save();
                }}
              >
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

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
                    on:input={handleKeyframeSizeInput}
                    on:blur={commitKeyframeSizeInput}
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

            <p class="ui-settings-hint -mt-1 mb-1 text-[11px] text-gray-500">
              In by video mode, rows are still capped by Results per row even when Auto-fit is enabled.
            </p>

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
          </div>
        {/if}

        {#if activeSettingsTab === 'search'}
          <div class="space-y-3">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search</h4>

            <div class="flex items-center justify-between py-2">
              <label for="settings-cache-enabled" class="ui-settings-label text-sm font-medium text-gray-700">Enable search cache</label>
              <input
                id="settings-cache-enabled"
                type="checkbox"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                bind:checked={local.cacheEnabled}
                on:change={() => save()}
              />
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-dedupe-results" class="ui-settings-label text-sm font-medium text-gray-700">Remove duplicate result IDs</label>
              <input
                id="settings-dedupe-results"
                type="checkbox"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                bind:checked={local.dedupeResults}
                on:change={() => save()}
              />
            </div>

            <p class="ui-settings-hint -mt-1 mb-1 text-[11px] text-gray-500">
              When disabled, all results are shown even with repeated imgId values.
            </p>

            <div class="flex items-center justify-between py-2">
              <label for="settings-auto-translate-toggle" class="ui-settings-label text-sm font-medium text-gray-700">Enable auto-translate</label>
              <input
                id="settings-auto-translate-toggle"
                type="checkbox"
                bind:checked={local.showAutoTranslateToggle}
                on:change={() => save()}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-temporal-window-seconds" class="ui-settings-label text-sm font-medium text-gray-700">Temporal window (seconds)</label>
              <div class="relative">
                <input
                  id="settings-temporal-window-seconds"
                  type="number"
                  min="1"
                  max="99999"
                  step="1"
                  class="ui-settings-input w-24 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                  bind:value={local.temporalWindowSeconds}
                  on:input={handleTemporalWindowInput}
                  on:blur={commitTemporalWindowInput}
                />
                <div class="ui-settings-stepper">
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Increase temporal window" on:click={() => adjustNumber('temporalWindowSeconds', 1, 1, 99999)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                  </button>
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease temporal window" on:click={() => adjustNumber('temporalWindowSeconds', -1, 1, 99999)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-video-player-modal-mode" class="ui-settings-label text-sm font-medium text-gray-700">Player modal mode (testing)</label>
              <select
                id="settings-video-player-modal-mode"
                class="ui-settings-input ui-settings-select w-44 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                bind:value={local.videoPlayerModalMode}
                on:change={() => save()}
              >
                <option value="profile">Use runtime profile</option>
                <option value="video">Force video player</option>
                <option value="slideshow">Force slideshow</option>
              </select>
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-image-modal-scale" class="ui-settings-label text-sm font-medium text-gray-700">Image preview size (px)</label>
              <div class="relative">
                <input
                  id="settings-image-modal-scale"
                  type="number"
                  min="80"
                  max="400"
                  step="10"
                  class="ui-settings-input w-24 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                  bind:value={local.imageModalScale}
                  on:input={() => save()}
                />
                <div class="ui-settings-stepper">
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Increase image modal size" on:click={() => adjustNumber('imageModalScale', 10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                  </button>
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease image modal size" on:click={() => adjustNumber('imageModalScale', -10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-slideshow-modal-scale" class="ui-settings-label text-sm font-medium text-gray-700">Slideshow preview size (px)</label>
              <div class="relative">
                <input
                  id="settings-slideshow-modal-scale"
                  type="number"
                  min="80"
                  max="400"
                  step="10"
                  class="ui-settings-input w-24 pr-7 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                  bind:value={local.slideshowModalScale}
                  on:input={() => save()}
                />
                <div class="ui-settings-stepper">
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Increase slideshow size" on:click={() => adjustNumber('slideshowModalScale', 10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 14l6-6 6 6"/></svg>
                  </button>
                  <button type="button" class="ui-settings-stepper-btn" aria-label="Decrease slideshow size" on:click={() => adjustNumber('slideshowModalScale', -10, 80, 400)}>
                    <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 10l6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if activeSettingsTab === 'models'}
          <div class="space-y-3">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Models</h4>

            <div class="flex items-center justify-between py-2">
              <label for="settings-model-selection-per-step" class="ui-settings-label text-sm font-medium text-gray-700">Enable model selection per step</label>
              <input
                id="settings-model-selection-per-step"
                type="checkbox"
                bind:checked={local.modelSelectionPerStepEnabled}
                on:change={() => save()}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-default-text-model" class="ui-settings-label text-sm font-medium text-gray-700">Default text model</label>
              <select
                id="settings-default-text-model"
                class="ui-settings-input ui-settings-select w-56 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                bind:value={local.defaultTextModel}
                on:change={() => save()}
              >
                {#each textModelOptions as m}
                  <option value={m}>{m}</option>
                {/each}
              </select>
            </div>

            <div class="flex items-center justify-between py-2">
              <label for="settings-default-image-model" class="ui-settings-label text-sm font-medium text-gray-700">Default image model</label>
              <select
                id="settings-default-image-model"
                class="ui-settings-input ui-settings-select w-56 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900"
                bind:value={local.defaultImageModel}
                on:change={() => save()}
              >
                {#each imageModelOptions as m}
                  <option value={m}>{m}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}

        {#if activeSettingsTab === 'performance'}
          <div class="space-y-3">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</h4>

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
        {/if}

        {#if activeSettingsTab === 'dres'}
          <div class="space-y-3">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">DRES Submit</h4>
            <p class="ui-settings-hint text-xs">Configure endpoint and credentials used for manual DRES submissions.</p>

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
