import { writable } from 'svelte/store';
import { appSettingsStore } from './persistentState.js';

const DEFAULT = {
  // Runtime UI (NON persistente)
  layoutTab: 'View1',          // 'View1' | 'View2' | 'Similarity'
  
  scrollPositions: {
    View1: 0,
    View2: 0,
    Similarity: 0
  },

  // Persistente
  viewMode: 'byvideo',
  contentScale: 1,

  isSidebarOpen: true,
  isSidebarRightOpen: false,
  sidebarLeftWidth: 18,
  sidebarRightWidth: 18,
  sidebarRightTab: 'RF',       // 'RF' | 'Submitted'

  keyframeSize: 130,
  resultsPerRow: 8,
  resultsAutoFit: true,
  virtualizationEnabled: true,
  virtualizationThreshold: 40
};

function clampSidebarWidthVw(value, fallback = 18) {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(12, Math.min(40, numeric));
}

function normalizeSidebarWidth(value, fallback = 18) {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return fallback;

  if (numeric > 100) {
    if (typeof window !== 'undefined' && window.innerWidth > 0) {
      const vw = (numeric / window.innerWidth) * 100;
      return clampSidebarWidthVw(vw, fallback);
    }
    return fallback;
  }

  return clampSidebarWidthVw(numeric, fallback);
}

function createUIStore() {
  const { subscribe, update, set } = writable(DEFAULT);

  const persist = (patch) => {
    appSettingsStore.update(s => ({ ...s, ...patch }));
  };

  const actions = {
    hydrateFromSettings() {
      const s = appSettingsStore.get() || {};
      update(u => ({
        ...u,
        // layoutTab volutamente escluso
        viewMode: s.viewMode ?? u.viewMode,
        contentScale: s.contentScale ?? u.contentScale,

        isSidebarOpen: s.isSidebarOpen ?? u.isSidebarOpen,
        isSidebarRightOpen: s.isSidebarRightOpen ?? u.isSidebarRightOpen,
        sidebarLeftWidth: normalizeSidebarWidth(s.sidebarLeftWidth, u.sidebarLeftWidth),
        sidebarRightWidth: normalizeSidebarWidth(s.sidebarRightWidth, u.sidebarRightWidth),
        sidebarRightTab: s.sidebarRightTab ?? u.sidebarRightTab,

        keyframeSize: s.keyframeSize ?? u.keyframeSize,
        resultsPerRow: s.resultsPerRow ?? u.resultsPerRow,
        resultsAutoFit: s.resultsAutoFit ?? u.resultsAutoFit,
        virtualizationEnabled: s.virtualizationEnabled ?? u.virtualizationEnabled,
        virtualizationThreshold: s.virtualizationThreshold ?? u.virtualizationThreshold
      }));
    },

    // usa questa per il tasto "reset app" (UI + persistenza)
    resetUI() {
      set(DEFAULT);
      persist({
        viewMode: DEFAULT.viewMode,
        contentScale: DEFAULT.contentScale,
        isSidebarOpen: DEFAULT.isSidebarOpen,
        isSidebarRightOpen: DEFAULT.isSidebarRightOpen,
        sidebarLeftWidth: DEFAULT.sidebarLeftWidth,
        sidebarRightWidth: DEFAULT.sidebarRightWidth,
        sidebarRightTab: DEFAULT.sidebarRightTab,
        keyframeSize: DEFAULT.keyframeSize,
        resultsPerRow: DEFAULT.resultsPerRow,
        resultsAutoFit: DEFAULT.resultsAutoFit,
        virtualizationEnabled: DEFAULT.virtualizationEnabled,
        virtualizationThreshold: DEFAULT.virtualizationThreshold
      });
    },

    // ---- LayoutTab (runtime only)
    setLayoutTab(layoutTab) {
      update(u => ({ ...u, layoutTab }));
    },

    // ---- Persistenti (con persist)
    setViewMode(viewMode) {
      update(u => ({ ...u, viewMode }));
      persist({ viewMode });
    },

    setContentScale(contentScale) {
      update(u => ({ ...u, contentScale }));
      persist({ contentScale });
    },

    toggleSidebar() {
      update(u => {
        const isSidebarOpen = !u.isSidebarOpen;
        persist({ isSidebarOpen });
        return { ...u, isSidebarOpen };
      });
    },

    toggleRightSidebar() {
      update(u => {
        const isSidebarRightOpen = !u.isSidebarRightOpen;
        persist({ isSidebarRightOpen });
        return { ...u, isSidebarRightOpen };
      });
    },

    setSidebarLeftWidth(sidebarLeftWidth) {
      const normalized = normalizeSidebarWidth(sidebarLeftWidth, DEFAULT.sidebarLeftWidth);
      update(u => ({ ...u, sidebarLeftWidth: normalized }));
      persist({ sidebarLeftWidth: normalized });
    },

    setSidebarRightWidth(sidebarRightWidth) {
      const normalized = normalizeSidebarWidth(sidebarRightWidth, DEFAULT.sidebarRightWidth);
      update(u => ({ ...u, sidebarRightWidth: normalized }));
      persist({ sidebarRightWidth: normalized });
    },

    focusRightTab(tab) {
      update(u => ({ ...u, sidebarRightTab: tab, isSidebarRightOpen: true }));
      persist({ sidebarRightTab: tab, isSidebarRightOpen: true });
    },

    // ---- Scroll positions (runtime only)
    setScrollTop(tab, scrollTop) {
      update(u => {
        const next = Number.isFinite(scrollTop) ? scrollTop : 0;
        return {
          ...u,
          scrollPositions: {
            ...(u.scrollPositions || {}),
            [tab]: next
          }
        };
      });
    },

    resetScrollPositions() {
      update(u => ({
        ...u,
        scrollPositions: { View1: 0, View2: 0, Similarity: 0 }
      }));
    },


    applySettings({ keyframeSize, resultsPerRow, resultsAutoFit, virtualizationEnabled, virtualizationThreshold }) {
      update(u => ({
        ...u,
        keyframeSize,
        resultsPerRow,
        resultsAutoFit,
        virtualizationEnabled,
        virtualizationThreshold
      }));
      persist({ keyframeSize, resultsPerRow, resultsAutoFit, virtualizationEnabled, virtualizationThreshold });
    }
  };

  return { subscribe, set, update, actions };
}

export const uiStore = createUIStore();
