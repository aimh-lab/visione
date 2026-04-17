import { get, writable } from 'svelte/store';

const STORAGE_KEY = 'visione_query_templates';

function createTemplatesStore() {
  const safeLoad = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const persist = (templates) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // ignore persistence errors to avoid breaking UX
    }
  };

  const stored = safeLoad();
  
  const { subscribe, set, update } = writable(stored);
  
  return {
    subscribe,
    
    // Add new template
    add: (name, queries) => {
      let result = { status: 'skipped', name: '' };

      update(templates => {
        const normalizedName = String(name || '').trim();
        const normalizedQueries = Array.isArray(queries)
          ? queries.map(q => String(q || '').trim()).filter(Boolean)
          : [];

        if (normalizedQueries.length === 0) {
          result = { status: 'skipped', name: '' };
          return templates;
        }

        const fallbackName = normalizedQueries[0]?.slice(0, 40) || 'Untitled template';
        const finalName = normalizedName || fallbackName;

        const querySignature = normalizedQueries.join('||');
        const existingIndex = templates.findIndex((template) => {
          const existingName = String(template?.name || '').trim().toLowerCase();
          const existingQueries = Array.isArray(template?.queries)
            ? template.queries.map((q) => String(q || '').trim()).filter(Boolean)
            : [];
          const existingSignature = existingQueries.join('||');
          return existingName === finalName.toLowerCase() || existingSignature === querySignature;
        });

        if (existingIndex >= 0) {
          const existing = templates[existingIndex];
          const updatedTemplate = {
            ...existing,
            name: finalName,
            queries: [...normalizedQueries],
            updatedAt: new Date().toISOString()
          };
          const updated = [...templates];
          updated.splice(existingIndex, 1);
          const next = [updatedTemplate, ...updated];
          persist(next);
          result = { status: 'updated', name: finalName };
          return next;
        }

        const newTemplate = {
          id: Date.now(),
          name: finalName,
          queries: [...normalizedQueries],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const updated = [...templates, newTemplate];
        persist(updated);
        result = { status: 'created', name: finalName };
        return updated;
      });

      return result;
    },
    
    // Delete template
    delete: (id) => {
      update(templates => {
        const updated = templates.filter(t => t.id !== id);
        persist(updated);
        return updated;
      });
    },
    
    // Load template
    load: (id) => {
      const templates = get({ subscribe });
      return Promise.resolve(templates.find(t => t.id === id));
    },
    
    // Rename
    rename: (id, newName) => {
      update(templates => {
        const safeName = String(newName || '').trim();
        if (!safeName) return templates;
        const updated = templates.map(t => 
          t.id === id ? { ...t, name: safeName, updatedAt: new Date().toISOString() } : t
        );
        persist(updated);
        return updated;
      });
    },
    
    // Reset (clear all)
    clear: () => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore remove errors
        }
      }
      set([]);
    }
  };
}

export const queryTemplates = createTemplatesStore();
