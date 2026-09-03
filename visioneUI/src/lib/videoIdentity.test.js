import { describe, it, expect } from 'vitest';
import { parseVideoIdFromImgId, resolveVideoId } from './videoIdentity.js';

describe('parseVideoIdFromImgId', () => {
  it('returns { videoId: "", source: "none" } for empty/null/undefined input', () => {
    expect(parseVideoIdFromImgId('')).toEqual({ videoId: '', source: 'none' });
    expect(parseVideoIdFromImgId(null)).toEqual({ videoId: '', source: 'none' });
    expect(parseVideoIdFromImgId(undefined)).toEqual({ videoId: '', source: 'none' });
    expect(parseVideoIdFromImgId('   ')).toEqual({ videoId: '', source: 'none' });
  });

  it('recognizes the LSC hour-bucket naming pattern, extracting "YYYYMMDD_HH"', () => {
    expect(parseVideoIdFromImgId('20190101_121948_000.jpg')).toEqual({
      videoId: '20190101_12',
      source: 'lscHourBucket'
    });
  });

  it('recognizes the LSC pattern without a file extension', () => {
    expect(parseVideoIdFromImgId('20190101_121948_000')).toEqual({
      videoId: '20190101_12',
      source: 'lscHourBucket'
    });
  });

  it('recognizes a generic "<prefix>-<n>-<m>" dash-pair naming pattern', () => {
    expect(parseVideoIdFromImgId('shot-45-67.jpg')).toEqual({
      videoId: '45',
      source: 'dashPair'
    });
  });

  it('falls back to everything before the first dash when no pattern matches', () => {
    expect(parseVideoIdFromImgId('abc-def-ghi')).toEqual({
      videoId: 'abc',
      source: 'fallbackSplit'
    });
  });

  it('falls back to the whole string when there is no dash at all', () => {
    expect(parseVideoIdFromImgId('novideoid')).toEqual({
      videoId: 'novideoid',
      source: 'fallbackSplit'
    });
  });

  it('prefers the LSC pattern over the dash-pair pattern when both could plausibly apply', () => {
    // Looks LSC-shaped (8 digits, underscore, 2 digits, 4 digits, underscore, 3 digits)
    // and also ends in a dash-pair-like shape it should NOT be misread as.
    const result = parseVideoIdFromImgId('20190101_121948_000.jpg');
    expect(result.source).toBe('lscHourBucket');
  });
});

describe('resolveVideoId', () => {
  it('returns the explicit videoId, trimmed, without inspecting imgId at all', () => {
    expect(resolveVideoId('anything-parses-differently', '  explicit-id  ')).toEqual({
      videoId: 'explicit-id',
      source: 'explicit'
    });
  });

  it('falls through to parsing imgId when explicitVideoId is null/undefined/blank', () => {
    expect(resolveVideoId('shot-45-67.jpg', null)).toEqual({ videoId: '45', source: 'dashPair' });
    expect(resolveVideoId('shot-45-67.jpg', undefined)).toEqual({ videoId: '45', source: 'dashPair' });
    expect(resolveVideoId('shot-45-67.jpg', '   ')).toEqual({ videoId: '45', source: 'dashPair' });
  });

  it('coerces a numeric explicitVideoId to a string', () => {
    expect(resolveVideoId('x', 12345)).toEqual({ videoId: '12345', source: 'explicit' });
  });
});
