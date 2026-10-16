// src/config/searchLimits.js
//
// Shared bounds for query-related settings: "max results per query"
// (queryResultK) and "temporal window" (temporalWindowSeconds). Previously
// these bounds were repeated as magic numbers (100000 / 99999) across
// src/services/api.js, src/stores/uiStore.js and src/components/SettingsModal.svelte,
// with the risk of drifting apart if the backend's accepted range ever changes.

export const MIN_QUERY_RESULT_K = 1;
export const MAX_QUERY_RESULT_K = 100000;

// Size of each step's result set before a multi-step (temporal) query matches
// the steps in time.
export const MIN_TEMPORAL_CANDIDATE_K = 100;
export const MAX_TEMPORAL_CANDIDATE_K = 100000;

export const MIN_TEMPORAL_WINDOW_SECONDS = 1;
export const MAX_TEMPORAL_WINDOW_SECONDS = 99999;
