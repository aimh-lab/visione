import { describe, it, expect } from 'vitest';
import {
  getRawMetadata,
  toFiniteNumber,
  toIntOrNull,
  resolveEpochMs,
  resolveEpochSeconds,
  buildHourGroupKey
} from './epochResolution.js';

describe('getRawMetadata', () => {
  it('returns the nested raw.metadata object when present', () => {
    const item = { raw: { metadata: { year: 2024 } } };
    expect(getRawMetadata(item)).toEqual({ year: 2024 });
  });

  it('returns {} for missing/non-object metadata, and for non-object/null items', () => {
    expect(getRawMetadata({})).toEqual({});
    expect(getRawMetadata({ raw: {} })).toEqual({});
    expect(getRawMetadata({ raw: { metadata: 'not-an-object' } })).toEqual({});
    expect(getRawMetadata(null)).toEqual({});
    expect(getRawMetadata(undefined)).toEqual({});
    expect(getRawMetadata('string')).toEqual({});
  });
});

describe('toFiniteNumber', () => {
  it('parses numeric-looking values', () => {
    expect(toFiniteNumber(42)).toBe(42);
    expect(toFiniteNumber('42')).toBe(42);
    expect(toFiniteNumber('3.14')).toBeCloseTo(3.14);
  });

  it('returns null for non-finite/non-numeric input', () => {
    expect(toFiniteNumber('not-a-number')).toBeNull();
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
  });

  it('treats null and empty string as 0, not null (Number() coercion)', () => {
    // Documents the actual (slightly surprising) behavior: unlike toIntOrNull,
    // this helper does not special-case null/'' to null.
    expect(toFiniteNumber(null)).toBe(0);
    expect(toFiniteNumber('')).toBe(0);
  });
});

describe('toIntOrNull', () => {
  it('parses integer-looking values, truncating decimals', () => {
    expect(toIntOrNull(42)).toBe(42);
    expect(toIntOrNull('42')).toBe(42);
    expect(toIntOrNull('42.9')).toBe(42);
  });

  it('returns null for null/undefined/blank-string/non-numeric input', () => {
    expect(toIntOrNull(null)).toBeNull();
    expect(toIntOrNull(undefined)).toBeNull();
    expect(toIntOrNull('')).toBeNull();
    expect(toIntOrNull('   ')).toBeNull();
    expect(toIntOrNull('not-a-number')).toBeNull();
  });
});

describe('resolveEpochMs', () => {
  it('returns null for a non-object item', () => {
    expect(resolveEpochMs(null)).toBeNull();
    expect(resolveEpochMs(undefined)).toBeNull();
  });

  it('auto-detects seconds vs milliseconds by magnitude (default "auto" unit)', () => {
    // 2024-01-01T00:00:00Z in seconds and in ms.
    const seconds = 1704067200;
    const ms = 1704067200000;
    expect(resolveEpochMs({ epoch: seconds })).toBe(seconds * 1000);
    expect(resolveEpochMs({ epoch: ms })).toBe(ms);
  });

  it('honors an explicit epochUnit from runtimeProfile', () => {
    const value = 1704067200;
    expect(resolveEpochMs({ epoch: value }, { timeBadge: { epochUnit: 'seconds' } })).toBe(value * 1000);
    expect(resolveEpochMs({ epoch: value }, { timeBadge: { epochUnit: 'milliseconds' } })).toBe(value);
  });

  it('honors a custom epoch field alias from runtimeProfile', () => {
    const value = 1704067200000;
    const item = { raw: { customEpoch: value } };
    expect(resolveEpochMs(item, { fieldAliases: { epoch: 'customEpoch' } })).toBe(value);
  });

  it('falls back through metadata.epoch, raw.epoch, epoch, timestamp, raw.timestamp in order', () => {
    const value = 1704067200000;
    expect(resolveEpochMs({ raw: { metadata: { epoch: value } } })).toBe(value);
    expect(resolveEpochMs({ raw: { epoch: value } })).toBe(value);
    expect(resolveEpochMs({ epoch: value })).toBe(value);
    expect(resolveEpochMs({ timestamp: value })).toBe(value);
    expect(resolveEpochMs({ raw: { timestamp: value } })).toBe(value);
  });

  it('prefers the field-aliased/metadata value over the generic timestamp fallback', () => {
    const preferred = 1704067200000;
    const fallback = 1;
    expect(resolveEpochMs({ epoch: preferred, timestamp: fallback })).toBe(preferred);
  });

  it('returns null when no usable epoch-like field is present, or the value is negative', () => {
    expect(resolveEpochMs({})).toBeNull();
    expect(resolveEpochMs({ epoch: -5 })).toBeNull();
    expect(resolveEpochMs({ epoch: 'not-a-number' })).toBeNull();
  });
});

describe('resolveEpochSeconds', () => {
  it('is resolveEpochMs / 1000', () => {
    const item = { epoch: 1704067200000 };
    expect(resolveEpochSeconds(item)).toBe(1704067200);
  });

  it('returns null when resolveEpochMs would', () => {
    expect(resolveEpochSeconds({})).toBeNull();
  });
});

describe('buildHourGroupKey', () => {
  it('builds "YYYYMMDD_HH" from a resolved epoch, in UTC', () => {
    // 2024-03-05T14:30:00Z
    const epochSeconds = Date.UTC(2024, 2, 5, 14, 30, 0) / 1000;
    const key = buildHourGroupKey({ epoch: epochSeconds }, { timeBadge: { epochUnit: 'seconds' } });
    expect(key).toBe('20240305_14');
  });

  it('falls back to explicit year/month/day/hour metadata when no epoch resolves', () => {
    const item = { raw: { metadata: { year: 2023, month: 12, day: 31, hour: 23 } } };
    expect(buildHourGroupKey(item)).toBe('20231231_23');
  });

  it('falls back to a raw hour_id string when neither epoch nor y/m/d/h are usable', () => {
    const item = { raw: { metadata: { hour_id: '20220101_09_extra' } } };
    expect(buildHourGroupKey(item)).toBe('20220101_09');
  });

  it('falls back to fallbackVideoId as a last resort, verbatim (no hour_id pattern match)', () => {
    const item = {};
    expect(buildHourGroupKey(item, {}, 'video-42')).toBe('video-42');
  });

  it('returns an empty string when nothing at all is resolvable', () => {
    expect(buildHourGroupKey({})).toBe('');
  });

  it('rejects an out-of-range hour in the y/m/d/h fallback and falls through to hour_id', () => {
    const item = {
      raw: {
        metadata: { year: 2023, month: 1, day: 1, hour: 24, hour_id: '20230101_05' }
      }
    };
    expect(buildHourGroupKey(item)).toBe('20230101_05');
  });
});
