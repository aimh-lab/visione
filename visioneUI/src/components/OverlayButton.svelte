<!-- src/components/OverlayButton.svelte -->
<script>
  import { createEventDispatcher } from "svelte";
  export let title = "";
  export let aria = "";
  export let positionClass = ""; // es: "top-2 left-10"
  export let className = "";     // classi aggiuntive opzionali
  const dispatch = createEventDispatcher();
  const click = (e) => { e.stopPropagation(); dispatch("click"); };
</script>

<button
  type="button"
  class={"absolute opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-30 " + positionClass + " " + className}
  title={title}
  aria-label={aria}
  on:click={click}>
  <slot />
</button>
