import { writable } from 'svelte/store';

const STORAGE_KEY = 'visione_recent_searches';
const MAX_RECENT = 10;

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
    
    // ✅ MODIFICATO: salva anche textareas
    add: (query, resultCount, searchResultSet = null, textareas = null) => {
      update(searches => {
        const filtered = searches.filter(s => s.query !== query);
        
        const newSearch = {
          query,
          resultCount,
          timestamp: Date.now(),
          results: searchResultSet,
          textareas // ✅ AGGIUNGI: salva anche textareas
        };
        
        const updated = [newSearch, ...filtered].slice(0, MAX_RECENT);
        
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch (error) {
            console.warn('⚠️ localStorage quota exceeded, clearing old searches');
            const reduced = updated.slice(0, 5);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
            return reduced;
          }
        }
        
        return updated;
      });
    },
    
    remove: (query) => {
      update(searches => {
        const updated = searches.filter(s => s.query !== query);
        
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore write errors
          }
        }
        
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
    
    find: (query) => {
      const searches = loadFromStorage();
      return searches.find(s => s.query === query);
    }
  };
}

export const recentSearches = createRecentSearchesStore();
