// src/stores/persistentState.js
import { writable } from 'svelte/store';
import { APP_SETTINGS_DEFAULTS } from '../config/appDefaults.js';

// Shared localStorage helpers — used by PersistentStore below, and by the
// other localStorage-backed stores (queryTemplates, recentSearches,
// tabsPosition) that need a custom store API and can't reuse PersistentStore
// directly. Previously each of those stores hand-rolled its own try/catch
// around localStorage; tabsPosition.js in particular had none at all, so an
// unavailable/throwing localStorage (private browsing, quota) would crash it.
export function safeGetItem(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage:`, error);
    return fallback;
  }
}

export function safeSetItem(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage:`, error);
  }
}

export function safeRemoveItem(key) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove ${key} from localStorage:`, error);
  }
}

export function safeLoadJSON(key, fallback = null) {
  const raw = safeGetItem(key, null);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse ${key} from localStorage:`, error);
    return fallback;
  }
}

export function safeSaveJSON(key, value) {
  try {
    safeSetItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to stringify ${key} for localStorage:`, error);
  }
}

class PersistentStore {
  constructor(key, initialValue = null) {
    this.key = key;
    this.initialValue = initialValue;
    
    // Store Svelte interno
    const { subscribe, set, update } = writable(this.#loadFromStorage());
    
    this.subscribe = subscribe;
    this.set = (value) => {
      this.#saveToStorage(value);
      set(value);
    };
    this.update = (fn) => {
      update((current) => {
        const newValue = fn(current);
        this.#saveToStorage(newValue);
        return newValue;
      });
    };
  }

  get() {
    return this.#loadFromStorage();
  }

  #loadFromStorage() {
    return safeLoadJSON(this.key, this.initialValue);
  }

  #saveToStorage(value) {
    safeSaveJSON(this.key, value);
  }

  // Utility methods
  clear() {
    safeRemoveItem(this.key);
    this.set(this.initialValue);
  }
}

// Utility for persistent Sets (for submittedIds)
class PersistentSet extends PersistentStore {
  constructor(key) {
    super(key, []);
  }

  add(value) {
    this.update(arr => {
      if (!arr.includes(value)) {
        return [...arr, value];
      }
      return arr;
    });
  }

  delete(value) {
    this.update(arr => arr.filter(item => item !== value));
  }

  has(value) {
    let result = false;
    this.subscribe(arr => { result = arr.includes(value); })();
    return result;
  }

  getArray() {
    let result = [];
    this.subscribe(arr => { result = arr; })();
    return result;
  }

  toSet() {
    return new Set(this.getArray());
  }
}

// App-specific stores
export const appSettingsStore = new PersistentStore('visione-app-settings', APP_SETTINGS_DEFAULTS);
