import { writable } from 'svelte/store';

const STORAGE_KEY = 'visione_query_templates';

function createTemplatesStore() {
  // Carica da localStorage
  const stored = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    : [];
  
  const { subscribe, set, update } = writable(stored);
  
  return {
    subscribe,
    
    // Aggiungi nuovo template
    add: (name, queries) => {
      update(templates => {
        const newTemplate = {
          id: Date.now(),
          name,
          queries,
          createdAt: new Date().toISOString()
        };
        const updated = [...templates, newTemplate];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    
    // Elimina template
    delete: (id) => {
      update(templates => {
        const updated = templates.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    
    // Carica template
    load: (id) => {
      return new Promise(resolve => {
        subscribe(templates => {
          const template = templates.find(t => t.id === id);
          resolve(template);
        });
      });
    },
    
    // Rinomina
    rename: (id, newName) => {
      update(templates => {
        const updated = templates.map(t => 
          t.id === id ? { ...t, name: newName } : t
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    
    // Reset (cancella tutto)
    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
      set([]);
    }
  };
}

export const queryTemplates = createTemplatesStore();
