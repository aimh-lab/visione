// src/config/relevanceFeedbackConfig.js
//
// Single source of truth for the relevance-feedback method enum. Previously
// the literal values 'svm'/'rocchio' (and mismatched defaults) were
// duplicated independently in src/components/SidebarRight.svelte,
// src/views/SearchView.svelte, src/routes/+page.svelte and src/services/api.js.

export const RF_METHODS = ['svm', 'rocchio'];

// 'rocchio' (not RF_METHODS[0]) to preserve the app's actual pre-existing
// default, which lived only in src/routes/+page.svelte and disagreed with
// the 'svm' default duplicated in the other three files.
export const DEFAULT_RF_METHOD = 'rocchio';
