<script>
  import ResultsGrid from "../components/ResultsGrid.svelte";
  import { createEventDispatcher } from "svelte";
  import { DEFAULT_DRES_CHALLENGE_TYPE } from "../config/dresConfig.js";
  export let rows = [];
  export let selectedImage = null;
  export let registerContainer = (el) => {};
  export let viewMode = "byrank";
  export let videoBadgeOrientation = "vertical";
  export let isSelectionMode = false; 
  export let virtualizationEnabled = true;
  export let virtualizationThreshold = 40;
  export let justifyResultRows = false;
  export let tupleIndicatorMode = 'badge+bar';
  export let showSubmitUI = false;
  export let challengeType = DEFAULT_DRES_CHALLENGE_TYPE;
  export let rfPositive = [];
  export let rfNegative = [];
  export let runtimeProfile = {};
  export let showLocalTimeInTitles = true;
  export let resultsetBadgeLabelMode = "both";
  export let modalOpen = false;

  const dispatch = createEventDispatcher();
  const forward = (type, detail) => dispatch(type, detail);
</script>

<ResultsGrid 
  items={rows}
  selectedId={selectedImage?.imgId}
  selectedIndex={selectedImage?.index}
  layout="rows"
  showVideoSummary={true}
  {viewMode}
  {videoBadgeOrientation}
  virtualizeRows={virtualizationEnabled}
  virtualizeThreshold={virtualizationThreshold}
  {justifyResultRows}
  {tupleIndicatorMode}
  {showSubmitUI}
  {challengeType}
  {rfPositive}
  {rfNegative}
  {runtimeProfile}
  {showLocalTimeInTitles}
  {resultsetBadgeLabelMode}
  modalSelectionEmphasis={modalOpen}
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
