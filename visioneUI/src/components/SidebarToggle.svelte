<script>
  import { createEventDispatcher } from "svelte";
  export let isOpen = true;
  
  const dispatch = createEventDispatcher();
  const toggle = () => dispatch('toggle');
</script>

<!-- Grip handle sulla linea di confine 
<button
  class="sidebar-grip"
  class:open={isOpen}
  on:click={toggle}
  title={isOpen ? "Hide sidebar" : "Show sidebar"}
  aria-label={isOpen ? "Hide sidebar" : "Show sidebar"}
>
  <div class="grip-dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</button>
-->
<style>
  .sidebar-grip {
    position: fixed;
    top: 50%;
    /* ✅ Usa clamp per seguire la sidebar dinamica */
    left: clamp(195px, calc(18vw - 5px), 355px);
    transform: translateY(-50%);
    z-index: 40;
    
    width: 8px;
    height: 48px;
    
    background: transparent;
    border: none;
    
    display: flex;
    align-items: center;
    justify-content: center;
    
    cursor: col-resize;
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .sidebar-grip:hover {
    width: 10px; /* ✅ Leggermente più largo on hover */
  }
  
  /* Quando sidebar chiusa */
  .sidebar-grip:not(.open) {
    left: -4px;
  }
  
  /* Container dots */
  .grip-dots {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 5px;
    background: #9c7010; /* ✅ Grigio neutro */
    border-radius: 3px;
    transition: all 0.2s ease;
  }
  
  .sidebar-grip:hover .grip-dots {
    background: #d1d5db;
    padding: 7px; /* ✅ Crescita moderata */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  /* Singolo dot */
  .dot {
    width: 3px;
    height: 3px;
    background: #9ca3af; /* ✅ Grigio medio */
    border-radius: 50%;
    transition: background 0.2s ease;
  }
  
  .sidebar-grip:hover .dot {
    background: #6b7280; /* ✅ Grigio scuro on hover */
  }

  /* ✅ Adatta su schermi piccoli */
  @media (max-width: 768px) {
    .sidebar-grip {
      display: none; /* Nasconde su mobile */
    }
  }
</style>
