import { describe, it, expect } from 'vitest';
import {
  normalizeDiscoveryEntries,
  selectDiscoveryEntry,
  extractMetadataFieldsFromDiscovery,
  extractDiscoveryCollectionName,
  extractAvailableModelsFromDiscovery,
  computeSearchMetadataConfig
} from './discoveryConfig.js';

describe('normalizeDiscoveryEntries', () => {
  it('passes an array payload through unchanged', () => {
    const payload = [{ name: 'a' }, { name: 'b' }];
    expect(normalizeDiscoveryEntries(payload)).toBe(payload);
  });

  it('unwraps payload.collections / payload.data (array) / payload.data.collections', () => {
    expect(normalizeDiscoveryEntries({ collections: [{ name: 'a' }] })).toEqual([{ name: 'a' }]);
    expect(normalizeDiscoveryEntries({ data: [{ name: 'a' }] })).toEqual([{ name: 'a' }]);
    expect(normalizeDiscoveryEntries({ data: { collections: [{ name: 'a' }] } })).toEqual([{ name: 'a' }]);
  });

  it('wraps a bare payload.data object as a single-entry array', () => {
    expect(normalizeDiscoveryEntries({ data: { name: 'a' } })).toEqual([{ name: 'a' }]);
  });

  it('wraps a single non-array, non-{collections/data} object payload as a single-entry array', () => {
    expect(normalizeDiscoveryEntries({ name: 'solo' })).toEqual([{ name: 'solo' }]);
  });

  it('returns [] for null/undefined/non-object payload', () => {
    expect(normalizeDiscoveryEntries(null)).toEqual([]);
    expect(normalizeDiscoveryEntries(undefined)).toEqual([]);
    expect(normalizeDiscoveryEntries('nope')).toEqual([]);
  });
});

describe('selectDiscoveryEntry', () => {
  it('selects the entry matching collectionName, case-insensitively', () => {
    const payload = [{ name: 'LSC' }, { name: 'V3C' }];
    expect(selectDiscoveryEntry(payload, 'v3c')).toEqual({ name: 'V3C' });
  });

  it('returns the single entry unambiguously when there is only one, regardless of name', () => {
    const payload = [{ name: 'unrelated-name' }];
    expect(selectDiscoveryEntry(payload, 'lsc')).toEqual({ name: 'unrelated-name' });
  });

  it('throws when collectionName is given, not found, and there are 2+ candidates (refuses to guess)', () => {
    const payload = [{ name: 'a' }, { name: 'b' }];
    expect(() => selectDiscoveryEntry(payload, 'c')).toThrow(/no dataserver \/discovery entry named "c"/);
  });

  it('falls back to the first entry with non-empty metadata when no collectionName is given', () => {
    const payload = [{ name: 'a', metadata: [] }, { name: 'b', metadata: ['year'] }];
    expect(selectDiscoveryEntry(payload)).toEqual({ name: 'b', metadata: ['year'] });
  });

  it('falls back to the first entry when nothing else matches', () => {
    const payload = [{ name: 'a' }];
    expect(selectDiscoveryEntry(payload)).toEqual({ name: 'a' });
  });

  it('returns null for an empty entries list', () => {
    expect(selectDiscoveryEntry([])).toBeNull();
  });
});

describe('extractMetadataFieldsFromDiscovery', () => {
  it('returns the trimmed, non-empty metadata field names of the selected entry', () => {
    const payload = [{ name: 'lsc', metadata: [' year ', 'month', '', null] }];
    expect(extractMetadataFieldsFromDiscovery(payload, 'lsc')).toEqual(['year', 'month']);
  });

  it('returns [] when the selected entry has no metadata array', () => {
    expect(extractMetadataFieldsFromDiscovery([{ name: 'lsc' }], 'lsc')).toEqual([]);
  });
});

describe('extractDiscoveryCollectionName', () => {
  it('returns the selected entry name, lowercased', () => {
    expect(extractDiscoveryCollectionName([{ name: 'LSC' }])).toBe('lsc');
  });

  it('returns "" when there is no selectable entry', () => {
    expect(extractDiscoveryCollectionName([])).toBe('');
  });
});

describe('extractAvailableModelsFromDiscovery', () => {
  it('collects models from available_models/models/text_models/image_models/multimodal_models', () => {
    const payload = [{
      text_models: ['smart'],
      image_models: ['dinov2'],
      multimodal_models: ['clip']
    }];
    const result = extractAvailableModelsFromDiscovery(payload);
    expect(result).toEqual(expect.arrayContaining([
      { name: 'smart', modalities: ['text'] },
      { name: 'dinov2', modalities: ['image'] },
      { name: 'clip', modalities: ['image+text'] }
    ]));
  });

  it('merges modalities when the same model name appears from multiple sources', () => {
    const payload = [{ text_models: ['shared'], image_models: ['shared'] }];
    const [model] = extractAvailableModelsFromDiscovery(payload);
    expect(model.name).toBe('shared');
    expect(model.modalities.sort()).toEqual(['image', 'text']);
  });

  it('normalizes "multimodal"/"multi-modal"/"both" modality aliases to "image+text"', () => {
    const payload = [{ available_models: [{ name: 'm1', modalities: 'multimodal' }, { name: 'm2', modalities: ['both'] }] }];
    const result = extractAvailableModelsFromDiscovery(payload);
    expect(result.find((m) => m.name === 'm1').modalities).toEqual(['image+text']);
    expect(result.find((m) => m.name === 'm2').modalities).toEqual(['image+text']);
  });

  it('reads object entries under available_models/models by name/model/id, with type/modality/modalities fallback', () => {
    const payload = [{ models: [{ model: 'from-model-key', type: 'text' }] }];
    expect(extractAvailableModelsFromDiscovery(payload)).toEqual([{ name: 'from-model-key', modalities: ['text'] }]);
  });

  it('also reads a nested entry.discovery / entry.data object', () => {
    const viaDiscovery = extractAvailableModelsFromDiscovery([{ discovery: { models: ['nested1'] } }]);
    expect(viaDiscovery.map((m) => m.name)).toEqual(['nested1']);

    const viaData = extractAvailableModelsFromDiscovery([{ data: { models: ['nested2'] } }]);
    expect(viaData.map((m) => m.name)).toEqual(['nested2']);
  });

  it('returns [] when there is nothing to extract', () => {
    expect(extractAvailableModelsFromDiscovery([{}])).toEqual([]);
    expect(extractAvailableModelsFromDiscovery(null)).toEqual([]);
  });
});

describe('computeSearchMetadataConfig', () => {
  const discovery = [{ name: 'lsc', metadata: ['year', 'month', 'day', 'hour_id', 'epoch'] }];
  const profile = {
    media: { itemIdField: 'image_name' },
    groupBy: { modes: [{ value: 'byvideo', metadata: 'hour_id' }] }
  };

  it('throws when the runtime profile has no media.itemIdField configured', () => {
    expect(() => computeSearchMetadataConfig(discovery, {}, 'lsc')).toThrow(/missing "media.itemIdField"/);
  });

  it('resolves itemIdField from the profile', () => {
    const result = computeSearchMetadataConfig(discovery, profile, 'lsc');
    expect(result.itemIdField).toBe('image_name');
  });

  it('resolves the video-group field: discovery.groupby_attribute > profile byvideo metadata > "hour_id" fallback', () => {
    expect(computeSearchMetadataConfig(discovery, profile, 'lsc').videoGroupField).toBe('hour_id');

    const withGroupbyAttribute = [{ ...discovery[0], groupby_attribute: 'custom_field' }];
    expect(computeSearchMetadataConfig(withGroupbyAttribute, profile, 'lsc').videoGroupField).toBe('custom_field');

    const noConfiguredField = computeSearchMetadataConfig(discovery, { media: { itemIdField: 'x' } }, 'lsc');
    expect(noConfiguredField.videoGroupField).toBe('hour_id');
  });

  it('only includes optional/grouping fields that are in the discovery availability list (when one exists)', () => {
    const result = computeSearchMetadataConfig(discovery, profile, 'lsc');
    expect(result.defaultMetadataToRetrieve).toEqual(expect.arrayContaining(['hour_id', 'year', 'month', 'day', 'epoch']));
    // "location_country" is NOT in this discovery's metadata list, so it must be excluded.
    expect(result.defaultMetadataToRetrieve).not.toContain('location_country');
  });

  it('includes all optional fields unconditionally when discovery declares no availability list', () => {
    const noAvailabilityDiscovery = [{ name: 'lsc' }];
    const result = computeSearchMetadataConfig(noAvailabilityDiscovery, profile, 'lsc');
    expect(result.defaultMetadataToRetrieve).toEqual(expect.arrayContaining(['location_country', 'utc_offset_hours']));
    expect(result.knownMetadataFields.size).toBe(0);
  });

  it('deduplicates the requested fields list', () => {
    const result = computeSearchMetadataConfig(discovery, profile, 'lsc');
    const asSet = new Set(result.defaultMetadataToRetrieve);
    expect(asSet.size).toBe(result.defaultMetadataToRetrieve.length);
  });
});
