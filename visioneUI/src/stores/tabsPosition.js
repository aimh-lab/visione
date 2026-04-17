import { writable } from 'svelte/store';

const STORAGE_KEY = 'visione_tabs_position';

function createTabsPositionStore() {
  // Load from localStorage
  const storedPos = typeof window !== 'undefined' 
    ? localStorage.getItem(STORAGE_KEY) 
    : null;
  
  const { subscribe, set } = writable(storedPos || 'top');
  
  return {
    subscribe,
    set: (value) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value);
      }
      set(value);
    }
  };
}

export const tabsPosition = createTabsPositionStore();
