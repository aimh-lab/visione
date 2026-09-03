import { describe, it, expect } from 'vitest';
import { tabConfig, getTabConfig } from './tabConfig.js';

describe('getTabConfig', () => {
  it('returns the known config for View1/View2/Similarity', () => {
    expect(getTabConfig('View1')).toBe(tabConfig.View1);
    expect(getTabConfig('View2')).toBe(tabConfig.View2);
    expect(getTabConfig('Similarity')).toBe(tabConfig.Similarity);
  });

  it('falls back to { label: view, icon: null } for an unknown tab key', () => {
    expect(getTabConfig('SomethingElse')).toEqual({ label: 'SomethingElse', icon: null });
  });
});
