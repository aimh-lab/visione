<!-- src/components/VideoSidebar.svelte -->
<script>
  import { createEventDispatcher } from "svelte";
  export let isSidebarOpen = true;     // controlla apertura/chiusura (20vw vs collapsed)
  const dispatch = createEventDispatcher();
  const openOptions = () => dispatch("openOptions");
  const openFilters = () => dispatch("openFilters");
</script>

<div class="sidebar-left bg-gray-800 text-white flex flex-col {isSidebarOpen ? '' : 'collapsed'}">
  <div class="sidebar-header">
    <h2 class="text-lg font-bold">Video Summary - Menu</h2>
  </div>

  {#if isSidebarOpen}
    <div class="flex space-x-4 p-2">
      <button class="p-2 bg-gray-700 rounded" on:click={openOptions}>Opzioni</button>
      <button class="p-2 bg-gray-700 rounded" on:click={openFilters}>Filtri</button>
    </div>

    <div class="p-4 text-sm text-gray-300">
      Qui andranno i controlli specifici per i riepiloghi video.
    </div>
  {/if}
</div>

<style>
.sidebar-left {
  width: 18vw;
  min-width: 200px;
  max-width: 360px;
  height: 100%;
  flex-shrink: 0; /* ✅ FONDAMENTALE - impedisce shrinking */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.sidebar-left.collapsed {
  width: 0;
  min-width: 0;
  max-width: none;
  overflow: hidden;
}

  .sidebar-header { display:flex; justify-content: space-between; align-items:center; padding:10px; background-color: rgba(0,0,0,0.2); }
</style>
