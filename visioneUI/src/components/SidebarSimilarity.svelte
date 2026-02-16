<script>
  import { createEventDispatcher } from "svelte";
  import SearchControls from "../components/SearchControls.svelte";
  import TextareasManager from "./TextareasManager.svelte";
  import RFLists from "../components/RFLists.svelte";
  import SubmittedList from "../components/SubmittedList.svelte";

  // Stato/props dal genitore
  export let isSidebarOpen = true;           // 20vw o collapsed
  export let activeTab = "Search";           // "Search" | "RF" | "Submitted"
  export let textareas = [];                 // [{ value, enabled }]
  export let searchError = null;
  export let searchResultSet = null;

  export let rfPositive = [];                // [{ index, url?, title? }]
  export let rfNegative = [];                // [{ index, url?, title? }]
  export let submittedImages = [];           // images.filter(img => img.submitted)

  const dispatch = createEventDispatcher();

  // Wrapper: dispatch verso il genitore (nessuna logica locale)
  const selectSidebarTab = (tab) => dispatch("selectTab", { tab });
  const addTA = (i) => dispatch("addTextarea", { index: i });
  const removeTA = (i) => dispatch("removeTextarea", { index: i });
  const toggleTA = (i) => dispatch("toggleTextarea", { index: i });
  const updateTA = (i, value) => dispatch("updateTextarea", { index: i, value });

  const doSearch = () => dispatch("runSearch");
  const clearResults = () => dispatch("clearResults");

  const openFromRF = (index) => dispatch("openFromRF", { index });
  const openFromSubmitted = (index) => dispatch("openFromSubmitted", { index });
</script>

<div class="sidebar-left bg-gray-800 text-white flex flex-col {isSidebarOpen ? '' : 'collapsed'}">
  <div class="sidebar-header">
    <h2 class="text-lg font-bold">Menu</h2>
  </div>

  {#if isSidebarOpen}
    <div class="flex space-x-4 p-2">
      {#each ["Search","RF","Submitted"] as tab}
        <button
          class="p-2 bg-gray-700 rounded {activeTab === tab ? 'selected' : ''}"
          on:click={() => selectSidebarTab(tab)}>
          {tab}
        </button>
      {/each}
    </div>
  {/if}

  <div class="p-4">
    {#if activeTab === "Search"}
      <div class="flex flex-col space-y-4">
        <TextareasManager
          {textareas}
          on:add={(e) => addTA(e.detail.index)}
          on:remove={(e) => removeTA(e.detail.index)}
          on:toggle={(e) => toggleTA(e.detail.index)}
          on:update={(e) => updateTA(e.detail.index, e.detail.value)}
        />

        <SearchControls
          {searchError}
          {searchResultSet}
          on:run={doSearch}
          on:clear={clearResults}
        />
      </div>

    {:else if activeTab === "RF"}
      <RFLists
        {rfPositive}
        {rfNegative}
        on:openFromRF={(e) => openFromRF(e.detail.index)}
      />

    {:else}
      <SubmittedList
        {submittedImages}
        on:openFromSubmitted={(e) => openFromSubmitted(e.detail.index)}
      />
    {/if}
  </div>
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
  button.selected { border: 2px solid #3b82f6; }
</style>
