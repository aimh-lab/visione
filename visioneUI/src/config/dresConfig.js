// src/config/dresConfig.js
//
// Single source of truth for the DRES (VBS/LSC evaluation server) challenge
// type enum. Previously the literal array ['KIS', 'AVS', 'Q&A'] was
// duplicated across src/stores/uiStore.js, src/components/SettingsModal.svelte,
// src/lib/controllers/dresController.js and src/routes/+page.svelte.

export const DRES_CHALLENGE_TYPES = ['KIS', 'AVS', 'Q&A'];
export const DEFAULT_DRES_CHALLENGE_TYPE = DRES_CHALLENGE_TYPES[0];
