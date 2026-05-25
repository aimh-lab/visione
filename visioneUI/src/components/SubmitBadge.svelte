<script>
  export let submitted = false; // boolean: img.submitted
  export let label = "Submitted"; // testo visualizzato (personalizzabile)
  export let verdict = "";

  $: normalizedVerdict = String(verdict ?? "").toUpperCase();
  $: isWrongSubmission = normalizedVerdict === "WRONG";
  $: isAmberSubmission = normalizedVerdict === "PENDING"
    || normalizedVerdict === "INDETERMINATE"
    || normalizedVerdict === "UNDECIDABLE";
  $: badgeClass = isAmberSubmission
    ? 'ui-submit-badge-warning'
    : isWrongSubmission
      ? 'ui-submit-badge-error'
      : 'ui-submit-badge-success';
</script>

{#if submitted}
  <div class="absolute top-2 right-2 z-30">
    <span
      class={`ui-submit-badge inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold border select-none ${
        badgeClass
      }`}
    >
      {label}
    </span>
  </div>
{/if}
