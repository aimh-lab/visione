// src/lib/discoveryConfig.js
//
// Pure parsing/selection helpers for the dataserver's /discovery payload,
// used to configure search behavior for the active dataset collection.
// Extracted from src/routes/+page.svelte (previously ~3300 lines).
//
// computeSearchMetadataConfig returns a plain descriptor rather than
// mutating the visioneAPI singleton directly, so this module has no
// dependency on the API client and stays trivially testable; the caller
// (+page.svelte) is responsible for applying the descriptor.

export function normalizeDiscoveryEntries(discoveryPayload) {
  if (Array.isArray(discoveryPayload)) return discoveryPayload;
  if (!discoveryPayload || typeof discoveryPayload !== 'object') return [];

  if (Array.isArray(discoveryPayload.collections)) return discoveryPayload.collections;
  if (Array.isArray(discoveryPayload.data)) return discoveryPayload.data;
  if (discoveryPayload.data && typeof discoveryPayload.data === 'object') {
    if (Array.isArray(discoveryPayload.data.collections)) return discoveryPayload.data.collections;
    return [discoveryPayload.data];
  }

  return [discoveryPayload];
}

export function selectDiscoveryEntry(discoveryPayload, collectionName = '') {
  const entries = normalizeDiscoveryEntries(discoveryPayload);
  const normalizedCollection = String(collectionName || '').trim().toLowerCase();

  const selectedByCollection = entries.find((entry) => {
    const name = String(entry?.name || '').trim().toLowerCase();
    return !!name && !!normalizedCollection && name === normalizedCollection;
  });

  const selectedByMetadata = entries.find((entry) => Array.isArray(entry?.metadata) && entry.metadata.length > 0);

  // A single dataserver entry is unambiguous regardless of its name — use it.
  // With 2+ entries, guessing which one is "the" active collection risks
  // silently serving media/metadata from the wrong dataset.
  if (!selectedByCollection && normalizedCollection && entries.length > 1) {
    throw new Error(
      `selectDiscoveryEntry: no dataserver /discovery entry named "${normalizedCollection}" ` +
      `(available: ${entries.map((e) => e?.name).filter(Boolean).join(', ') || 'none named'}). ` +
      `Refusing to guess among ${entries.length} candidates.`
    );
  }

  return selectedByCollection || selectedByMetadata || entries[0] || null;
}

export function extractMetadataFieldsFromDiscovery(discoveryPayload, collectionName = '') {
  const selected = selectDiscoveryEntry(discoveryPayload, collectionName);

  return Array.isArray(selected?.metadata)
    ? selected.metadata.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
}

export function extractDiscoveryCollectionName(discoveryPayload, fallback = '') {
  const selected = selectDiscoveryEntry(discoveryPayload, fallback);
  return String(selected?.name || '').trim().toLowerCase();
}

export function extractAvailableModelsFromDiscovery(discoveryPayload) {
  const entries = normalizeDiscoveryEntries(discoveryPayload);
  const out = new Map();

  function normalizeModalities(value) {
    const list = Array.isArray(value) ? value : [value];
    return Array.from(new Set(
      list
        .map((m) => String(m || '').trim().toLowerCase())
        .filter(Boolean)
        .map((m) => {
          if (m === 'text' || m === 'image' || m === 'image+text') return m;
          if (m === 'multimodal' || m === 'multi-modal' || m === 'both') return 'image+text';
          return m;
        })
    ));
  }

  function addModel(name, modalities = ['text', 'image']) {
    const modelName = String(name || '').trim();
    if (!modelName) return;

    const normalizedModalities = normalizeModalities(modalities);
    const safeModalities = normalizedModalities.length > 0 ? normalizedModalities : ['text', 'image'];

    if (out.has(modelName)) {
      const merged = Array.from(new Set([...(out.get(modelName).modalities || []), ...safeModalities]));
      out.set(modelName, { name: modelName, modalities: merged });
      return;
    }

    out.set(modelName, { name: modelName, modalities: safeModalities });
  }

  function addFromArray(models, fallbackModality) {
    if (!Array.isArray(models)) return;
    models.forEach((entry) => {
      if (typeof entry === 'string') {
        addModel(entry, fallbackModality ? [fallbackModality] : ['text', 'image']);
        return;
      }

      if (entry && typeof entry === 'object') {
        const name = String(entry.name || entry.model || entry.id || '').trim();
        const modalities = entry.modalities || entry.modality || entry.type || (fallbackModality ? [fallbackModality] : ['text', 'image']);
        addModel(name, modalities);
      }
    });
  }

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;

    addFromArray(entry.available_models, null);
    addFromArray(entry.models, null);
    addFromArray(entry.text_models, 'text');
    addFromArray(entry.image_models, 'image');
    addFromArray(entry.multimodal_models, 'image+text');

    if (entry.discovery && typeof entry.discovery === 'object') {
      addFromArray(entry.discovery.available_models, null);
      addFromArray(entry.discovery.models, null);
    }

    if (entry.data && typeof entry.data === 'object') {
      addFromArray(entry.data.available_models, null);
      addFromArray(entry.data.models, null);
    }
  });

  return Array.from(out.values());
}

/**
 * Pure computation of the search-metadata configuration derived from a
 * /discovery payload + the active runtime profile. Returns a plain
 * descriptor — { knownMetadataFields, itemIdField, videoGroupField,
 * defaultMetadataToRetrieve } — for the caller to apply (e.g. to the
 * visioneAPI singleton). Throws if the profile is missing "media.itemIdField"
 * (see comment at the throw site).
 */
export function computeSearchMetadataConfig(data, profile, activeCollectionName) {
  const selectedDiscovery = selectDiscoveryEntry(data, activeCollectionName);
  const available = Array.isArray(selectedDiscovery?.metadata)
    ? selectedDiscovery.metadata.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  const availableSet = new Set(available);
  const hasAvailabilityList = availableSet.size > 0;

  // Field that uniquely identifies an item/frame row (used by getVideoKeyframes).
  // No dataset-agnostic way to derive this from /discovery (it doesn't declare an
  // id field), so it must be configured explicitly per collection instead of guessed
  // (e.g. from column position) — see "media.itemIdField" in runtimeProfiles.json.
  const itemIdField = String(profile?.media?.itemIdField || '').trim();
  if (!itemIdField) {
    throw new Error(
      `configureSearchMetadataFromDiscovery: collection "${activeCollectionName}" is missing ` +
      `"media.itemIdField" in runtimeProfiles.json (the field that uniquely identifies an item/frame ` +
      `row — "image_name" for LSC, "id" for V3C). Add it before using this dataset.`
    );
  }

  const canRequestField = (field) => {
    const normalized = String(field || '').trim();
    if (!normalized) return false;
    return !hasAvailabilityList || availableSet.has(normalized);
  };

  // Preference order: discovery's own groupby_attribute (live, authoritative —
  // but the current backend never actually populates it, see below) > the
  // "byvideo" group-by mode's configured metadata field for this collection
  // (runtimeProfiles.json, no backend dependency) > 'hour_id' as the last-resort
  // legacy default.
  const configuredVideoGroupField = Array.isArray(profile?.groupBy?.modes)
    ? String(profile.groupBy.modes.find((m) => m?.value === 'byvideo')?.metadata || '').trim()
    : '';
  const groupingField = String(selectedDiscovery?.groupby_attribute || '').trim()
    || configuredVideoGroupField
    || 'hour_id';
  const requested = [groupingField];

  const configuredGroupByMetadata = Array.isArray(profile?.groupBy?.modes)
    ? profile.groupBy.modes
        .map((entry) => String(entry?.metadata || entry?.field || '').trim())
        .filter(Boolean)
    : [];

  for (const field of configuredGroupByMetadata) {
    if (canRequestField(field)) requested.push(field);
  }

  const configuredTitleFormattingFields = [
    String(profile?.titleFormatting?.imageTitle?.epochField || '').trim(),
    String(profile?.titleFormatting?.imageTitle?.utcOffsetField || '').trim(),
    String(profile?.titleFormatting?.videoGroup?.utcOffsetField || '').trim()
  ].filter(Boolean);

  const optionalFields = [
    'epoch',
    'year',
    'month',
    'day',
    'utc_offset_hours',
    'video_offset_seconds',
    'hour_msb_middletime',
    'location_country',
    ...configuredTitleFormattingFields
  ];
  for (const field of optionalFields) {
    if (canRequestField(field)) requested.push(field);
  }

  return {
    knownMetadataFields: availableSet,
    itemIdField,
    videoGroupField: groupingField,
    defaultMetadataToRetrieve: Array.from(new Set(requested))
  };
}
