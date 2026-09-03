import { describe, it, expect } from 'vitest';
import { buildRows } from './buildRows.js';

const profileWith = (modes, extra = {}) => ({ groupBy: { modes }, ...extra });
const RANK_DATE_VIDEO_MODES = [{ value: 'byrank' }, { value: 'bydate' }, { value: 'byvideo' }];

const item = (imgId, extra = {}) => ({ imgId, ...extra });
const withEpochSeconds = (imgId, epochSeconds, extra = {}) => item(imgId, { epoch: epochSeconds, ...extra });
const withYmd = (imgId, year, month, day, extra = {}) =>
  item(imgId, { raw: { metadata: { year, month, day, ...(extra.metadata || {}) } }, ...extra });

describe('buildRows: input guards', () => {
  it('returns [] for an empty array, without needing a valid runtimeProfile', () => {
    expect(buildRows([], { viewMode: 'byrank' })).toEqual([]);
  });

  it('returns [] for non-array items', () => {
    expect(buildRows(null, { viewMode: 'byrank' })).toEqual([]);
    expect(buildRows(undefined, { viewMode: 'byrank' })).toEqual([]);
  });
});

describe('buildRows: byrank / kind "rank" (no grouping)', () => {
  const profile = profileWith(RANK_DATE_VIDEO_MODES);

  it('chunks items into rows of 48 (the fixed virtual-row size), flagging __visioneNoGroupChunk', () => {
    const items = Array.from({ length: 50 }, (_, i) => item(`img-${i}`));
    const rows = buildRows(items, { viewMode: 'byrank', runtimeProfile: profile, resultsPerGroup: 5 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(48);
    expect(rows[1]).toHaveLength(2);
    expect(rows[0].__visioneNoGroupChunk).toBe(true);
    expect(rows[1].__visioneNoGroupChunk).toBe(true);
  });

  it('preserves relevance (input) order when sortMode is not time-based', () => {
    const items = [item('a'), item('b'), item('c')];
    const rows = buildRows(items, { viewMode: 'byrank', runtimeProfile: profile, sortMode: 'relevance' });
    expect(rows[0].map((i) => i.imgId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by ascending/descending epoch when sortMode is time_asc/time_desc, even ungrouped', () => {
    const items = [
      withEpochSeconds('newest', 3000),
      withEpochSeconds('oldest', 1000),
      withEpochSeconds('middle', 2000)
    ];
    const asc = buildRows(items, { viewMode: 'byrank', runtimeProfile: profile, sortMode: 'time_asc' });
    expect(asc[0].map((i) => i.imgId)).toEqual(['oldest', 'middle', 'newest']);

    const desc = buildRows(items, { viewMode: 'byrank', runtimeProfile: profile, sortMode: 'time_desc' });
    expect(desc[0].map((i) => i.imgId)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('treats the legacy sortMode "time" the same as "time_asc"', () => {
    const items = [withEpochSeconds('b', 2000), withEpochSeconds('a', 1000)];
    const rows = buildRows(items, { viewMode: 'byrank', runtimeProfile: profile, sortMode: 'time' });
    expect(rows[0].map((i) => i.imgId)).toEqual(['a', 'b']);
  });
});

describe('buildRows: byvideo (kind "video")', () => {
  const profile = profileWith(RANK_DATE_VIDEO_MODES);

  it('groups items by their videoId field, capping each group at resultsPerGroup and splitting the rest into extra chunk rows', () => {
    const items = [
      item('v1-1', { videoId: 'v1' }),
      item('v1-2', { videoId: 'v1' }),
      item('v1-3', { videoId: 'v1' }),
      item('v2-1', { videoId: 'v2' })
    ];
    const rows = buildRows(items, { viewMode: 'byvideo', runtimeProfile: profile, resultsPerGroup: 2 });

    // v1's 3 items split into a 2-item row + a 1-item continuation row; v2 gets its own row.
    const v1Rows = rows.filter((r) => r.__visioneGroupKey === 'v1');
    expect(v1Rows.map((r) => r.length)).toEqual([2, 1]);
    expect(v1Rows[1].__visioneChunkBoundary).toBe(true);

    const v2Rows = rows.filter((r) => r.__visioneGroupKey === 'v2');
    expect(v2Rows).toHaveLength(1);
    expect(v2Rows[0]).toHaveLength(1);
  });

  it('gives the same grouped/split result regardless of resultsAutoFit (both branches converge)', () => {
    const items = [item('a', { videoId: 'v1' }), item('b', { videoId: 'v1' }), item('c', { videoId: 'v1' })];
    const withAuto = buildRows(items, { viewMode: 'byvideo', runtimeProfile: profile, resultsPerGroup: 2, resultsAutoFit: true });
    const withoutAuto = buildRows(items, { viewMode: 'byvideo', runtimeProfile: profile, resultsPerGroup: 2, resultsAutoFit: false });
    expect(withoutAuto).toEqual(withAuto);
  });
});

describe('buildRows: bydate (kind "date")', () => {
  const profile = profileWith(RANK_DATE_VIDEO_MODES);

  it('groups items by day (from explicit year/month/day metadata) into one row per day', () => {
    const items = [
      withYmd('a', 2024, 1, 15),
      withYmd('b', 2024, 1, 15),
      withYmd('c', 2024, 1, 16)
    ];
    const rows = buildRows(items, { viewMode: 'bydate', runtimeProfile: profile, resultsPerGroup: 10 });
    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((r) => [r.__visioneGroupKey, r.map((i) => i.imgId)]));
    expect(byKey['2024-01-15']).toEqual(['a', 'b']);
    expect(byKey['2024-01-16']).toEqual(['c']);
  });

  it('orders day-groups by date when sortMode is time_desc/time_asc', () => {
    const items = [withYmd('early', 2024, 1, 1), withYmd('late', 2024, 6, 1)];
    const desc = buildRows(items, { viewMode: 'bydate', runtimeProfile: profile, sortMode: 'time_desc' });
    expect(desc.map((r) => r.__visioneGroupKey)).toEqual(['2024-06-01', '2024-01-01']);

    const asc = buildRows(items, { viewMode: 'bydate', runtimeProfile: profile, sortMode: 'time_asc' });
    expect(asc.map((r) => r.__visioneGroupKey)).toEqual(['2024-01-01', '2024-06-01']);
  });

  it('falls back to a per-item "unknown-date-<id>" bucket when no date/epoch is resolvable', () => {
    const items = [item('mystery')];
    const rows = buildRows(items, { viewMode: 'bydate', runtimeProfile: profile });
    expect(rows).toHaveLength(1);
    expect(rows[0].__visioneGroupKey).toBe('unknown-date-mystery');
  });
});

describe('buildRows: metadata grouping (kind "metadata")', () => {
  const metadataProfile = profileWith([{ value: 'bycountry', metadata: 'country' }]);
  const hourIdProfile = profileWith([{ value: 'byhour', metadata: 'hour_id' }]);

  it('groups by an arbitrary (non-video-like) metadata field, bucketing missing values as "N/A"', () => {
    const items = [
      item('a', { raw: { metadata: { country: 'Ireland' } } }),
      item('b', { raw: { metadata: { country: 'Ireland' } } }),
      item('c', { raw: { metadata: {} } })
    ];
    const rows = buildRows(items, { viewMode: 'bycountry', runtimeProfile: metadataProfile, resultsPerGroup: 10 });
    const byKey = Object.fromEntries(rows.map((r) => [r.__visioneGroupKey, r.map((i) => i.imgId)]));
    expect(byKey.Ireland).toEqual(['a', 'b']);
    expect(byKey['N/A']).toEqual(['c']);
  });

  it('treats a video-like metadata field (e.g. "hour_id") as an hour bucket, capping (not splitting) oversized groups', () => {
    const items = [
      item('a', { raw: { metadata: { hour_id: '20240101_08' } } }),
      item('b', { raw: { metadata: { hour_id: '20240101_08' } } }),
      item('c', { raw: { metadata: { hour_id: '20240101_08' } } })
    ];
    const rows = buildRows(items, { viewMode: 'byhour', runtimeProfile: hourIdProfile, resultsPerGroup: 2 });
    // Capped at 2, NOT split into a second continuation row (unlike byvideo above).
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0].__visioneGroupKey).toBe('20240101_08');
  });
});
