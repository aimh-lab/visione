import { describe, it, expect } from 'vitest';
import {
  formatVideoGroupLabel,
  formatGroupDateLabel,
  formatGroupHourLabel,
  formatImageDisplayTitle,
  formatImageTemporalBadge
} from './titleFormatting.js';

describe('formatVideoGroupLabel', () => {
  it('returns the raw label unchanged when the runtimeProfile has no videoGroup titleFormatting config', () => {
    expect(formatVideoGroupLabel('20240115_09', {}, {})).toBe('20240115_09');
  });

  it('returns the raw label when videoGroup config is explicitly disabled', () => {
    const profile = { titleFormatting: { videoGroup: { enabled: false } } };
    expect(formatVideoGroupLabel('20240115_09', {}, profile)).toBe('20240115_09');
  });

  it('mode "formatted" replaces the raw hour-bucket label with a human date/time', () => {
    const profile = { titleFormatting: { videoGroup: { mode: 'formatted', hourPrefix: 'h' } } };
    const result = formatVideoGroupLabel('20240115_09', {}, profile, false);
    expect(result).toMatch(/15\/01\/2024/);
    expect(result).toMatch(/h09/);
  });

  it('mode "both" (default) combines raw label and formatted date with the configured separator', () => {
    const profile = { titleFormatting: { videoGroup: { mode: 'both', separator: ' - ', hourPrefix: 'h' } } };
    const result = formatVideoGroupLabel('20240115_09', {}, profile, false);
    expect(result.startsWith('20240115_09 - ')).toBe(true);
    expect(result).toMatch(/15\/01\/2024/);
  });

  it('returns the raw label unchanged (no crash) when the label is not a recognized hour-bucket and no epoch resolves', () => {
    const profile = { titleFormatting: { videoGroup: { mode: 'formatted' } } };
    expect(formatVideoGroupLabel('not-a-bucket', {}, profile, false)).toBe('not-a-bucket');
  });

  it('returns "" for a blank/missing label', () => {
    expect(formatVideoGroupLabel('', {}, {})).toBe('');
    expect(formatVideoGroupLabel(null, {}, {})).toBe('');
  });
});

describe('formatGroupDateLabel', () => {
  it('formats a "YYYY-MM-DD" day key into a weekday + date label', () => {
    // 2024-01-15 is a Monday.
    expect(formatGroupDateLabel('2024-01-15', {}, {}, false)).toBe('Monday 15/01/2024');
  });

  it('falls back to the raw label when it is not a recognized day key and no epoch resolves', () => {
    expect(formatGroupDateLabel('not-a-day-key', {}, {}, false)).toBe('not-a-day-key');
  });

  it('appends a country label from the item(s) when present and not already in the label', () => {
    const item = { raw: { metadata: { location_country: 'Ireland' } } };
    expect(formatGroupDateLabel('2024-01-15', item, {}, false)).toBe('Monday 15/01/2024 · Ireland');
  });

  it('does not duplicate a country already present in the base label', () => {
    const item = { raw: { metadata: { location_country: 'Ireland' } } };
    // formatUtcDayLabel never includes a country itself, so this exercises the
    // case-insensitive "already included" check with a label that happens to.
    const result = formatGroupDateLabel('2024-01-15', item, {}, false);
    expect(result.match(/Ireland/g)).toHaveLength(1);
  });

  it('collects and appends multiple distinct countries from a group of items', () => {
    const groupItems = [
      { raw: { metadata: { location_country: 'Ireland' } } },
      { raw: { metadata: { location_country: 'France' } } },
      { raw: { metadata: { location_country: 'Ireland' } } } // duplicate, should not repeat
    ];
    const result = formatGroupDateLabel('2024-01-15', groupItems[0], {}, false, groupItems);
    expect(result).toBe('Monday 15/01/2024 · Ireland / France');
  });
});

describe('formatGroupHourLabel', () => {
  it('formats a "YYYYMMDD_HH" hour key into "<weekday date> <HH>h"', () => {
    expect(formatGroupHourLabel('20240115_09', {}, {}, false)).toBe('Monday 15/01/2024 09h');
  });

  it('falls back to the raw label when it is not a recognized hour key and no epoch resolves', () => {
    expect(formatGroupHourLabel('not-an-hour-key', {}, {}, false)).toBe('not-an-hour-key');
  });
});

describe('formatImageDisplayTitle', () => {
  it('uses item.title, falling back to imgId, falling back to "Image <index+1>"', () => {
    expect(formatImageDisplayTitle({ title: 'My Photo' }, {}, false)).toBe('My Photo');
    expect(formatImageDisplayTitle({ imgId: 'img-42' }, {}, false)).toBe('img-42');
    expect(formatImageDisplayTitle({ index: 4 }, {}, false)).toBe('Image 5');
  });

  it('returns just the raw title when imageTitle config is missing/disabled', () => {
    expect(formatImageDisplayTitle({ title: 'My Photo' }, {}, false)).toBe('My Photo');
    const profile = { titleFormatting: { imageTitle: { enabled: false } } };
    expect(formatImageDisplayTitle({ title: 'My Photo' }, profile, false)).toBe('My Photo');
  });

  it('mode "both" appends the formatted epoch-derived time using the configured separator', () => {
    const epochSeconds = Date.UTC(2024, 0, 15, 9, 30, 0) / 1000;
    const item = { title: 'My Photo', epoch: epochSeconds };
    const profile = { titleFormatting: { imageTitle: { enabled: true, mode: 'both', separator: ' | ' } } };
    const result = formatImageDisplayTitle(item, profile, false);
    expect(result).toMatch(/^My Photo \| /);
    expect(result).toMatch(/15\/01\/2024/);
  });
});

describe('formatImageTemporalBadge', () => {
  it('returns "" when imageTitle config is disabled or no epoch resolves', () => {
    expect(formatImageTemporalBadge({}, { titleFormatting: { imageTitle: { enabled: false } } })).toBe('');
    expect(formatImageTemporalBadge({}, {})).toBe('');
  });

  it('returns the formatted date/time for an item with a resolvable epoch', () => {
    const epochSeconds = Date.UTC(2024, 0, 15, 9, 30, 0) / 1000;
    const result = formatImageTemporalBadge({ epoch: epochSeconds }, {}, false);
    expect(result).toMatch(/15\/01\/2024/);
    expect(result).toMatch(/09:30/);
  });
});
