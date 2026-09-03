import { writable } from 'svelte/store';
import { safeGetItem, safeSetItem } from './persistentState.js';

const STORAGE_KEY = 'visione_tabs_position';

function createTabsPositionStore() {
  const storedPos = safeGetItem(STORAGE_KEY, 'top');

  const { subscribe, set } = writable(storedPos || 'top');

  return {
    subscribe,
    set: (value) => {
      safeSetItem(STORAGE_KEY, value);
      set(value);
    }
  };
}

export const tabsPosition = createTabsPositionStore();
