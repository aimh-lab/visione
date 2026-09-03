import { writable, get as getStoreValue } from 'svelte/store';
import { safeLoadJSON, safeRemoveItem } from './persistentState.js';

const STORAGE_KEY = 'visione_recent_searches';
const MAX_RECENT = 30;
// Only the most recent entries keep their full in-memory `results` payload
// (used as a client-side search cache by searchController's find()); beyond
// that, entries keep their lightweight metadata (still shown in the Recent
// Searches UI) but drop `results`, so repeated searches don't accumulate up
// to MAX_RECENT full result sets — each potentially thousands of frames —
// in memory for the whole session.
const MAX_CACHED_RESULTS = 5;

function normalizeSimilarityPreview(preview) {
  if (!preview || typeof preview !== 'object') return null;

  const imgIdRaw = String(preview.imgId || '').trim();
  const nameRaw = String(preview.name || imgIdRaw || 'Similarity').trim();
  let urlRaw = String(preview.url || '').trim();

  // Keep storage lightweight: do not persist data URLs or excessively long URLs.
  if (urlRaw.startsWith('data:') || urlRaw.length > 2048) {
    urlRaw = '';
  }

  if (!imgIdRaw && !urlRaw) return null;

  return {
    imgId: imgIdRaw || null,
    url: urlRaw || null,
    name: nameRaw || 'Similarity'
  };
}

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
  const loadFromStorage = () => safeLoadJSON(STORAGE_KEY, []);

  const { subscribe, update, set } = writable(loadFromStorage());

  return {
    subscribe,
    
    add: (query, resultCount, searchResultSet = null, textareas = null, similarityPreview = null) => {
      update(searches => {
        const filtered = searches.filter(s => s.query !== query);
        
        const newSearch = {
          query,
          resultCount,
          timestamp: Date.now(),
          results: searchResultSet,  // kept in memory only
          textareas,
          similarityPreview: normalizeSimilarityPreview(similarityPreview)
        };
        
        const combined = [newSearch, ...filtered].slice(0, MAX_RECENT);
        const updated = combined.map((entry, index) =>
          (index < MAX_CACHED_RESULTS || !entry.results) ? entry : { ...entry, results: null }
        );
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
      safeRemoveItem(STORAGE_KEY);
    },
    
    /** Read from the in-memory Svelte store (not localStorage). */
    find: (query) => {
      const searches = getStoreValue({ subscribe });
      return searches.find(s => s.query === query);
    }
  };
}

export const recentSearches = createRecentSearchesStore();
