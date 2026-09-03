import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  getStepColor,
  withAlpha,
  getShortcutForField,
  getDefaultComparatorForField,
  getMetadataFieldHint,
  toComparatorSymbol
} from './queryStepFormatting.js';
import { CATEGORICAL_PALETTE } from '../config/categoricalPalette.js';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#ff0080')).toEqual({ r: 255, g: 0, b: 128 });
  });

  it('parses a 3-digit shorthand hex color by doubling each digit', () => {
    expect(hexToRgb('#f08')).toEqual({ r: 255, g: 0, b: 136 });
  });

  it('works without a leading "#"', () => {
    expect(hexToRgb('ff0080')).toEqual({ r: 255, g: 0, b: 128 });
  });
});

describe('getStepColor', () => {
  it('returns an rgb() string derived from the categorical palette at `index`', () => {
    const expected = hexToRgb(CATEGORICAL_PALETTE[0]);
    expect(getStepColor(0)).toBe(`rgb(${expected.r}, ${expected.g}, ${expected.b})`);
  });

  it('wraps around the palette length for an out-of-range index', () => {
    expect(getStepColor(CATEGORICAL_PALETTE.length)).toBe(getStepColor(0));
  });
});

describe('withAlpha', () => {
  it('adds an alpha channel to an rgb() string', () => {
    expect(withAlpha('rgb(255, 0, 128)', 0.5)).toBe('rgba(255, 0, 128, 0.5)');
  });

  it('clamps alpha to [0, 1]', () => {
    expect(withAlpha('rgb(1, 2, 3)', 5)).toBe('rgba(1, 2, 3, 1)');
    expect(withAlpha('rgb(1, 2, 3)', -5)).toBe('rgba(1, 2, 3, 0)');
  });

  it('returns the input unchanged when it is not an rgb() string', () => {
    expect(withAlpha('#ff0080', 0.5)).toBe('#ff0080');
    expect(withAlpha('not-a-color', 0.5)).toBe('not-a-color');
  });
});

describe('getShortcutForField', () => {
  it('lowercases and trims the field name', () => {
    expect(getShortcutForField('  Year  ')).toBe('year');
  });

  it('returns an empty string for a blank/missing field', () => {
    expect(getShortcutForField('')).toBe('');
    expect(getShortcutForField(undefined)).toBe('');
  });
});

describe('getDefaultComparatorForField', () => {
  it('returns "eq" for known numeric fields (case-insensitive)', () => {
    expect(getDefaultComparatorForField('year')).toBe('eq');
    expect(getDefaultComparatorForField('EPOCH')).toBe('eq');
  });

  it('returns "fts" for any other field', () => {
    expect(getDefaultComparatorForField('location')).toBe('fts');
    expect(getDefaultComparatorForField('')).toBe('fts');
  });
});

describe('getMetadataFieldHint', () => {
  it('gives a numeric-comparator example for a numeric field', () => {
    expect(getMetadataFieldHint('year')).toBe('year:42 or year:>42');
  });

  it('gives a fuzzy-text example for a non-numeric field', () => {
    expect(getMetadataFieldHint('location')).toBe('location:dublin or location:~dublin');
  });
});

describe('toComparatorSymbol', () => {
  it('maps each known comparator to its symbol', () => {
    expect(toComparatorSymbol('gte')).toBe('>=');
    expect(toComparatorSymbol('lte')).toBe('<=');
    expect(toComparatorSymbol('gt')).toBe('>');
    expect(toComparatorSymbol('lt')).toBe('<');
    expect(toComparatorSymbol('eq')).toBe('=');
    expect(toComparatorSymbol('ne')).toBe('!=');
    expect(toComparatorSymbol('fts')).toBe('~');
  });

  it('is case-insensitive', () => {
    expect(toComparatorSymbol('GTE')).toBe('>=');
  });

  it('falls back to the `fallback` comparator when the primary one is unrecognized', () => {
    expect(toComparatorSymbol('bogus', 'gt')).toBe('>');
  });

  it('falls back to "=" when neither comparator nor fallback is recognized', () => {
    expect(toComparatorSymbol('bogus', 'also-bogus')).toBe('=');
    expect(toComparatorSymbol('', '')).toBe('=');
  });
});
