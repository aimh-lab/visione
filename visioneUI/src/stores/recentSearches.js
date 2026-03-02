import { writable, get as getStoreValue } from 'svelte/store';

const STORAGE_KEY = 'visione_recent_searches';
const MAX_RECENT = 10;

/** Persist only lightweight metadata (strip heavy result sets). */
function persistToStorage(entries) {
  if (typeof window === 'undefined') return;
  try {
    const lightweight = entries.map(({ results, ...meta }) => meta);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
  } catch {
    try {
      const reduced = entries.slice(0, 5).map(({ results, ...meta }) => meta);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
    } catch {
      // give up
    }
  }
}

function createRecentSearchesStore() {
  const loadFromStorage = () => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  };
  
  const { subscribe, update, set } = writable(loadFromStorage());

  return {
    subscribe,
    
    add: (query, resultCount, searchResultSet = null, textareas = null) => {
      update(searches => {
        const filtered = searches.filter(s => s.query !== query);
        
        const newSearch = {
          query,
          resultCount,
          timestamp: Date.now(),
          results: searchResultSet,  // kept in memory only
          textareas
        };
        
        const updated = [newSearch, ...filtered].slice(0, MAX_RECENT);
        persistToStorage(updated);
        return updated;
      });
    },
    
    remove: (query) => {
      update(searches => {
        const updated = searches.filter(s => s.query !== query);
        persistToStorage(updated);
        return updated;
      });
    },
    
    clear: () => {
      set([]);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore remove errors
        }
      }
    },
    
    /** Read from the in-memory Svelte store (not localStorage). */
    find: (query) => {
      const searches = getStoreValue({ subscribe });
      return searches.find(s => s.query === query);
    }
  };
}

export const recentSearches = createRecentSearchesStore();
