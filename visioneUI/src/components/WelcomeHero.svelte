<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  const examples = [
    { label: '🚶 Person → 🚗 Car', queries: ['person walking', 'car passing'] },
    { label: '🐕 Dog → 🧍 Person', queries: ['dog running', 'person sitting'] },
    { label: '🌅 Sunrise → 🎉 Party', queries: ['sunrise', 'people gathering', 'celebration'] }
  ];
</script>

<div class="welcome-hero h-full w-full overflow-y-auto">
  <div class="welcome-hero-inner max-w-4xl mx-auto px-5 sm:px-8 py-6 sm:py-10 text-center min-h-full flex flex-col justify-center">
    <!-- Logo grande -->
    <div class="hero-header mb-6 sm:mb-8 animate-fade-in">
      <img src="./logoVISIONE.png" alt="VISIONE" class="hero-logo h-16 sm:h-24 mx-auto mb-3 sm:mb-4 opacity-90" />
      <h1 class="hero-title text-3xl sm:text-4xl font-bold mb-2">
        Welcome to VISIONE
      </h1>
      <p class="hero-subtitle text-base sm:text-lg">
        Explore moments and media through temporal sequences
      </p>
    </div>
    
    <!-- Illustrazione grande -->
    <div class="hero-illustration-wrap mb-6 sm:mb-10 animate-fade-in" style="animation-delay: 0.2s;">
      <svg class="hero-illustration mx-auto" viewBox="0 0 400 300" fill="none">
        <!-- Timeline con icone -->
        <line class="hero-timeline" x1="50" y1="150" x2="350" y2="150" stroke-width="4" stroke-dasharray="8 4"/>
        
        <!-- Step 1 -->
        <circle class="hero-step-circle" cx="100" cy="150" r="40"/>
        <text x="100" y="160" text-anchor="middle" font-size="40">🎬</text>
        
        <!-- Arrow -->
        <path class="hero-arrow" d="M 150 150 L 180 150 L 175 145 M 180 150 L 175 155" stroke-width="3" fill="none"/>
        
        <!-- Step 2 -->
        <circle class="hero-step-circle" cx="230" cy="150" r="40"/>
        <text x="230" y="160" text-anchor="middle" font-size="40">📹</text>
        
        <!-- Arrow -->
        <path class="hero-arrow" d="M 280 150 L 310 150 L 305 145 M 310 150 L 305 155" stroke-width="3" fill="none"/>
        
        <!-- Result -->
        <circle class="hero-result-circle" cx="350" cy="150" r="40">
          <animate attributeName="opacity" values="0.42;0.72;0.42" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="350" y="160" text-anchor="middle" font-size="40">✨</text>
      </svg>
    </div>
    
    <!-- Quick start -->
    <div class="hero-quickstart mb-6 sm:mb-8 animate-fade-in" style="animation-delay: 0.4s;">
      <button
        on:click={() => dispatch('getStarted')}
        class="hero-primary-btn px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-xl shadow-2xl transition-all hover:scale-105 active:scale-95"
      >
        Get Started →
      </button>
    </div>
    
    <!-- Example queries -->
    <div class="animate-fade-in" style="animation-delay: 0.6s;">
      <p class="hero-examples-label text-sm mb-3 sm:mb-4">Or try an example:</p>
      <div class="flex flex-wrap justify-center gap-3">
        {#each examples as example}
          <button
            on:click={() => dispatch('loadExample', example.queries)}
            class="hero-example-btn px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg transition-all border"
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

  .welcome-hero {
    overscroll-behavior: contain;
    color: var(--ui-text);
    background:
      radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--ui-primary-600) 16%, transparent), transparent 38%),
      linear-gradient(135deg, var(--ui-bg), var(--ui-surface-muted), var(--ui-bg));
  }

  .hero-title {
    color: transparent;
    background: linear-gradient(90deg, var(--ui-primary-600), var(--ui-primary-800));
    -webkit-background-clip: text;
    background-clip: text;
  }

  .hero-subtitle,
  .hero-examples-label {
    color: var(--ui-text-muted);
  }

  .hero-illustration {
    width: min(88vw, 24rem);
    height: auto;
    aspect-ratio: 4 / 3;
  }

  .hero-timeline,
  .hero-arrow {
    stroke: var(--ui-primary-600);
  }

  .hero-step-circle {
    fill: var(--ui-primary-800);
    opacity: 0.26;
  }

  .hero-result-circle {
    fill: var(--ui-success-600);
    opacity: 0.42;
  }

  .hero-primary-btn {
    color: #fff;
    background: var(--ui-search-btn-bg);
    box-shadow: var(--ui-search-btn-shadow);
  }

  .hero-primary-btn:hover {
    background: var(--ui-search-btn-hover-bg);
    box-shadow: 0 16px 34px color-mix(in srgb, var(--ui-primary-600) 34%, transparent);
  }

  .hero-example-btn {
    color: var(--ui-toolbar-text);
    background: color-mix(in srgb, var(--ui-surface) 76%, transparent);
    border-color: var(--ui-border);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--ui-text) 8%, transparent);
  }

  .hero-example-btn:hover {
    color: var(--ui-toolbar-hover-text);
    background: var(--ui-toolbar-hover-bg);
    border-color: var(--ui-toolbar-hover-border);
  }

  @media (max-height: 820px) {
    .welcome-hero-inner {
      justify-content: flex-start;
    }
  }

  @media (max-height: 760px) {
    .welcome-hero-inner {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }

    .hero-logo {
      height: 2.75rem;
      margin-bottom: 0.5rem;
    }

    .hero-title {
      font-size: 1.625rem;
      line-height: 1.2;
    }

    .hero-subtitle {
      font-size: 0.95rem;
    }

    .hero-illustration-wrap {
      margin-bottom: 1rem;
    }

    .hero-illustration {
      width: min(82vw, 18rem);
    }

    .hero-quickstart {
      margin-bottom: 1rem;
    }
  }
</style>
