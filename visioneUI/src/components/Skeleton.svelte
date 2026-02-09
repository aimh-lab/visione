<script>
  export let width = '100%';
  export let height = '160px';
  export let borderRadius = '8px';
  export let count = 1;
</script>

{#each Array(count) as _, i}
  <div 
    class="skeleton-box"
    style:width
    style:height
    style:border-radius={borderRadius}
    style:margin-bottom={i < count - 1 ? '8px' : '0'}
  ></div>
{/each}

<style>
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  .skeleton-box {
    background: linear-gradient(
      90deg,
      #2d3748 0%,
      #374151 25%,
      #4b5563 50%,
      #374151 75%,
      #2d3748 100%
    );
    background-size: 1000px 100%;
    animation: shimmer 2s infinite linear;
    display: block;
  }
</style>
