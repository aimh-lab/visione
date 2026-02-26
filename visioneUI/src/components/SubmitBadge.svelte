<script>
  export let submitted = false; // boolean: img.submitted
  export let label = "Submitted"; // testo visualizzato (personalizzabile)
  export let verdict = "";

  $: isWrongSubmission = String(verdict ?? "").toUpperCase() === "WRONG";
</script>

{#if submitted}
  <div class="absolute top-2 right-2 z-30">
    <span
      class={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold text-white shadow-md ring-1 ring-white/40 select-none ${
        isWrongSubmission ? 'bg-red-600/90' : 'bg-green-600/90'
      }`}
    >
      {label}
    </span>
  </div>
{/if}
