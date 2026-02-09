<script>
  import { createEventDispatcher } from "svelte";

  // Props come nel monolite: [{ value: string, enabled: boolean }]
  export let textareas = [];

  const dispatch = createEventDispatcher();
  const add = (i) => dispatch("add", { index: i });
  const remove = (i) => dispatch("remove", { index: i });
  const toggle = (i) => dispatch("toggle", { index: i });
  const update = (i, value) => dispatch("update", { index: i, value });
</script>

<div class="flex flex-col space-y-4">
  {#each textareas as textarea, i}
    <div class="flex items-start space-x-2 w-full">
      <div class="relative flex-1">
        <textarea
          class="w-full pr-16 pb-12 p-2 rounded border resize-none {textarea.enabled ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-500 text-gray-300 border-gray-400 line-through'}"
          rows="5"
          bind:value={textarea.value}
          placeholder="Scrivi qui..."
          disabled={!textarea.enabled}
          on:input={(e) => update(i, e.target.value)}
        ></textarea>

        {#if textareas.length > 1}
          <button
            type="button"
            on:click={() => remove(i)}
            aria-label="Rimuovi"
            title="Rimuovi"
            class="absolute top-0 right-0 translate-x-12 -translate-y-12 z-10 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow ring-2 ring-white/30">
            ×
          </button>
        {/if}

        <button
          type="button"
          on:click={() => add(i)}
          aria-label="Aggiungi"
          title="Aggiungi"
          class="absolute bottom-2 right-0 translate-x-12 translate-y-12 z-10 w-10 h-5 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 shadow ring-2 ring-white/30">
          ＋
        </button>
      </div>

      <button
        type="button"
        on:click={() => toggle(i)}
        aria-pressed={textarea.enabled}
        title={textarea.enabled ? 'Disabilita' : 'Abilita'}
        class="focus:outline-none ml-1"
      >
        <span class="relative inline-flex items-center h-5 w-10 rounded-full transition-colors duration-200 {textarea.enabled ? 'bg-green-500' : 'bg-gray-400'}">
          <span class="sr-only">Toggle</span>
          <span class="inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 {textarea.enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
        </span>
      </button>
    </div>
  {/each}
</div>
