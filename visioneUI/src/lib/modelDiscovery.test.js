import { describe, it, expect } from 'vitest';
import { normalizeAvailableModelEntry, supportsTextModel, supportsImageModel } from './modelDiscovery.js';

describe('normalizeAvailableModelEntry', () => {
  it('normalizes a plain string entry, defaulting modalities to text+image (legacy compat)', () => {
    expect(normalizeAvailableModelEntry('clip-vit')).toEqual({ name: 'clip-vit', modalities: ['text', 'image'] });
  });

  it('trims a string entry and rejects a blank one', () => {
    expect(normalizeAvailableModelEntry('  clip-vit  ')).toEqual({ name: 'clip-vit', modalities: ['text', 'image'] });
    expect(normalizeAvailableModelEntry('   ')).toBeNull();
    expect(normalizeAvailableModelEntry('')).toBeNull();
  });

  it('normalizes an object entry with explicit modalities, lowercased and deduplicated', () => {
    const result = normalizeAvailableModelEntry({ name: 'clip-vit', modalities: ['Text', 'text', 'IMAGE'] });
    expect(result.name).toBe('clip-vit');
    expect(result.modalities.sort()).toEqual(['image', 'text']);
  });

  it('defaults to text+image when an object entry has no/empty modalities array', () => {
    expect(normalizeAvailableModelEntry({ name: 'clip-vit' })).toEqual({ name: 'clip-vit', modalities: ['text', 'image'] });
    expect(normalizeAvailableModelEntry({ name: 'clip-vit', modalities: [] })).toEqual({ name: 'clip-vit', modalities: ['text', 'image'] });
  });

  it('rejects an object entry with a blank/missing name', () => {
    expect(normalizeAvailableModelEntry({ modalities: ['text'] })).toBeNull();
    expect(normalizeAvailableModelEntry({ name: '  ', modalities: ['text'] })).toBeNull();
  });

  it('rejects non-string, non-object input', () => {
    expect(normalizeAvailableModelEntry(null)).toBeNull();
    expect(normalizeAvailableModelEntry(undefined)).toBeNull();
    expect(normalizeAvailableModelEntry(42)).toBeNull();
  });
});

describe('supportsTextModel / supportsImageModel', () => {
  it('recognizes direct "text"/"image" modalities', () => {
    expect(supportsTextModel({ modalities: ['text'] })).toBe(true);
    expect(supportsTextModel({ modalities: ['image'] })).toBe(false);
    expect(supportsImageModel({ modalities: ['image'] })).toBe(true);
    expect(supportsImageModel({ modalities: ['text'] })).toBe(false);
  });

  it('recognizes the combined "image+text" modality for both checks', () => {
    expect(supportsTextModel({ modalities: ['image+text'] })).toBe(true);
    expect(supportsImageModel({ modalities: ['image+text'] })).toBe(true);
  });

  it('returns false when neither the specific nor the combined modality is present', () => {
    expect(supportsTextModel({ modalities: ['audio'] })).toBe(false);
    expect(supportsImageModel({ modalities: ['audio'] })).toBe(false);
  });
});
