// src/config/modelDefaults.js
//
// Single source of truth for the default ML model identifiers used across
// the query builder, the API client and the settings UI. Previously these
// literals ('smart', 'dinov2_base', 'qwen_embedding_8B') were copy-pasted
// independently in src/services/api.js, src/lib/controllers/textareaController.js,
// src/components/TextareasManager.svelte, src/routes/+page.svelte and
// src/components/SettingsModal.svelte.

export const DEFAULT_TEXT_MODEL = 'smart';
export const DEFAULT_IMAGE_MODEL = 'dinov2_base';
export const DEFAULT_RELEVANCE_FEEDBACK_MODEL = 'qwen_embedding_8B';
