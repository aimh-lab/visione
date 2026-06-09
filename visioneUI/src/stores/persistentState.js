// src/stores/persistentState.js
import { writable } from 'svelte/store';

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
    if (typeof window === 'undefined') return this.initialValue;
    
    try {
      const stored = localStorage.getItem(this.key);
      return stored ? JSON.parse(stored) : this.initialValue;
    } catch (error) {
      console.warn(`Failed to load ${this.key} from localStorage:`, error);
      return this.initialValue;
    }
  }

  #saveToStorage(value) {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to save ${this.key} to localStorage:`, error);
    }
  }

  // Utility methods
  clear() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.key);
    }
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
export const appSettingsStore = new PersistentStore('visione-app-settings', {
  theme: 'default',
  contentScale: 1,
  viewMode: 'byvideo',
  sortMode: 'relevance',
  isSidebarOpen: true,
  isSidebarRightOpen: false,
  sidebarLeftWidth: 18,
  sidebarRightWidth: 18,
  keyframeSize: 130,
  resultsPerGroup: 8,
  queryResultK: 7200,
  resultsAutoFit: true,
  cacheEnabled: true,
  dedupeResults: true,
  apiServicesHostOverrideEnabled: false,
  apiServicesHost: '',
  dataserverHostOverrideEnabled: false,
  dataserverHost: '',
  justifyResultRows: false,
  tupleIndicatorMode: 'badge+bar',
  videoBadgeOrientation: 'vertical',
  resultsetBadgeLabelMode: 'both',
  showLocalTimeInTitles: true,
  timeBadgeTimezoneOverride: 'profile',
  virtualizationEnabled: true,
  virtualizationThreshold: 40,
  dresEnabled: false,
  dresChallengeType: 'KIS',
  dresEvaluationIdByChallenge: {
    KIS: '',
    AVS: '',
    'Q&A': ''
  },
  dresSubmitServer: '',
  dresUsername: '',
  dresPassword: '',
  dresMemberId: '',
  autoTranslateQueries: true,
  showAutoTranslateToggle: true,
  temporalWindowSeconds: 57600,
  videoPlayerModalMode: 'profile',
  imageModalScale: 160,
  slideshowModalScale: 160,
  qaStreamPanelHeight: 288,
  modelSelectionPerStepEnabled: true,
  defaultTextModel: 'openclip_clip_vit_b_32',
  defaultImageModel: 'dinov2_base',
  runtimeSettingsDefaultsVersion: ''
});

// Utility functions
export function createPersistentStore(key, initialValue) {
  return new PersistentStore(key, initialValue);
}

export function createPersistentSet(key) {
  return new PersistentSet(key);
}
