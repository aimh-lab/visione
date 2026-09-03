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
    label: 'Context View',
    icon: `<g opacity="0.6"><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="10" y="3" width="4" height="4" rx="1"/><rect x="17" y="3" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="3" y="17" width="4" height="4" rx="1"/><rect x="10" y="17" width="4" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/></g><rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1.2" fill="white" stroke="none"/>`
  },
  Similarity: {
    label: 'Image Similarity',
    icon: `<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>`
  }
};

/** @param {string} view */
export const getTabConfig = (view) => tabConfig[view] || { label: view, icon: null };
