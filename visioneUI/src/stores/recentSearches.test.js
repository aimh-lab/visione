// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { recentSearches } from './recentSearches.js';

const STORAGE_KEY = 'visione_recent_searches';

beforeEach(() => {
  localStorage.clear();
  recentSearches.clear();
});

describe('recentSearches.add', () => {
  it('adds a new search entry, most recent first', () => {
    recentSearches.add('query a', 10);
    recentSearches.add('query b', 5);
    const list = get(recentSearches);
    expect(list.map((s) => s.query)).toEqual(['query b', 'query a']);
    expect(list[0]).toMatchObject({ query: 'query b', resultCount: 5 });
    expect(list[0].timestamp).toBeTypeOf('number');
  });

  it('replaces (moves to front) an existing entry with the same query, rather than duplicating it', () => {
    recentSearches.add('query a', 10);
    recentSearches.add('query b', 20);
    recentSearches.add('query a', 99);
    const list = get(recentSearches);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ query: 'query a', resultCount: 99 });
  });

  it('normalizes a similarityPreview, dropping a data: URL but keeping imgId/name', () => {
    recentSearches.add('q', 1, null, null, { imgId: 'img1', url: 'data:image/png;base64,xxx', name: 'Preview' });
    const [entry] = get(recentSearches);
    expect(entry.similarityPreview).toEqual({ imgId: 'img1', url: null, name: 'Preview' });
  });

  it('returns null similarityPreview for an empty/invalid preview', () => {
    recentSearches.add('q', 1, null, null, {});
    expect(get(recentSearches)[0].similarityPreview).toBeNull();
    recentSearches.add('q2', 1, null, null, null);
    expect(get(recentSearches)[0].similarityPreview).toBeNull();
  });

  it('keeps the full `results` payload for the most recent entries, in memory', () => {
    recentSearches.add('q', 1, ['frame1', 'frame2']);
    expect(get(recentSearches)[0].results).toEqual(['frame1', 'frame2']);
  });

  it('drops `results` (keeping metadata) for entries beyond the most-recent cache window', () => {
    // Add more entries than the in-memory results cache keeps, then check an
    // older entry lost its `results` while staying in the list.
    for (let i = 0; i < 8; i += 1) {
      recentSearches.add(`query-${i}`, i, [`frame-${i}`]);
    }
    const list = get(recentSearches);
    expect(list).toHaveLength(8);
    expect(list[0].results).toEqual(['frame-7']); // most recent: kept
    expect(list[7].results).toBeNull(); // oldest: dropped
    expect(list[7].query).toBe('query-0'); // still present, just without results
  });

  it('caps the list at 30 entries, dropping the oldest', () => {
    for (let i = 0; i < 35; i += 1) {
      recentSearches.add(`query-${i}`, i);
    }
    const list = get(recentSearches);
    expect(list).toHaveLength(30);
    expect(list[0].query).toBe('query-34');
    expect(list.some((s) => s.query === 'query-0')).toBe(false);
  });

  it('persists lightweight metadata (without `results`) to localStorage', () => {
    recentSearches.add('q', 1, ['frame1']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].query).toBe('q');
    expect(stored[0].results).toBeUndefined();
  });
});

describe('recentSearches.remove', () => {
  it('removes the entry with the matching query', () => {
    recentSearches.add('a', 1);
    recentSearches.add('b', 1);
    recentSearches.remove('a');
    expect(get(recentSearches).map((s) => s.query)).toEqual(['b']);
  });
});

describe('recentSearches.clear', () => {
  it('empties the store and removes the localStorage key', () => {
    recentSearches.add('a', 1);
    recentSearches.clear();
    expect(get(recentSearches)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('recentSearches.find', () => {
  it('returns the in-memory entry matching the query', () => {
    recentSearches.add('a', 1, ['frame']);
    expect(recentSearches.find('a')).toMatchObject({ query: 'a', results: ['frame'] });
  });

  it('returns undefined for an unknown query', () => {
    expect(recentSearches.find('nonexistent')).toBeUndefined();
  });
});
