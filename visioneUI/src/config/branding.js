// src/config/branding.js
//
// Shared branding assets. Previously the logo path was repeated as a literal
// string in src/components/WelcomeHero.svelte and 3 places in
// src/components/AdaptiveTabLayout.svelte. Centralizing it here means a future
// per-deployment logo swap only needs to change one line.

export const LOGO_SRC = './logoVISIONE.png';
