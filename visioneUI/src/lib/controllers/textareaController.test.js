import { describe, it, expect } from 'vitest';
import {
  addTextarea,
  removeTextarea,
  toggleTextarea,
  swapTextareas,
  loadExampleQuery,
  clearSimilarityDisableMarker,
  restoreSimilarityDisabledSteps
} from './textareaController.js';
import { DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from '../../config/modelDefaults.js';

const ta = (value, extra = {}) => ({ value, enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL, ...extra });

describe('addTextarea', () => {
  it('inserts a new empty, enabled textarea right after `index`', () => {
    const textareas = [ta('a'), ta('b')];
    const result = addTextarea(textareas, 0);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe('a');
    expect(result[1]).toEqual({ value: '', enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL });
    expect(result[2].value).toBe('b');
  });

  it('appends at the end when index is the last position', () => {
    const textareas = [ta('a')];
    const result = addTextarea(textareas, 0);
    expect(result.map((t) => t.value)).toEqual(['a', '']);
  });

  it('does not mutate the original array', () => {
    const textareas = [ta('a')];
    addTextarea(textareas, 0);
    expect(textareas).toHaveLength(1);
  });
});

describe('removeTextarea', () => {
  it('removes the textarea at `index` and keeps textareaImages aligned by shifting indices', () => {
    const textareas = [ta('a'), ta('b'), ta('c')];
    const textareaImages = { 0: ['imgA'], 1: ['imgB'], 2: ['imgC'] };
    const result = removeTextarea(textareas, 1, textareaImages);
    expect(result.textareas.map((t) => t.value)).toEqual(['a', 'c']);
    expect(result.textareaImages).toEqual({ 0: ['imgA'], 1: ['imgC'] });
  });

  it('is a no-op (keeps shouldSearch false) when only one textarea remains', () => {
    const textareas = [ta('only')];
    const result = removeTextarea(textareas, 0, { 0: ['img'] });
    expect(result.textareas).toBe(textareas);
    expect(result.shouldSearch).toBe(false);
  });

  it('reports shouldSearch=true when a remaining enabled textarea has text, a similarity id, or inline images', () => {
    const withText = removeTextarea([ta(''), ta('kept')], 0, {});
    expect(withText.shouldSearch).toBe(true);

    const withSimilarity = removeTextarea([ta(''), ta('', { similarityImgId: 'img1' })], 0, {});
    expect(withSimilarity.shouldSearch).toBe(true);

    const withInlineImages = removeTextarea([ta(''), ta('')], 0, { 1: ['img1'] });
    expect(withInlineImages.shouldSearch).toBe(true);
  });

  it('reports shouldSearch=false when no remaining textarea is enabled+non-empty', () => {
    const result = removeTextarea([ta(''), ta('', { enabled: false })], 0, {});
    expect(result.shouldSearch).toBe(false);
  });
});

describe('toggleTextarea', () => {
  it('flips the enabled flag at `index` without touching other entries', () => {
    const textareas = [ta('a'), ta('b')];
    const result = toggleTextarea(textareas, 0);
    expect(result[0].enabled).toBe(false);
    expect(result[1].enabled).toBe(true);
    expect(result[1]).toBe(textareas[1]); // untouched entries are the same reference
  });
});

describe('swapTextareas', () => {
  it('swaps two textareas and their images in "swap" mode (default)', () => {
    const textareas = [ta('a'), ta('b')];
    const textareaImages = { 0: ['imgA'], 1: ['imgB'] };
    const result = swapTextareas(textareas, textareaImages, 0, 1);
    expect(result.textareas.map((t) => t.value)).toEqual(['b', 'a']);
    expect(result.textareaImages).toEqual({ 0: ['imgB'], 1: ['imgA'] });
  });

  it('moves a textarea to a new position in "move" mode, shifting the rest', () => {
    const textareas = [ta('a'), ta('b'), ta('c')];
    const textareaImages = { 0: ['imgA'], 1: ['imgB'], 2: ['imgC'] };
    const result = swapTextareas(textareas, textareaImages, 0, 2, 'move');
    expect(result.textareas.map((t) => t.value)).toEqual(['b', 'c', 'a']);
    expect(result.textareaImages).toEqual({ 0: ['imgB'], 1: ['imgC'], 2: ['imgA'] });
  });

  it('returns null for an out-of-range index or a no-op (same index)', () => {
    const textareas = [ta('a'), ta('b')];
    expect(swapTextareas(textareas, {}, -1, 0)).toBeNull();
    expect(swapTextareas(textareas, {}, 0, 2)).toBeNull();
    expect(swapTextareas(textareas, {}, 1, 1)).toBeNull();
  });
});

describe('loadExampleQuery', () => {
  it('builds one enabled textarea per query string, with default models', () => {
    const result = loadExampleQuery(['first query', 'second query']);
    expect(result).toEqual([
      { value: 'first query', enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL },
      { value: 'second query', enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL }
    ]);
  });

  it('returns an empty array for an empty query list', () => {
    expect(loadExampleQuery([])).toEqual([]);
  });
});

describe('clearSimilarityDisableMarker', () => {
  it('restores enabled=true and clears both markers when previously enabled before being disabled by similarity', () => {
    const t = ta('x', { enabled: false, _disabledBySimilarity: true, _wasEnabledBeforeSimilarity: true });
    const result = clearSimilarityDisableMarker(t);
    expect(result).toMatchObject({ enabled: true, _disabledBySimilarity: false, _wasEnabledBeforeSimilarity: false });
  });

  it('restores enabled=false when it was not enabled before being disabled by similarity', () => {
    const t = ta('x', { enabled: false, _disabledBySimilarity: true, _wasEnabledBeforeSimilarity: false });
    const result = clearSimilarityDisableMarker(t);
    expect(result.enabled).toBe(false);
  });

  it('clears a stray _wasEnabledBeforeSimilarity marker even without _disabledBySimilarity', () => {
    const t = ta('x', { _wasEnabledBeforeSimilarity: true });
    const result = clearSimilarityDisableMarker(t);
    expect(result._wasEnabledBeforeSimilarity).toBe(false);
    expect(result._disabledBySimilarity).toBe(false);
  });

  it('returns the same reference untouched when neither marker is set', () => {
    const t = ta('x');
    expect(clearSimilarityDisableMarker(t)).toBe(t);
  });

  it('handles a null/undefined textarea gracefully', () => {
    expect(clearSimilarityDisableMarker(null)).toBeNull();
    expect(clearSimilarityDisableMarker(undefined)).toBeUndefined();
  });
});

describe('restoreSimilarityDisabledSteps', () => {
  it('applies clearSimilarityDisableMarker to every step in the array', () => {
    const steps = [
      ta('a', { enabled: false, _disabledBySimilarity: true, _wasEnabledBeforeSimilarity: true }),
      ta('b')
    ];
    const result = restoreSimilarityDisabledSteps(steps);
    expect(result[0].enabled).toBe(true);
    expect(result[0]._disabledBySimilarity).toBe(false);
    expect(result[1]).toBe(steps[1]);
  });
});
