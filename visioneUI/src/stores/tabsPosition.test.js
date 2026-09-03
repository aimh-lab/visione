// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { tabsPosition } from './tabsPosition.js';

const STORAGE_KEY = 'visione_tabs_position';

beforeEach(() => {
  localStorage.clear();
});

describe('tabsPosition', () => {
  it('set() updates the store value and persists it (as a raw string) to localStorage', () => {
    tabsPosition.set('bottom');
    expect(get(tabsPosition)).toBe('bottom');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('bottom');
  });

  it('subscribers see the new value after set()', () => {
    const seen = [];
    const unsubscribe = tabsPosition.subscribe((v) => seen.push(v));
    tabsPosition.set('bottom');
    unsubscribe();
    expect(seen.at(-1)).toBe('bottom');
  });
});
