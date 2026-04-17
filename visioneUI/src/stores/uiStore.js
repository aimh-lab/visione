import { writable } from 'svelte/store';
import { appSettingsStore } from './persistentState.js';

const DEFAULT = {
  // Runtime UI (NON persistente)
  layoutTab: 'View1',          // 'View1' | 'View2' | 'Similarity'

  // Persistente
  theme: 'default',            // 'default' | 'dark' | 'light'
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
  cacheEnabled: true,
  justifyResultRows: false,
  videoBadgeOrientation: 'vertical',
  virtualizationEnabled: true,
  virtualizationThreshold: 40,

  dresEnabled: false,
  dresChallengeType: 'KIS',
  dresSubmitServer: '',
  dresUsername: '',
  dresPassword: '',
  dresMemberId: '',
  autoTranslateQueries: true,
  showAutoTranslateToggle: true,
  temporalWindowSeconds: 50,
  modelSelectionPerStepEnabled: true,
  defaultTextModel: 'openclip_clip_vit_b_32',
  defaultImageModel: 'dinov2_base'
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
        theme: s.theme ?? u.theme,
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
        cacheEnabled: s.cacheEnabled ?? u.cacheEnabled,
        justifyResultRows: s.justifyResultRows ?? u.justifyResultRows,
        videoBadgeOrientation: ['horizontal', 'vertical'].includes(s.videoBadgeOrientation) ? s.videoBadgeOrientation : u.videoBadgeOrientation,
        virtualizationEnabled: s.virtualizationEnabled ?? u.virtualizationEnabled,
        virtualizationThreshold: s.virtualizationThreshold ?? u.virtualizationThreshold,

        dresEnabled: s.dresEnabled ?? u.dresEnabled,
        dresChallengeType: ['KIS', 'AVS', 'Q&A'].includes(s.dresChallengeType) ? s.dresChallengeType : u.dresChallengeType,
        dresSubmitServer: s.dresSubmitServer ?? u.dresSubmitServer,
        dresUsername: s.dresUsername ?? u.dresUsername,
        dresPassword: s.dresPassword ?? u.dresPassword,
        dresMemberId: s.dresMemberId ?? u.dresMemberId,
        autoTranslateQueries: s.autoTranslateQueries ?? u.autoTranslateQueries,
        showAutoTranslateToggle: s.showAutoTranslateToggle ?? u.showAutoTranslateToggle,
        temporalWindowSeconds: Number.isFinite(Number(s.temporalWindowSeconds))
          ? Math.min(99999, Math.max(1, Number(s.temporalWindowSeconds)))
          : u.temporalWindowSeconds,
        modelSelectionPerStepEnabled: s.modelSelectionPerStepEnabled ?? u.modelSelectionPerStepEnabled,
        defaultTextModel: String(s.defaultTextModel || '').trim() || u.defaultTextModel,
        defaultImageModel: String(s.defaultImageModel || '').trim() || u.defaultImageModel
      }));
    },

    // usa questa per il tasto "reset app" (UI + persistenza)
    resetUI() {
      set(DEFAULT);
      persist({
        theme: DEFAULT.theme,
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
        cacheEnabled: DEFAULT.cacheEnabled,
        justifyResultRows: DEFAULT.justifyResultRows,
        videoBadgeOrientation: DEFAULT.videoBadgeOrientation,
        virtualizationEnabled: DEFAULT.virtualizationEnabled,
        virtualizationThreshold: DEFAULT.virtualizationThreshold,
        dresEnabled: DEFAULT.dresEnabled,
        dresChallengeType: DEFAULT.dresChallengeType,
        dresSubmitServer: DEFAULT.dresSubmitServer,
        dresUsername: DEFAULT.dresUsername,
        dresPassword: DEFAULT.dresPassword,
        dresMemberId: DEFAULT.dresMemberId,
        autoTranslateQueries: DEFAULT.autoTranslateQueries,
        showAutoTranslateToggle: DEFAULT.showAutoTranslateToggle,
        temporalWindowSeconds: DEFAULT.temporalWindowSeconds,
        modelSelectionPerStepEnabled: DEFAULT.modelSelectionPerStepEnabled,
        defaultTextModel: DEFAULT.defaultTextModel,
        defaultImageModel: DEFAULT.defaultImageModel
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

    setTheme(theme) {
      const safe = ['default', 'dark', 'light'].includes(theme) ? theme : 'default';
      update(u => ({ ...u, theme: safe }));
      persist({ theme: safe });
    },

    setDresChallengeType(dresChallengeType) {
      const safe = ['KIS', 'AVS', 'Q&A'].includes(dresChallengeType) ? dresChallengeType : 'KIS';
      update((u) => ({ ...u, dresChallengeType: safe }));
      persist({ dresChallengeType: safe });
    },

    setAutoTranslateQueries(enabled) {
      const safe = !!enabled;
      update((u) => ({ ...u, autoTranslateQueries: safe }));
      persist({ autoTranslateQueries: safe });
    },

    setKeyframeSize(keyframeSize) {
      const safe = Math.min(400, Math.max(80, Number(keyframeSize) || DEFAULT.keyframeSize));
      update(u => ({ ...u, keyframeSize: safe }));
      persist({ keyframeSize: safe });
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

    applySettings({ theme, keyframeSize, resultsPerRow, resultsAutoFit, cacheEnabled, justifyResultRows, videoBadgeOrientation, virtualizationEnabled, virtualizationThreshold, dresEnabled, dresChallengeType, dresSubmitServer, dresUsername, dresPassword, dresMemberId, autoTranslateQueries, showAutoTranslateToggle, temporalWindowSeconds, modelSelectionPerStepEnabled, defaultTextModel, defaultImageModel }) {
      const safeTheme = ['default', 'dark', 'light'].includes(theme) ? theme : 'default';
      const safeVideoBadgeOrientation = ['horizontal', 'vertical'].includes(videoBadgeOrientation) ? videoBadgeOrientation : 'vertical';
      const safeChallengeType = ['KIS', 'AVS', 'Q&A'].includes(dresChallengeType) ? dresChallengeType : 'KIS';
      const safeTemporalWindowSeconds = Math.min(99999, Math.max(1, Number(temporalWindowSeconds) || DEFAULT.temporalWindowSeconds));
      const safeDefaultTextModel = String(defaultTextModel || '').trim() || DEFAULT.defaultTextModel;
      const safeDefaultImageModel = String(defaultImageModel || '').trim() || DEFAULT.defaultImageModel;
      update(u => ({
        ...u,
        theme: safeTheme,
        keyframeSize,
        resultsPerRow,
        resultsAutoFit,
        cacheEnabled: !!cacheEnabled,
        justifyResultRows: !!justifyResultRows,
        videoBadgeOrientation: safeVideoBadgeOrientation,
        virtualizationEnabled,
        virtualizationThreshold,
        dresEnabled: !!dresEnabled,
        dresChallengeType: safeChallengeType,
        dresSubmitServer: (dresSubmitServer ?? '').trim(),
        dresUsername: (dresUsername ?? '').trim(),
        dresPassword: dresPassword ?? '',
        dresMemberId: (dresMemberId ?? '').trim(),
        autoTranslateQueries: !!autoTranslateQueries,
        showAutoTranslateToggle: !!showAutoTranslateToggle,
        temporalWindowSeconds: safeTemporalWindowSeconds,
        modelSelectionPerStepEnabled: !!modelSelectionPerStepEnabled,
        defaultTextModel: safeDefaultTextModel,
        defaultImageModel: safeDefaultImageModel
      }));
      persist({
        theme: safeTheme,
        keyframeSize,
        resultsPerRow,
        resultsAutoFit,
        cacheEnabled: !!cacheEnabled,
        justifyResultRows: !!justifyResultRows,
        videoBadgeOrientation: safeVideoBadgeOrientation,
        virtualizationEnabled,
        virtualizationThreshold,
        dresEnabled: !!dresEnabled,
        dresChallengeType: safeChallengeType,
        dresSubmitServer: (dresSubmitServer ?? '').trim(),
        dresUsername: (dresUsername ?? '').trim(),
        dresPassword: dresPassword ?? '',
        dresMemberId: (dresMemberId ?? '').trim(),
        autoTranslateQueries: !!autoTranslateQueries,
        showAutoTranslateToggle: !!showAutoTranslateToggle,
        temporalWindowSeconds: safeTemporalWindowSeconds,
        modelSelectionPerStepEnabled: !!modelSelectionPerStepEnabled,
        defaultTextModel: safeDefaultTextModel,
        defaultImageModel: safeDefaultImageModel
      });
    }
  };

  return { subscribe, set, update, actions };
}

export const uiStore = createUIStore();
