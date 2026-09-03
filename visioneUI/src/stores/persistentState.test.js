// @vitest-environment jsdom
//
// Needs a real `window`/`localStorage` (jsdom), unlike the rest of the suite
// which runs under the faster 'node' environment (see vitest.config.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeGetItem, safeSetItem, safeRemoveItem, safeLoadJSON, safeSaveJSON, appSettingsStore } from './persistentState.js';
import { APP_SETTINGS_DEFAULTS } from '../config/appDefaults.js';

beforeEach(() => {
  localStorage.clear();
});

describe('safeGetItem / safeSetItem / safeRemoveItem', () => {
  it('round-trips a raw string value', () => {
    safeSetItem('k', 'hello');
    expect(safeGetItem('k')).toBe('hello');
  });

  it('returns the fallback (default null) for a missing key', () => {
    expect(safeGetItem('missing')).toBeNull();
    expect(safeGetItem('missing', 'fallback')).toBe('fallback');
  });

  it('removes a key so a subsequent read falls back', () => {
    safeSetItem('k', 'hello');
    safeRemoveItem('k');
    expect(safeGetItem('k')).toBeNull();
  });

  describe('when localStorage throws (private browsing / quota / disabled)', () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('safeGetItem swallows the error and returns the fallback', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('boom');
      });
      expect(safeGetItem('k', 'fallback')).toBe('fallback');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('safeSetItem swallows the error instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => safeSetItem('k', 'v')).not.toThrow();
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('safeRemoveItem swallows the error instead of throwing', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('boom');
      });
      expect(() => safeRemoveItem('k')).not.toThrow();
      expect(warnSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('safeLoadJSON / safeSaveJSON', () => {
  it('round-trips a JSON-serializable value', () => {
    safeSaveJSON('k', { a: 1, b: [2, 3] });
    expect(safeLoadJSON('k')).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns the fallback (default null) for a missing key', () => {
    expect(safeLoadJSON('missing')).toBeNull();
    expect(safeLoadJSON('missing', [])).toEqual([]);
  });

  it('returns the fallback and warns when the stored value is not valid JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    safeSetItem('k', 'not-json{');
    expect(safeLoadJSON('k', 'fallback')).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe('appSettingsStore (PersistentStore, exercised through the exported singleton)', () => {
  it('persists a value to localStorage on set() and reads it back via get()', () => {
    const next = { ...APP_SETTINGS_DEFAULTS, theme: 'dark' };
    appSettingsStore.set(next);
    expect(appSettingsStore.get()).toEqual(next);
    expect(JSON.parse(localStorage.getItem('visione-app-settings'))).toEqual(next);
  });

  it('update() merges via the callback and persists the result', () => {
    appSettingsStore.set(APP_SETTINGS_DEFAULTS);
    appSettingsStore.update((s) => ({ ...s, keyframeSize: 999 }));
    expect(appSettingsStore.get().keyframeSize).toBe(999);
  });

  it('clear() resets both the in-memory value and localStorage to initialValue', () => {
    // Note: clear() removes the key, then immediately calls set(initialValue),
    // which re-persists it — so the end state is "holds the serialized
    // defaults", not "the key is absent".
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, theme: 'dark' });
    appSettingsStore.clear();
    expect(appSettingsStore.get()).toEqual(APP_SETTINGS_DEFAULTS);
    expect(JSON.parse(localStorage.getItem('visione-app-settings'))).toEqual(APP_SETTINGS_DEFAULTS);
  });

  it('notifies subscribers with the new value on set()', () => {
    const seen = [];
    const unsubscribe = appSettingsStore.subscribe((v) => seen.push(v));
    const next = { ...APP_SETTINGS_DEFAULTS, theme: 'dark' };
    appSettingsStore.set(next);
    unsubscribe();
    expect(seen.at(-1)).toEqual(next);
  });
});
