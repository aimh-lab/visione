import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDefaultGroupByOptions,
  normalizeGroupByOptions,
  resolveViewMode,
  resolveSortMode,
  resolveGroupByConfig,
  isVideoLikeGroupByMetadata,
  isVideoLikeGroupBy,
  SORT_MODE_OPTIONS
} from './groupByConfig.js';

// resolveViewMode/resolveSortMode log via warnFallback (console.warn) whenever
// they fall back from an unrecognized value — expected/intentional, but keep
// test output clean and let individual tests assert on it where relevant.
let warnSpy;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

const profileWith = (modes) => ({ groupBy: { modes } });

describe('getDefaultGroupByOptions', () => {
  it('returns the 3 built-in options (rank/date/video), as fresh copies', () => {
    const a = getDefaultGroupByOptions();
    const b = getDefaultGroupByOptions();
    expect(a.map((o) => o.value)).toEqual(['byrank', 'bydate', 'byvideo']);
    expect(a[0]).not.toBe(b[0]); // not the same object reference
    expect(a[0]).toEqual(b[0]); // but equal in content
  });
});

describe('normalizeGroupByOptions', () => {
  it('normalizes preset entries by value (byrank/bydate/byvideo), inheriting label/description/icon/kind', () => {
    const result = normalizeGroupByOptions(profileWith([{ value: 'byrank' }, { value: 'byvideo' }]));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ value: 'byrank', kind: 'rank' });
    expect(result[1]).toMatchObject({ value: 'byvideo', kind: 'video' });
  });

  it('normalizes a custom metadata-grouping entry', () => {
    const result = normalizeGroupByOptions(profileWith([{ value: 'bycountry', metadata: 'country', label: 'By Country' }]));
    expect(result).toEqual([
      expect.objectContaining({ value: 'bycountry', kind: 'metadata', metadata: 'country', label: 'By Country' })
    ]);
  });

  it('deduplicates entries with the same normalized value, keeping the first', () => {
    const result = normalizeGroupByOptions(profileWith([{ value: 'byrank', label: 'First' }, { value: 'byrank', label: 'Second' }]));
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('First');
  });

  it('throws when runtimeProfile.groupBy.modes is missing or not an array', () => {
    expect(() => normalizeGroupByOptions({})).toThrow(/groupBy\.modes is missing/);
    expect(() => normalizeGroupByOptions({ groupBy: { modes: 'not-an-array' } })).toThrow();
  });

  it('throws when every entry normalizes to nothing (all non-objects)', () => {
    expect(() => normalizeGroupByOptions(profileWith(['not-an-object', 42]))).toThrow(/normalized to zero valid options/);
  });
});

describe('resolveViewMode', () => {
  const profile = profileWith([{ value: 'byrank' }, { value: 'byvideo' }]);

  it('returns the current mode when it exists in the profile options', () => {
    expect(resolveViewMode('byvideo', profile)).toBe('byvideo');
  });

  it('falls back to the first option (with a warning) when the current mode is not available for this dataset', () => {
    expect(resolveViewMode('bydate', profile)).toBe('byrank');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('falls back silently (no warning) when there is no current mode at all', () => {
    expect(resolveViewMode('', profile)).toBe('byrank');
    expect(resolveViewMode(undefined, profile)).toBe('byrank');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('resolveSortMode', () => {
  it('passes through a recognized sort mode', () => {
    expect(resolveSortMode('time_asc')).toBe('time_asc');
    expect(resolveSortMode('relevance')).toBe('relevance');
  });

  it('maps the legacy alias "time" to "time_asc"', () => {
    expect(resolveSortMode('time')).toBe('time_asc');
  });

  it('is case-insensitive', () => {
    expect(resolveSortMode('RELEVANCE')).toBe('relevance');
  });

  it('falls back to "relevance" (with a warning) for an unrecognized non-empty value', () => {
    expect(resolveSortMode('bogus')).toBe('relevance');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('falls back silently for an empty value', () => {
    expect(resolveSortMode('')).toBe('relevance');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('agrees with SORT_MODE_OPTIONS on the set of recognized values', () => {
    for (const option of SORT_MODE_OPTIONS) {
      expect(resolveSortMode(option.value)).toBe(option.value);
    }
  });
});

describe('resolveGroupByConfig', () => {
  const profile = profileWith([{ value: 'byrank' }, { value: 'bycountry', metadata: 'country' }]);

  it('resolves the matching option for a known viewMode', () => {
    expect(resolveGroupByConfig('bycountry', profile)).toEqual({
      mode: 'bycountry',
      label: expect.any(String),
      kind: 'metadata',
      metadata: 'country'
    });
  });

  it('falls back to the first configured option for an unknown viewMode', () => {
    expect(resolveGroupByConfig('nonexistent', profile).mode).toBe('byrank');
  });
});

describe('isVideoLikeGroupByMetadata / isVideoLikeGroupBy', () => {
  it('recognizes "hour_id" (case/whitespace-insensitive) as video-like metadata', () => {
    expect(isVideoLikeGroupByMetadata('hour_id')).toBe(true);
    expect(isVideoLikeGroupByMetadata(' Hour_Id ')).toBe(true);
    expect(isVideoLikeGroupByMetadata('country')).toBe(false);
  });

  it('treats kind "video" as video-like regardless of metadata', () => {
    expect(isVideoLikeGroupBy({ kind: 'video' })).toBe(true);
  });

  it('treats kind "metadata" as video-like only when the metadata field is video-like', () => {
    expect(isVideoLikeGroupBy({ kind: 'metadata', metadata: 'hour_id' })).toBe(true);
    expect(isVideoLikeGroupBy({ kind: 'metadata', metadata: 'country' })).toBe(false);
  });

  it('treats any other kind as not video-like', () => {
    expect(isVideoLikeGroupBy({ kind: 'rank' })).toBe(false);
    expect(isVideoLikeGroupBy({ kind: 'date' })).toBe(false);
    expect(isVideoLikeGroupBy(null)).toBe(false);
  });
});
