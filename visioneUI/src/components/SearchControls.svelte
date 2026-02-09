<script>
  import { createEventDispatcher } from "svelte";

  export let searchLoading = false;
  export let searchError = null;
  export let searchResultSet = null;

  const dispatch = createEventDispatcher();
  const run = () => dispatch("run");
  const clear = () => dispatch("clear");
</script>

<!-- ✅ Rimosso bottone grande "Run Search" (ora è nella sidebar principale) -->
<!-- ✅ Solo bottoni utility secondari -->

{#if searchResultSet || searchError}
  <div class="flex flex-col space-y-2">
    <!-- ✅ Results info badge -->
    {#if searchResultSet}
      <div class="flex items-center justify-between px-3 py-2 bg-green-900/20 border border-green-700/30 rounded-lg">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-xs text-green-300 font-medium">Search completed</span>
        </div>
        <span class="text-xs text-green-400 font-bold">{searchResultSet.length || 0} results</span>
      </div>
    {/if}

  </div>
{/if}
