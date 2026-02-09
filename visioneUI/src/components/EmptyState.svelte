<script>
  export let type = 'search';
  export let title = '';
  export let description = '';
  export let actionLabel = null;
  export let onAction = () => {};
  export let size = 'large';
  
  const states = {
    search: {
      title: 'Ready to explore',
      description: 'Enter a temporal query in the sidebar to discover videos with scenes appearing in sequence',
      actionLabel: 'Get Started',
      color: 'blue'
    },
    'no-results': {
      title: 'No results found',
      description: 'Try adjusting your query, using different keywords, or removing some temporal steps',
      actionLabel: 'Refine Query',
      color: 'yellow'
    },
    rf: {
      title: 'No relevance feedback yet',
      description: 'Mark frames as positive 👍 or negative 👎 to help refine future searches',
      actionLabel: null,
      color: 'purple'
    },
    submitted: {
      title: 'No submissions yet',
      description: 'Submit relevant frames to build your collection',
      actionLabel: null,
      color: 'green'
    },
    video: {
      title: 'Select a video',
      description: 'Click on a video ID from the search results to view its keyframes',
      actionLabel: null,
      color: 'indigo'
    },
    similarity: {
      title: 'Find similar frames',
      description: 'Click the similarity icon on any frame to find visually similar content',
      actionLabel: null,
      color: 'pink'
    }
  };
  
  $: state = states[type] || states.search;
  $: finalTitle = title || state.title;
  $: finalDescription = description || state.description;
  $: finalActionLabel = actionLabel !== null ? actionLabel : state.actionLabel;
  
  const sizeClasses = {
    small: 'py-8',
    medium: 'py-16',
    large: 'py-24'
  };
  
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    pink: 'bg-pink-600 hover:bg-pink-700'
  };
</script>

<div class="flex flex-col items-center justify-center text-center px-8 {sizeClasses[size]}">
  <!-- Illustration SVG -->
  <div class="mb-8 animate-fade-in">
    {#if type === 'search'}
      <!-- Search illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Magnifying glass -->
        <circle cx="80" cy="80" r="35" stroke="#3B82F6" stroke-width="8" fill="#1E3A8A" opacity="0.2"/>
        <line x1="105" y1="105" x2="140" y2="140" stroke="#3B82F6" stroke-width="8" stroke-linecap="round"/>
        
        <!-- Document with timeline -->
        <rect x="40" y="120" width="80" height="60" rx="4" fill="#374151" opacity="0.5"/>
        <line x1="50" y1="135" x2="110" y2="135" stroke="#60A5FA" stroke-width="2"/>
        <line x1="50" y1="145" x2="90" y2="145" stroke="#60A5FA" stroke-width="2"/>
        <line x1="50" y1="155" x2="100" y2="155" stroke="#60A5FA" stroke-width="2"/>
        <line x1="50" y1="165" x2="85" y2="165" stroke="#60A5FA" stroke-width="2"/>
        
        <!-- Sparkles -->
        <circle cx="150" cy="40" r="3" fill="#60A5FA" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="165" cy="55" r="2" fill="#60A5FA" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="30" cy="50" r="2.5" fill="#60A5FA" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
        </circle>
      </svg>
      
    {:else if type === 'no-results'}
      <!-- No results illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Empty box -->
        <rect x="60" y="80" width="80" height="70" rx="4" fill="#374151" opacity="0.3"/>
        <rect x="60" y="80" width="80" height="10" fill="#4B5563" opacity="0.5"/>
        
        <!-- X mark -->
        <line x1="85" y1="105" x2="115" y2="135" stroke="#EAB308" stroke-width="6" stroke-linecap="round"/>
        <line x1="115" y1="105" x2="85" y2="135" stroke="#EAB308" stroke-width="6" stroke-linecap="round"/>
        
        <!-- Question marks floating -->
        <text x="40" y="70" font-size="24" fill="#6B7280" opacity="0.4">?</text>
        <text x="150" y="90" font-size="20" fill="#6B7280" opacity="0.3">?</text>
        <text x="45" y="160" font-size="18" fill="#6B7280" opacity="0.35">?</text>
      </svg>
      
    {:else if type === 'rf'}
      <!-- Relevance Feedback illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Two hands -->
        <g opacity="0.6">
          <!-- Left hand - thumbs up -->
          <rect x="50" y="100" width="30" height="50" rx="15" fill="#10B981" opacity="0.3"/>
          <rect x="60" y="70" width="10" height="35" rx="5" fill="#10B981" opacity="0.5"/>
          
          <!-- Right hand - thumbs down -->
          <rect x="120" y="100" width="30" height="50" rx="15" fill="#EF4444" opacity="0.3"/>
          <rect x="130" y="140" width="10" height="35" rx="5" fill="#EF4444" opacity="0.5"/>
        </g>
        
        <!-- Plus/Minus signs -->
        <circle cx="65" cy="85" r="15" fill="#10B981" opacity="0.2"/>
        <line x1="65" y1="78" x2="65" y2="92" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
        <line x1="58" y1="85" x2="72" y2="85" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
        
        <circle cx="135" cy="158" r="15" fill="#EF4444" opacity="0.2"/>
        <line x1="128" y1="158" x2="142" y2="158" stroke="#EF4444" stroke-width="3" stroke-linecap="round"/>
      </svg>
      
    {:else if type === 'submitted'}
      <!-- Submitted illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Folder -->
        <path d="M40 80 L40 150 L160 150 L160 90 L120 90 L110 80 Z" fill="#374151" opacity="0.4"/>
        <rect x="40" y="80" width="70" height="10" rx="2" fill="#4B5563" opacity="0.5"/>
        
        <!-- Empty state lines -->
        <line x1="60" y1="110" x2="140" y2="110" stroke="#6B7280" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
        <line x1="70" y1="125" x2="130" y2="125" stroke="#6B7280" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
        
        <!-- Checkmark waiting -->
        <circle cx="100" cy="115" r="25" stroke="#10B981" stroke-width="3" stroke-dasharray="157" opacity="0.3">
          <animate attributeName="stroke-dashoffset" values="157;0" dur="3s" repeatCount="indefinite"/>
        </circle>
      </svg>
      
    {:else if type === 'video'}
      <!-- Video selection illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Video player frame -->
        <rect x="40" y="60" width="120" height="80" rx="8" fill="#374151" opacity="0.4"/>
        
        <!-- Play button -->
        <circle cx="100" cy="100" r="20" fill="#6366F1" opacity="0.6">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        <polygon points="95,92 95,108 108,100" fill="white"/>
        
        <!-- Film strip sides -->
        <rect x="35" y="60" width="5" height="80" fill="#4B5563" opacity="0.3"/>
        <rect x="160" y="60" width="5" height="80" fill="#4B5563" opacity="0.3"/>
        
        <!-- Keyframe indicators -->
        <rect x="50" y="150" width="20" height="15" rx="2" fill="#6366F1" opacity="0.3"/>
        <rect x="80" y="150" width="20" height="15" rx="2" fill="#6366F1" opacity="0.3"/>
        <rect x="110" y="150" width="20" height="15" rx="2" fill="#6366F1" opacity="0.3"/>
        <rect x="140" y="150" width="20" height="15" rx="2" fill="#6366F1" opacity="0.3"/>
      </svg>
      
    {:else if type === 'similarity'}
      <!-- Similarity illustration -->
      <svg class="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Central image -->
        <rect x="75" y="75" width="50" height="50" rx="4" fill="#EC4899" opacity="0.4"/>
        
        <!-- Similar images around -->
        <rect x="30" y="30" width="35" height="35" rx="3" fill="#EC4899" opacity="0.2"/>
        <rect x="135" y="30" width="35" height="35" rx="3" fill="#EC4899" opacity="0.2"/>
        <rect x="30" y="135" width="35" height="35" rx="3" fill="#EC4899" opacity="0.2"/>
        <rect x="135" y="135" width="35" height="35" rx="3" fill="#EC4899" opacity="0.2"/>
        
        <!-- Connection lines -->
        <line x1="75" y1="100" x2="50" y2="60" stroke="#EC4899" stroke-width="2" opacity="0.3" stroke-dasharray="4 2"/>
        <line x1="125" y1="100" x2="152" y2="60" stroke="#EC4899" stroke-width="2" opacity="0.3" stroke-dasharray="4 2"/>
        <line x1="75" y1="125" x2="50" y2="152" stroke="#EC4899" stroke-width="2" opacity="0.3" stroke-dasharray="4 2"/>
        <line x1="125" y1="125" x2="152" y2="152" stroke="#EC4899" stroke-width="2" opacity="0.3" stroke-dasharray="4 2"/>
      </svg>
    {/if}
  </div>
  
  <!-- Title -->
  <h3 class="text-xl font-bold text-gray-200 mb-2 animate-fade-in" style="animation-delay: 0.1s;">
    {finalTitle}
  </h3>
  
  <!-- Description -->
  <p class="text-sm text-gray-400 max-w-md leading-relaxed mb-6 animate-fade-in" style="animation-delay: 0.2s;">
    {finalDescription}
  </p>
  
  <!-- Action button -->
  {#if finalActionLabel}
    <button 
      on:click={onAction}
      class="px-5 py-2.5 {colorClasses[state.color]} text-white font-medium rounded-lg 
             transition-all hover:scale-105 active:scale-95 shadow-lg animate-fade-in"
      style="animation-delay: 0.3s;"
    >
      {finalActionLabel}
    </button>
  {/if}
  
  <!-- Slot per contenuto extra -->
  <div class="mt-4 animate-fade-in" style="animation-delay: 0.4s;">
    <slot />
  </div>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.6s ease-out forwards;
    opacity: 0;
  }
</style>
