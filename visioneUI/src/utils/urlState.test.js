// @vitest-environment jsdom
//
// deserializeFromURL() early-returns {} whenever `typeof window === 'undefined'`
// — even when an explicit urlString is passed — so it needs a `window` global
// to be testable at all.
import { describe, it, expect } from 'vitest';
import { serializeToURL, deserializeFromURL } from './urlState.js';

describe('serializeToURL', () => {
  it('encodes enabled, non-blank textarea values joined with "|" under "q"', () => {
    const state = { textareas: [{ enabled: true, value: 'first' }, { enabled: true, value: 'second' }] };
    expect(serializeToURL(state)).toBe('q=first%7Csecond');
  });

  it('skips disabled or blank-value textareas when building "q"', () => {
    const state = {
      textareas: [
        { enabled: true, value: 'kept' },
        { enabled: false, value: 'disabled' },
        { enabled: true, value: '   ' }
      ]
    };
    expect(serializeToURL(state)).toBe('q=kept');
  });

  it('encodes imageId under "img"', () => {
    expect(serializeToURL({ imageId: ' img-1 ' })).toBe('img=img-1');
  });

  it('encodes inlineQueryImages as "index:imgId" pairs joined with "," under "qimg"', () => {
    const state = { inlineQueryImages: [{ index: 0, imgId: 'a' }, { index: 2, imgId: 'b' }] };
    expect(serializeToURL(state)).toBe('qimg=0%3Aa%2C2%3Ab');
  });

  it('drops an inlineQueryImages entry with a non-integer index or blank imgId', () => {
    const state = { inlineQueryImages: [{ index: 0, imgId: 'a' }, { index: 'bad', imgId: 'b' }, { index: 1, imgId: '' }] };
    expect(serializeToURL(state)).toBe('qimg=0%3Aa');
  });

  it('encodes rfPositive/rfNegative imgIds joined with "," under "rfp"/"rfn"', () => {
    const state = {
      rfPositive: [{ imgId: 'p1' }, { imgId: 'p2' }],
      rfNegative: [{ imgId: 'n1' }]
    };
    const result = serializeToURL(state);
    expect(result).toContain('rfp=p1%2Cp2');
    expect(result).toContain('rfn=n1');
  });

  it('combines multiple state fields into one query string', () => {
    const state = { textareas: [{ enabled: true, value: 'q' }], imageId: 'img1' };
    const result = new URLSearchParams(serializeToURL(state));
    expect(result.get('q')).toBe('q');
    expect(result.get('img')).toBe('img1');
  });

  it('returns an empty string for an empty/default state', () => {
    expect(serializeToURL({})).toBe('');
  });
});

describe('deserializeFromURL', () => {
  it('parses "q" into one textarea per "|"-separated query', () => {
    const state = deserializeFromURL('q=first%7Csecond');
    expect(state.textareas).toEqual([
      { value: 'first', enabled: true },
      { value: 'second', enabled: true }
    ]);
  });

  it('parses "img" into a trailing similarity-step textarea, alongside any "q" textareas', () => {
    const state = deserializeFromURL('q=text&img=img1');
    expect(state.imageId).toBe('img1');
    expect(state.textareas).toEqual([
      { value: 'text', enabled: true },
      { value: '', enabled: true, similarityImgId: 'img1' }
    ]);
  });

  it('parses "img" alone (no "q") into a single similarity-step textarea', () => {
    const state = deserializeFromURL('img=img1');
    expect(state.textareas).toEqual([{ value: '', enabled: true, similarityImgId: 'img1' }]);
  });

  it('parses "qimg" into inlineQueryImages, padding textareas up to the max referenced index', () => {
    const state = deserializeFromURL('qimg=0%3Aa%2C2%3Ab');
    expect(state.inlineQueryImages).toEqual([{ index: 0, imgId: 'a' }, { index: 2, imgId: 'b' }]);
    expect(state.textareas).toHaveLength(3);
    expect(state.textareas[1]).toEqual({ value: '', enabled: true });
  });

  it('parses "rfp"/"rfn" into rfPositiveIds/rfNegativeIds arrays', () => {
    const state = deserializeFromURL('rfp=p1%2Cp2&rfn=n1');
    expect(state.rfPositiveIds).toEqual(['p1', 'p2']);
    expect(state.rfNegativeIds).toEqual(['n1']);
  });

  it('returns {} for an empty query string', () => {
    expect(deserializeFromURL('')).toEqual({});
    expect(deserializeFromURL('?')).toEqual({});
  });

  it('round-trips a non-trivial state through serialize -> deserialize for "q"/"img"/"rfp"/"rfn"', () => {
    const original = {
      textareas: [{ enabled: true, value: 'my query' }],
      imageId: 'img-42',
      rfPositive: [{ imgId: 'p1' }],
      rfNegative: [{ imgId: 'n1' }]
    };
    const roundTripped = deserializeFromURL(serializeToURL(original));
    expect(roundTripped.imageId).toBe('img-42');
    expect(roundTripped.rfPositiveIds).toEqual(['p1']);
    expect(roundTripped.rfNegativeIds).toEqual(['n1']);
    expect(roundTripped.textareas[0].value).toBe('my query');
  });
});
