// src/lib/modelDiscovery.js
//
// Pure helpers for interpreting the "available_models" list discovered from
// the dataserver's /discovery payload: normalizing an entry (string or
// object, legacy shapes included) into a { name, modalities } descriptor,
// and checking whether a descriptor supports text/image search.
//
// Previously duplicated identically in src/routes/+page.svelte (imperative
// getDiscoveredModelNames) and src/components/TextareasManager.svelte
// (reactive $: normalizedModelEntries/textModelOptions) — a risk, since any
// future change to the normalization rules (e.g. a new modality alias) had
// to be applied by hand in both places to keep the query builder and the
// page's own model-resolution logic (getGlobalDefaultTextModel,
// resolveRelevanceFeedbackModel, ...) in agreement about which models exist.

/**
 * @param {string | { name?: string, modalities?: string[] }} input
 * @returns {{ name: string, modalities: string[] } | null}
 */
export function normalizeAvailableModelEntry(input) {
  if (typeof input === 'string') {
    const name = input.trim();
    if (!name) return null;
    // Backward compatibility: legacy string entries were usable for both text/image.
    return { name, modalities: ['text', 'image'] };
  }

  if (!input || typeof input !== 'object') return null;

  const name = String(input?.name || '').trim();
  if (!name) return null;

  const modalities = Array.isArray(input?.modalities)
    ? input.modalities.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    name,
    modalities: modalities.length > 0 ? Array.from(new Set(modalities)) : ['text', 'image']
  };
}

export function supportsTextModel(entry) {
  return entry.modalities.includes('text') || entry.modalities.includes('image+text');
}

export function supportsImageModel(entry) {
  return entry.modalities.includes('image') || entry.modalities.includes('image+text');
}
