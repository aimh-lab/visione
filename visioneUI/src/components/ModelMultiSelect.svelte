<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  // Checkbox dropdown for picking one or more embedding models of a query step.
  // The new selection is dispatched once, when the dropdown closes, so ticking
  // several models doesn't run a search per click. At least one stays selected.
  export let options: string[] = [];
  export let selected: string[] = [];
  export let title = '';
  export let buttonClass = '';

  const dispatch = createEventDispatcher<{ change: { models: string[] } }>();

  let open = false;
  let draft: string[] = [];
  let triggerEl: HTMLButtonElement | null = null;
  let menuEl: HTMLDivElement | null = null;
  let menuStyle = '';

  $: current = selected.filter((m) => options.includes(m));
  $: shown = open ? draft : current;
  $: label = shown.length === 0
    ? '—'
    : shown.length === 1
      ? shown[0]
      : `${shown.length} models (RRF)`;

  // Render the menu under <body>: inside the step card it would stay in the
  // card's stacking context, below later siblings such as the Search button.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function placeMenu() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    menuStyle = `top: ${r.bottom + 4}px; left: ${left}px; width: ${width}px;`;
  }

  async function toggleOpen() {
    if (open) {
      close();
      return;
    }
    draft = current.length > 0 ? [...current] : options.slice(0, 1);
    open = true;
    placeMenu();
    await tick();
  }

  function close() {
    if (!open) return;
    open = false;
    const changed = draft.length !== current.length || draft.some((m) => !current.includes(m));
    if (changed && draft.length > 0) dispatch('change', { models: options.filter((m) => draft.includes(m)) });
  }

  function toggleModel(model: string) {
    if (draft.includes(model)) {
      if (draft.length === 1) return;
      draft = draft.filter((m) => m !== model);
    } else {
      draft = [...draft, model];
    }
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (!open) return;
    const target = e.target as Node | null;
    if (target && (menuEl?.contains(target) || triggerEl?.contains(target))) return;
    close();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window
  on:pointerdown|capture={handleWindowPointerDown}
  on:keydown={handleWindowKeydown}
  on:resize={() => open && placeMenu()}
  on:scroll|capture={() => open && placeMenu()}
/>

<button
  bind:this={triggerEl}
  type="button"
  class="{buttonClass} inline-flex items-center gap-1 text-left"
  {title}
  aria-haspopup="listbox"
  aria-expanded={open}
  on:pointerdown|stopPropagation
  on:mousedown|stopPropagation
  on:click|stopPropagation={toggleOpen}
  {...$$restProps}
>
  <span class="truncate flex-1">{label}</span>
  <svg class="w-2.5 h-2.5 shrink-0 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
  </svg>
</button>

{#if open}
  <div
    bind:this={menuEl}
    use:portal
    class="fixed z-[300] rounded-lg border border-gray-700 bg-gray-800 shadow-xl p-1"
    style={menuStyle}
    role="listbox"
    aria-multiselectable="true"
    tabindex="-1"
    on:pointerdown|stopPropagation
    on:mousedown|stopPropagation
    on:click|stopPropagation
    on:keydown|stopPropagation={handleWindowKeydown}
  >
    {#each options as m}
      {@const checked = draft.includes(m)}
      <label
        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-mono text-slate-200 hover:bg-slate-700/60 cursor-pointer {checked && draft.length === 1 ? 'opacity-80' : ''}"
        title={checked && draft.length === 1 ? 'At least one model must stay selected' : m}
      >
        <input
          type="checkbox"
          class="accent-blue-500"
          {checked}
          disabled={checked && draft.length === 1}
          on:change={() => toggleModel(m)}
        />
        <span class="truncate">{m}</span>
      </label>
    {/each}
    {#if draft.length > 1}
      <div class="px-2 pt-1 pb-0.5 text-[10px] text-slate-400 border-t border-gray-700 mt-1">
        Results of the selected models are fused (RRF).
      </div>
    {/if}
  </div>
{/if}
