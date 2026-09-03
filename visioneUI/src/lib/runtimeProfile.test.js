import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveRuntimeProfile } from './runtimeProfile.js';

describe('resolveRuntimeProfile', () => {
  it('merges defaults.json with the collection and competition overrides', () => {
    const profile = resolveRuntimeProfile('lsc', 'default');
    // Stable, dataset-defining fields documented in discoveryConfig.js's
    // "image_name" for LSC / "id" for V3C comment — a real regression in the
    // collection JSON or the merge logic would break this.
    expect(profile.media.itemIdField).toBe('image_name');
    expect(profile.media.hasVideos).toBe(false);
  });

  it('resolves a different collection to different collection-specific values', () => {
    const lsc = resolveRuntimeProfile('lsc', 'default');
    const v3c = resolveRuntimeProfile('v3c', 'default');
    expect(v3c.media.itemIdField).toBe('id');
    expect(v3c.media.hasVideos).toBe(true);
    expect(v3c.media.itemIdField).not.toBe(lsc.media.itemIdField);
  });

  it('is case-insensitive on the collection name', () => {
    expect(resolveRuntimeProfile('LSC', 'default').media.itemIdField).toBe('image_name');
  });

  it('falls back to just the defaults for the special "default" collection name', () => {
    const profile = resolveRuntimeProfile('default', 'default');
    // defaults.json declares media.hasVideos: true and no itemIdField.
    expect(profile.media.hasVideos).toBe(true);
    expect(profile.media.itemIdField).toBeUndefined();
  });

  it('throws for an unknown collection (refuses to silently fall back)', () => {
    expect(() => resolveRuntimeProfile('not-a-real-collection', 'default')).toThrow(
      /has no entry in src\/config\/runtimeProfiles\/collections/
    );
  });

  it('maps the "QA" competition alias to "Q&A"', () => {
    // Both should resolve without throwing and merge the same competitions.json entry.
    expect(() => resolveRuntimeProfile('lsc', 'QA')).not.toThrow();
    expect(() => resolveRuntimeProfile('lsc', 'Q&A')).not.toThrow();
  });

  it('is case-insensitive on the competition name', () => {
    expect(() => resolveRuntimeProfile('lsc', 'kis')).not.toThrow();
  });

  describe('unrecognized competition', () => {
    let warnSpy;
    afterEach(() => warnSpy?.mockRestore());

    it('warns and falls back to the "default" competition entry for an unrecognized competition name', () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => resolveRuntimeProfile('lsc', 'not-a-real-competition')).not.toThrow();
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('does not warn for the "default" competition itself', () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      resolveRuntimeProfile('lsc', 'default');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('deep-merges nested plain objects key by key (e.g. media.hasVideos + media.itemIdField both survive)', () => {
    // defaults.json sets media.hasVideos; lsc.json sets media.itemIdField without
    // repeating hasVideos — both must be present in the merged profile.
    const profile = resolveRuntimeProfile('lsc', 'default');
    expect(profile.media).toMatchObject({ hasVideos: false, itemIdField: 'image_name' });
  });

  it('replaces (not element-wise merges) an array value: collection groupBy.modes fully replaces the default one', () => {
    // Arrays are not deep-merged (isObject() excludes them) — lsc.json's
    // groupBy.modes wholesale-replaces defaults.json's, so it must itself
    // fully redeclare every mode it wants (byrank/bydate/byvideo), which it does.
    const profile = resolveRuntimeProfile('lsc', 'default');
    const byVideo = profile.groupBy.modes.find((m) => m.value === 'byvideo');
    expect(byVideo).toMatchObject({ label: 'By Hour', metadata: 'hour_id' });
    expect(profile.groupBy.modes).toHaveLength(3);
  });
});
