<script>
  import Skeleton from './Skeleton.svelte';
  
  export let rows = 3; // Numero di righe da mostrare
  export let cols = 5; // Numero di colonne
</script>

<div class="search-skeleton-container p-4">
  {#each Array(rows) as _, rowIdx}
    <div class="skeleton-row mb-6">
      <!-- Video ID placeholder -->
      <div class="mb-3">
        <Skeleton width="120px" height="24px" borderRadius="6px" />
      </div>
      
      <!-- Grid di frame -->
      <div class="grid grid-cols-{cols} gap-4">
        {#each Array(cols) as _, colIdx}
          <div class="skeleton-card">
            <!-- Image placeholder -->
            <Skeleton height="120px" borderRadius="8px" />
            
            <!-- Info placeholders -->
            <div class="mt-2 space-y-2">
              <Skeleton width="80%" height="12px" />
              <Skeleton width="60%" height="10px" />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .skeleton-card {
    display: flex;
    flex-direction: column;
  }
</style>
