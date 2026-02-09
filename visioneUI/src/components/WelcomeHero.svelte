<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  const examples = [
    { label: '🚶 Person → 🚗 Car', queries: ['person walking', 'car passing'] },
    { label: '🐕 Dog → 🧍 Person', queries: ['dog running', 'person sitting'] },
    { label: '🌅 Sunrise → 🎉 Party', queries: ['sunrise', 'people gathering', 'celebration'] }
  ];
</script>

<div class="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
  <div class="max-w-4xl mx-auto px-8 text-center">
    <!-- Logo grande -->
    <div class="mb-8 animate-fade-in">
      <img src="./logoVISIONE.png" alt="VISIONE" class="h-24 mx-auto mb-4 opacity-90" />
      <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
        Welcome to VISIONE
      </h1>
      <p class="text-lg text-gray-400">
        Discover videos through temporal sequences
      </p>
    </div>
    
    <!-- Illustrazione grande -->
    <div class="mb-12 animate-fade-in" style="animation-delay: 0.2s;">
      <svg class="w-96 h-96 mx-auto" viewBox="0 0 400 300" fill="none">
        <!-- Timeline con icone -->
        <line x1="50" y1="150" x2="350" y2="150" stroke="#3B82F6" stroke-width="4" stroke-dasharray="8 4"/>
        
        <!-- Step 1 -->
        <circle cx="100" cy="150" r="40" fill="#1E40AF" opacity="0.3"/>
        <text x="100" y="160" text-anchor="middle" font-size="40">🎬</text>
        
        <!-- Arrow -->
        <path d="M 150 150 L 180 150 L 175 145 M 180 150 L 175 155" stroke="#60A5FA" stroke-width="3" fill="none"/>
        
        <!-- Step 2 -->
        <circle cx="230" cy="150" r="40" fill="#1E40AF" opacity="0.3"/>
        <text x="230" y="160" text-anchor="middle" font-size="40">📹</text>
        
        <!-- Arrow -->
        <path d="M 280 150 L 310 150 L 305 145 M 310 150 L 305 155" stroke="#60A5FA" stroke-width="3" fill="none"/>
        
        <!-- Result -->
        <circle cx="350" cy="150" r="40" fill="#10B981" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="350" y="160" text-anchor="middle" font-size="40">✨</text>
      </svg>
    </div>
    
    <!-- Quick start -->
    <div class="mb-8 animate-fade-in" style="animation-delay: 0.4s;">
      <button
        on:click={() => dispatch('getStarted')}
        class="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
               text-white text-lg font-bold rounded-xl shadow-2xl hover:shadow-blue-500/50 
               transition-all hover:scale-105 active:scale-95"
      >
        Get Started →
      </button>
    </div>
    
    <!-- Example queries -->
    <div class="animate-fade-in" style="animation-delay: 0.6s;">
      <p class="text-sm text-gray-500 mb-4">Or try an example:</p>
      <div class="flex flex-wrap justify-center gap-3">
        {#each examples as example}
          <button
            on:click={() => dispatch('loadExample', example.queries)}
            class="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/70 text-gray-300 text-sm rounded-lg 
                   transition-all border border-gray-700 hover:border-blue-500/50"
          >
            {example.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fade-in 0.8s ease-out forwards;
    opacity: 0;
  }
</style>
