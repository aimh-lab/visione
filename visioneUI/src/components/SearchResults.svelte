<script>
  import ResultsGrid from "../components/ResultsGrid.svelte";
  import { createEventDispatcher } from "svelte";
  export let rows = [];
  export let selectedImage = null;
  export let registerContainer = (el) => {};
  export let viewMode = "byrank"; // ✅ AGGIUNGI
  export let videoBadgeOrientation = "vertical";
  export let isSelectionMode = false; 
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let showSubmitUI = false;

  const dispatch = createEventDispatcher();
  const forward = (type, detail) => dispatch(type, detail);
</script>

<ResultsGrid 
  items={rows}
  selectedId={selectedImage?.imgId}
  layout="rows"
  showVideoSummary={true}
  {viewMode}
  {videoBadgeOrientation}
  virtualizeRows={virtualizationEnabled}
  virtualizeThreshold={virtualizationThreshold}
  {showSubmitUI}
  {registerContainer}
  {isSelectionMode}
  on:openVideoPlayer={(e) =>  { forward("openVideoPlayer", e.detail); }}

  on:open={(e) => forward("open", e.detail)}
  on:videoSummary={(e) => forward("videoSummary", e.detail)}
  on:similarity={(e) => forward("similarity", e.detail)}
  on:rfPositive={(e) => forward("rfPositive", e.detail)}
  on:rfNegative={(e) => forward("rfNegative", e.detail)}
  on:submit={(e) => forward("submit", e.detail)}
  on:selectImage={(e) => forward("selectImage", e.detail)}

/>
