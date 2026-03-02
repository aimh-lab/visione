// Shared tab configuration — single source of truth for tab identifiers, labels, and icons.

/** @typedef {'View1' | 'View2' | 'Similarity'} LayoutTab */

/**
 * @type {Record<LayoutTab, { label: string, icon: string }>}
 */
export const tabConfig = {
  View1: {
    label: 'Search',
    icon: `<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>`
  },
  View2: {
    label: 'Video Summary',
    icon: `<path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>`
  },
  Similarity: {
    label: 'Image Similarity',
    icon: `<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>`
  }
};

/** @param {string} view */
export const getTabConfig = (view) => tabConfig[view] || { label: view, icon: null };

/**
 * Map of tab key → human-readable label (convenience accessor).
 * @type {Record<string, string>}
 */
export const tabLabels = Object.fromEntries(
  Object.entries(tabConfig).map(([key, cfg]) => [key, cfg.label])
);
