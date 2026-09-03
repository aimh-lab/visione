// src/config/dresConfig.js
//
// Single source of truth for the DRES (VBS/LSC evaluation server) challenge
// type enum. Previously the literal array ['KIS', 'AVS', 'Q&A'] was
// duplicated across src/stores/uiStore.js, src/components/SettingsModal.svelte,
// src/lib/controllers/dresController.js and src/routes/+page.svelte.

export const DRES_CHALLENGE_TYPES = ['KIS', 'AVS', 'Q&A'];
export const DEFAULT_DRES_CHALLENGE_TYPE = DRES_CHALLENGE_TYPES[0];

/**
 * Normalizes a raw challengeType value (case-insensitive, accepts the "QA"
 * alias for "Q&A") to one of DRES_CHALLENGE_TYPES, defaulting to
 * DEFAULT_DRES_CHALLENGE_TYPE ("KIS") for anything unrecognized. Previously
 * duplicated independently in src/services/interactionLogger.js (which
 * accepted the "QA" alias) and src/lib/controllers/dresController.js (which
 * didn't) — the two could normalize the same raw value differently.
 * Callers that want to warn on an unrecognized value can pass onFallback.
 */
export function normalizeChallengeType(value, { onFallback } = {}) {
  const type = String(value ?? '').trim().toUpperCase();
  if (type === 'AVS') return 'AVS';
  if (type === 'Q&A' || type === 'QA') return 'Q&A';
  if (type && type !== DEFAULT_DRES_CHALLENGE_TYPE && typeof onFallback === 'function') {
    onFallback(value);
  }
  return DEFAULT_DRES_CHALLENGE_TYPE;
}
