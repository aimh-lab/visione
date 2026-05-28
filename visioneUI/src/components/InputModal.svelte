<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { focusTrap } from '../utils/ui';
  
  export let isOpen = false;
  export let title = 'Input';
  export let icon = 'default';
  export let fields = []; // Array di { name, label, type, placeholder, value, min, max, step }
  export let description = '';
  export let submitLabel = 'Submit';
  export let cancelLabel = 'Cancel';
  export let submitOnEnter = false;
  export let autoFocusFirstTextInput = false;
  
  const dispatch = createEventDispatcher();
  
  let formValues = {};
  let showAdvancedFields = false;
  let contentEl;
  let wasOpen = false;

  const DATE_PART_KEYS = ['day', 'month', 'year', 'hour'];
  const DATE_PART_MAX = { day: 2, month: 2, year: 4, hour: 2 };
  const DATE_PART_LABEL = { day: 'DD', month: 'MM', year: 'YYYY', hour: 'HH' };
  const DATE_FIX_PARTS = ['year', 'month', 'day', 'hour'];
  const DATE_FIX_LABEL = { year: 'Year', month: 'Month', day: 'Day', hour: 'Hour' };
  const DATE_FIX_MAX = { year: 4, month: 2, day: 2, hour: 2 };

  function defaultDateFixes() {
    return {
      year: [],
      month: [],
      day: [],
      hour: []
    };
  }

  function normalizeDateFixEntry(raw) {
    return {
      comparator: String(raw?.comparator || 'eq').trim().toLowerCase() || 'eq',
      value: String(raw?.value || '')
    };
  }

  function mergePinnedIntoDateParts(partsValue, fixedValue) {
    void fixedValue;

    const parts = partsValue && typeof partsValue === 'object'
      ? {
          day: String(partsValue.day || ''),
          month: String(partsValue.month || ''),
          year: String(partsValue.year || ''),
          hour: String(partsValue.hour || '')
        }
      : { day: '', month: '', year: '', hour: '' };

    return parts;
  }

  $: visibleFields = Array.isArray(fields)
    ? fields.filter((field) => {
        const passesAdvanced = showAdvancedFields || !field?.advanced;
        if (!passesAdvanced) return false;

        if (typeof field?.visibleWhen === 'function') {
          try {
            return !!field.visibleWhen(formValues);
          } catch {
            return true;
          }
        }

        return true;
      })
    : [];

  $: hasAdvancedFields = Array.isArray(fields)
    ? fields.some((field) => !!field?.advanced)
    : false;

  $: if (isOpen && !wasOpen && autoFocusFirstTextInput) {
    void focusFirstTextInput();
  }

  $: wasOpen = isOpen;
  
  // Inizializza form values dai fields
  $: if (isOpen && fields.length > 0) {
    showAdvancedFields = false;
    formValues = fields.reduce((acc, field) => {
      if (field.type === 'checkbox') {
        acc[field.name] = !!field.value;
      } else if (field.type === 'dateParts') {
        const raw = field.value && typeof field.value === 'object' ? field.value : {};
        const pinTarget = typeof field.pinTarget === 'string' ? field.pinTarget : '';
        const fixedRaw = pinTarget && acc[pinTarget] && typeof acc[pinTarget] === 'object'
          ? acc[pinTarget]
          : null;
        acc[field.name] = mergePinnedIntoDateParts(raw, fixedRaw);
      } else if (field.type === 'dateFixes') {
        const base = defaultDateFixes();
        const raw = field.value && typeof field.value === 'object' ? field.value : {};
        DATE_FIX_PARTS.forEach((part) => {
          const source = raw?.[part];
          if (Array.isArray(source)) {
            base[part] = source.map((entry) => normalizeDateFixEntry(entry));
            return;
          }

          if (source && typeof source === 'object' && source.enabled) {
            base[part] = [normalizeDateFixEntry(source)];
            return;
          }

          base[part] = [];
        });
        acc[field.name] = base;
      } else {
        acc[field.name] = field.value || '';
      }
      return acc;
    }, {});
  }

  function getDatePartsValue(fieldName) {
    const raw = formValues?.[fieldName];
    return raw && typeof raw === 'object'
      ? {
          day: String(raw.day || ''),
          month: String(raw.month || ''),
          year: String(raw.year || ''),
          hour: String(raw.hour || '')
        }
      : { day: '', month: '', year: '', hour: '' };
  }

  function updateDatePart(fieldName, part, value) {
    const next = getDatePartsValue(fieldName);
    next[part] = value;
    formValues = { ...formValues, [fieldName]: next };
  }

  function focusDatePart(fieldName, partIndex) {
    if (!contentEl) return;
    const target = contentEl.querySelector(
      `[data-date-parts-field="${fieldName}"][data-part-index="${partIndex}"]`
    );
    if (!target || target.disabled) return;
    target.focus();
    target.select?.();
  }

  function handleDatePartInput(fieldName, part, partIndex, event) {
    const input = event.currentTarget;
    const digitsOnly = String(input?.value || '').replace(/\D+/g, '');
    const maxLen = DATE_PART_MAX[part] || 2;
    const nextValue = digitsOnly.slice(0, maxLen);

    updateDatePart(fieldName, part, nextValue);

    if (nextValue.length >= maxLen && partIndex < DATE_PART_KEYS.length - 1) {
      setTimeout(() => focusDatePart(fieldName, partIndex + 1), 0);
    }
  }

  function handleDatePartKeyDown(fieldName, partIndex, event) {
    const input = event.currentTarget;
    const valueLength = String(input?.value || '').length;
    const caretStart = typeof input?.selectionStart === 'number' ? input.selectionStart : valueLength;
    const caretEnd = typeof input?.selectionEnd === 'number' ? input.selectionEnd : valueLength;

    if (event.key === 'ArrowRight' && caretStart === valueLength && caretEnd === valueLength && partIndex < DATE_PART_KEYS.length - 1) {
      event.preventDefault();
      focusDatePart(fieldName, partIndex + 1);
      return;
    }

    if (event.key === 'ArrowLeft' && caretStart === 0 && caretEnd === 0 && partIndex > 0) {
      event.preventDefault();
      focusDatePart(fieldName, partIndex - 1);
    }
  }

  function getDateFixesValue(fieldName) {
    const raw = formValues?.[fieldName];
    const base = defaultDateFixes();
    if (!raw || typeof raw !== 'object') return base;

    DATE_FIX_PARTS.forEach((part) => {
      const source = raw?.[part];
      if (Array.isArray(source)) {
        base[part] = source.map((entry) => normalizeDateFixEntry(entry));
        return;
      }
      if (source && typeof source === 'object' && source.enabled) {
        base[part] = [normalizeDateFixEntry(source)];
        return;
      }
      base[part] = [];
    });

    return base;
  }

  function addDateFixEntry(fieldName, part, initial = {}) {
    const next = getDateFixesValue(fieldName);
    next[part] = [...next[part], normalizeDateFixEntry(initial)];
    formValues = { ...formValues, [fieldName]: next };
  }

  function removeDateFixEntry(fieldName, part, index) {
    const next = getDateFixesValue(fieldName);
    next[part] = next[part].filter((_, i) => i !== index);
    formValues = { ...formValues, [fieldName]: next };
  }

  function updateDateFixEntry(fieldName, part, index, patch) {
    const next = getDateFixesValue(fieldName);
    next[part] = next[part].map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    formValues = { ...formValues, [fieldName]: next };
  }

  function handleDateFixValueInput(fieldName, part, index, event) {
    const input = event.currentTarget;
    const digitsOnly = String(input?.value || '').replace(/\D+/g, '');
    const maxLen = DATE_FIX_MAX[part] || 2;
    updateDateFixEntry(fieldName, part, index, { value: digitsOnly.slice(0, maxLen) });
  }

  function handleSubmit() {
    dispatch('submit', formValues);
    close();
  }
  
  function close() {
    dispatch('close');
  }

  function isTextLikeField(field) {
    const type = String(field?.type || 'text').trim().toLowerCase();
    return type === 'text' || type === 'search' || type === 'url' || type === 'number' || type === 'textarea';
  }

  async function focusFirstTextInput() {
    await tick();
    // focusTrap sets focus after ~50ms on modal open; run after that to keep text input focused.
    setTimeout(() => {
      if (!contentEl) return;

      const field = contentEl.querySelector('input[type="text"], input[type="search"], input[type="url"], input[type="number"], textarea');
      if (!field || field.disabled) return;

      field.focus();
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.select?.();
      }
    }, 90);
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') close();

    if (e.key !== 'Enter') return;

    const target = e.target;
    const isTextarea = target instanceof HTMLTextAreaElement;

    if (submitOnEnter && !isTextarea) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
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
  <div use:focusTrap class="fixed inset-0 z-[var(--z-dialog-overlay)] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      on:click={close}
      aria-label="Close modal"
    ></button>
    
    <!-- Modal -->
    <div 
      class="relative z-[var(--z-dialog-content)] bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-700"
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
      <div bind:this={contentEl} class="px-6 py-5 space-y-4">
        {#each visibleFields as field, fieldIndex}
          {@const fieldId = `input-modal-${field.name}`}
          {@const shouldAutofocus = autoFocusFirstTextInput && fieldIndex === 0 && isTextLikeField(field)}
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
                autofocus={shouldAutofocus}
                bind:value={formValues[field.name]}
                placeholder={field.placeholder || ''}
                rows={field.rows || 3}
                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
              ></textarea>
            {:else if field.type === 'checkbox'}
              <label class="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  id={fieldId}
                  type="checkbox"
                  bind:checked={formValues[field.name]}
                  class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
                <span class="text-sm text-gray-300">{field.placeholder || field.label}</span>
              </label>
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
            {:else if field.type === 'preview'}
              <div
                id={fieldId}
                class="w-full px-3 py-2 bg-gray-800/70 border border-gray-700 rounded-lg text-emerald-200 font-mono text-sm break-words"
              >
                {field.computePreview ? field.computePreview(formValues) : ''}
              </div>
            {:else if field.type === 'dateFixes'}
              {@const dateFixesValue = getDateFixesValue(field.name)}
              <div id={fieldId} class="space-y-2.5 rounded-lg border border-gray-700 bg-gray-800/50 p-2.5">
                <div class="flex flex-wrap gap-2">
                  {#each DATE_FIX_PARTS as part}
                    <button
                      type="button"
                      on:click={() => addDateFixEntry(field.name, part)}
                      class="px-2.5 py-1 rounded-full text-xs border transition-colors bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500"
                    >
                      + {DATE_FIX_LABEL[part]}
                    </button>
                  {/each}
                </div>

                {#each DATE_FIX_PARTS as part}
                  {#each dateFixesValue[part] as entry, fixIndex}
                    <div class="grid grid-cols-[86px_1fr_auto] gap-2 items-center">
                      <div class="text-xs text-gray-300">{DATE_FIX_LABEL[part]}</div>
                      <div class="grid grid-cols-[92px_1fr] gap-2">
                        <select
                          value={entry.comparator}
                          on:change={(event) => updateDateFixEntry(field.name, part, fixIndex, { comparator: String(event.currentTarget?.value || 'eq') })}
                          class="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                          aria-label={`${DATE_FIX_LABEL[part]} comparator`}
                        >
                          <option value="eq">=</option>
                          <option value="ne">!=</option>
                          <option value="gte">&gt;=</option>
                          <option value="lte">&lt;=</option>
                          <option value="gt">&gt;</option>
                          <option value="lt">&lt;</option>
                        </select>
                        <input
                          type="text"
                          inputmode="numeric"
                          maxlength={DATE_FIX_MAX[part]}
                          value={entry.value}
                          placeholder={part === 'year' ? 'YYYY' : part === 'month' ? 'MM' : part === 'day' ? 'DD' : 'HH'}
                          on:input={(event) => handleDateFixValueInput(field.name, part, fixIndex, event)}
                          class="px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-mono text-sm"
                          aria-label={`${DATE_FIX_LABEL[part]} value`}
                        />
                      </div>
                      <button
                        type="button"
                        on:click={() => removeDateFixEntry(field.name, part, fixIndex)}
                        class="px-2 py-1 text-xs rounded border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                        aria-label={`Remove ${DATE_FIX_LABEL[part]} constraint`}
                      >
                        Remove
                      </button>
                    </div>
                  {/each}
                {/each}
              </div>
            {:else if field.type === 'dateParts'}
              {@const datePartsValue = getDatePartsValue(field.name)}
              <div id={fieldId} class="grid grid-cols-4 gap-2">
                {#each DATE_PART_KEYS as part, partIndex}
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength={DATE_PART_MAX[part]}
                    data-date-parts-field={field.name}
                    data-part-index={partIndex}
                    value={datePartsValue[part]}
                    placeholder={DATE_PART_LABEL[part]}
                    on:input={(event) => handleDatePartInput(field.name, part, partIndex, event)}
                    on:keydown={(event) => handleDatePartKeyDown(field.name, partIndex, event)}
                    class="w-full px-2.5 py-2 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-sm text-center bg-gray-800 border border-gray-700 focus:border-blue-500"
                    aria-label={`${field.label} ${DATE_PART_LABEL[part]}`}
                    title={`${field.label} ${DATE_PART_LABEL[part]}`}
                  />
                {/each}
              </div>
            {:else}
              <input
                id={fieldId}
                type={field.type || 'text'}
                autofocus={shouldAutofocus}
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

        {#if hasAdvancedFields}
          <div class="pt-1">
            <button
              type="button"
              class="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              on:click={() => (showAdvancedFields = !showAdvancedFields)}
              aria-expanded={showAdvancedFields}
            >
              <svg class="w-3.5 h-3.5 transition-transform {showAdvancedFields ? 'rotate-90' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 6l6 6-6 6"/>
              </svg>
              <span>{showAdvancedFields ? 'Hide advanced options' : 'Show advanced options'}</span>
            </button>
          </div>
        {/if}
      </div>
      
      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between rounded-b-xl">
        <div class="text-xs text-gray-500">
          {#if submitOnEnter}
            <kbd class="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Enter</kbd> to apply
          {:else}
            <kbd class="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Ctrl+Enter</kbd> to submit
          {/if}
        </div>
        <div class="flex space-x-3">
          <button
            on:click={close}
            class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            on:click={handleSubmit}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
          >
            {submitLabel}
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
