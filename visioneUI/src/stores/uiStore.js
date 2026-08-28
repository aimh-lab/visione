import { writable } from 'svelte/store';
import { appSettingsStore } from './persistentState.js';
import { APP_SETTINGS_DEFAULTS } from '../config/appDefaults.js';
import { DRES_CHALLENGE_TYPES } from '../config/dresConfig.js';
import { MIN_QUERY_RESULT_K, MAX_QUERY_RESULT_K, MIN_TEMPORAL_WINDOW_SECONDS, MAX_TEMPORAL_WINDOW_SECONDS } from '../config/searchLimits.js';

const DEFAULT = {
  // Runtime UI (non-persistent)
  layoutTab: 'View1',          // 'View1' | 'View2' | 'Similarity'
  sidebarRightTab: 'RF',       // 'RF' | 'Submitted'

  // Persistent (single source of truth: src/config/appDefaults.js)
  ...APP_SETTINGS_DEFAULTS
};

function normalizeModalSizePx(value, fallback = 160) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  return Math.max(80, Math.round(numeric));
}

function clampSidebarWidthVw(value, fallback = 18) {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(12, Math.min(55, numeric));
}

function normalizeQaStreamPanelHeight(value, fallback = 288) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(160, Math.min(720, Math.round(numeric)));
}

function normalizeQueryResultK(value, fallback = 7200) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(MAX_QUERY_RESULT_K, Math.max(MIN_QUERY_RESULT_K, Math.floor(numeric)));
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

function normalizeTupleIndicatorMode(value, fallback = 'badge+bar') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'badge' || raw === 'none' || raw === 'badge+bar') return raw;
  return fallback;
}

function normalizeResultsetBadgeLabelMode(value, fallback = 'both') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'id' || raw === 'date' || raw === 'both') return raw;
  return fallback;
}

function normalizeTimeBadgeTimezoneOverride(value, fallback = 'profile') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'profile' || raw === 'utc' || raw === 'local') return raw;
  return fallback;
}

function normalizeDataserverHost(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '') || fallback;
}

function normalizeEvaluationIdByChallenge(value, fallback = DEFAULT.dresEvaluationIdByChallenge) {
  const source = value && typeof value === 'object' ? value : {};

  const firstFromArray = (entry) => {
    if (!Array.isArray(entry)) return '';
    for (const candidate of entry) {
      const id = String(candidate ?? '').trim();
      if (id) return id;
    }
    return '';
  };

  const normalizeEntry = (entry, fallbackEntry = '') => {
    if (Array.isArray(entry)) {
      const fromArray = firstFromArray(entry);
      if (fromArray) return fromArray;
      return String(fallbackEntry ?? '').trim();
    }

    const id = String(entry ?? '').trim();
    if (id) return id;
    return String(fallbackEntry ?? '').trim();
  };

  return {
    KIS: normalizeEntry(source.KIS, fallback.KIS),
    AVS: normalizeEntry(source.AVS, fallback.AVS),
    'Q&A': normalizeEntry(source['Q&A'], fallback['Q&A'])
  };
}

function getFirstSelectedEvaluationId(value) {
  const map = normalizeEvaluationIdByChallenge(value, DEFAULT.dresEvaluationIdByChallenge);
  for (const key of DRES_CHALLENGE_TYPES) {
    const id = String(map[key] || '').trim();
    if (id) return id;
  }
  return '';
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
        // layoutTab intentionally excluded
        theme: s.theme ?? u.theme,
        viewMode: s.viewMode ?? u.viewMode,
        sortMode: s.sortMode ?? u.sortMode,
        contentScale: s.contentScale ?? u.contentScale,

        isSidebarOpen: s.isSidebarOpen ?? u.isSidebarOpen,
        isSidebarRightOpen: s.isSidebarRightOpen ?? u.isSidebarRightOpen,
        sidebarLeftWidth: normalizeSidebarWidth(s.sidebarLeftWidth, u.sidebarLeftWidth),
        sidebarRightWidth: normalizeSidebarWidth(s.sidebarRightWidth, u.sidebarRightWidth),
        sidebarRightTab: s.sidebarRightTab ?? u.sidebarRightTab,

        keyframeSize: s.keyframeSize ?? u.keyframeSize,
        contextKeyframeSize: s.contextKeyframeSize ?? s.keyframeSize ?? u.contextKeyframeSize,
        resultsPerGroup: (s.resultsPerGroup ?? s.resultsPerRow) ?? u.resultsPerGroup,
        queryResultK: normalizeQueryResultK(s.queryResultK, u.queryResultK),
        resultsAutoFit: true,
        cacheEnabled: s.cacheEnabled ?? u.cacheEnabled,
        dedupeResults: s.dedupeResults ?? u.dedupeResults,
        apiServicesHostOverrideEnabled: s.apiServicesHostOverrideEnabled ?? !!String(s.apiServicesHost || '').trim(),
        apiServicesHost: normalizeDataserverHost(s.apiServicesHost, u.apiServicesHost),
        dataserverHostOverrideEnabled: s.dataserverHostOverrideEnabled ?? !!String(s.dataserverHost || '').trim(),
        dataserverHost: normalizeDataserverHost(s.dataserverHost, u.dataserverHost),
        justifyResultRows: s.justifyResultRows ?? u.justifyResultRows,
        tupleIndicatorMode: normalizeTupleIndicatorMode(s.tupleIndicatorMode, u.tupleIndicatorMode),
        videoBadgeOrientation: ['horizontal', 'vertical'].includes(s.videoBadgeOrientation) ? s.videoBadgeOrientation : u.videoBadgeOrientation,
        resultsetBadgeLabelMode: normalizeResultsetBadgeLabelMode(s.resultsetBadgeLabelMode, u.resultsetBadgeLabelMode),
        showLocalTimeInTitles: s.showLocalTimeInTitles ?? u.showLocalTimeInTitles,
        timeBadgeTimezoneOverride: normalizeTimeBadgeTimezoneOverride(s.timeBadgeTimezoneOverride, u.timeBadgeTimezoneOverride),
        virtualizationEnabled: s.virtualizationEnabled ?? u.virtualizationEnabled,
        virtualizationThreshold: s.virtualizationThreshold ?? u.virtualizationThreshold,

        dresEnabled: s.dresEnabled ?? u.dresEnabled,
        dresChallengeType: DRES_CHALLENGE_TYPES.includes(s.dresChallengeType) ? s.dresChallengeType : u.dresChallengeType,
        dresEvaluationIdByChallenge: normalizeEvaluationIdByChallenge(
          s.dresEvaluationIdByChallenge ?? s.dresEvaluationIdsByChallenge,
          u.dresEvaluationIdByChallenge
        ),
        dresSubmitServer: s.dresSubmitServer ?? u.dresSubmitServer,
        dresUsername: s.dresUsername ?? u.dresUsername,
        dresPassword: s.dresPassword ?? u.dresPassword,
        dresMemberId: s.dresMemberId ?? u.dresMemberId,
        autoTranslateQueries: s.autoTranslateQueries ?? u.autoTranslateQueries,
        showAutoTranslateToggle: s.showAutoTranslateToggle ?? u.showAutoTranslateToggle,
        temporalWindowSeconds: Number.isFinite(Number(s.temporalWindowSeconds))
          ? Math.min(MAX_TEMPORAL_WINDOW_SECONDS, Math.max(MIN_TEMPORAL_WINDOW_SECONDS, Number(s.temporalWindowSeconds)))
          : u.temporalWindowSeconds,
        videoPlayerModalMode: ['profile', 'video', 'slideshow'].includes(s.videoPlayerModalMode)
          ? s.videoPlayerModalMode
          : u.videoPlayerModalMode,
        imageModalScale: normalizeModalSizePx(s.imageModalScale, u.imageModalScale),
        slideshowModalScale: normalizeModalSizePx(s.slideshowModalScale, u.slideshowModalScale),
        qaStreamPanelHeight: normalizeQaStreamPanelHeight(s.qaStreamPanelHeight, u.qaStreamPanelHeight),
        modelSelectionPerStepEnabled: s.modelSelectionPerStepEnabled ?? u.modelSelectionPerStepEnabled,
        defaultTextModel: String(s.defaultTextModel || '').trim() || u.defaultTextModel,
        defaultImageModel: String(s.defaultImageModel || '').trim() || u.defaultImageModel,
        runtimeSettingsDefaultsVersion: String(s.runtimeSettingsDefaultsVersion || '').trim()
      }));
    },

    applyRuntimeSettingsDefaults(defaults = {}) {
      const version = String(defaults?.version || '').trim();
      if (!version) return;

      let nextState = null;
      update((u) => {
        if (String(u.runtimeSettingsDefaultsVersion || '').trim() === version) return u;

        const nextQueryResultK = Number.isFinite(Number(defaults?.queryResultK))
          && !Number.isFinite(Number(u.queryResultK))
            ? normalizeQueryResultK(defaults.queryResultK, u.queryResultK || DEFAULT.queryResultK)
            : u.queryResultK;
        const nextTemporalWindowSeconds = Number.isFinite(Number(defaults?.temporalWindowSeconds))
          && !Number.isFinite(Number(u.temporalWindowSeconds))
            ? Math.min(MAX_TEMPORAL_WINDOW_SECONDS, Math.max(MIN_TEMPORAL_WINDOW_SECONDS, Number(defaults.temporalWindowSeconds)))
            : u.temporalWindowSeconds;

        nextState = {
          ...u,
          queryResultK: nextQueryResultK,
          temporalWindowSeconds: nextTemporalWindowSeconds,
          runtimeSettingsDefaultsVersion: version
        };
        return nextState;
      });

      if (nextState) {
        persist({
          queryResultK: nextState.queryResultK,
          temporalWindowSeconds: nextState.temporalWindowSeconds,
          runtimeSettingsDefaultsVersion: nextState.runtimeSettingsDefaultsVersion
        });
      }
    },

    // Use for the "reset app" action (UI + persistence)
    resetUI() {
      set(DEFAULT);
      persist({
        theme: DEFAULT.theme,
        viewMode: DEFAULT.viewMode,
        sortMode: DEFAULT.sortMode,
        contentScale: DEFAULT.contentScale,
        isSidebarOpen: DEFAULT.isSidebarOpen,
        isSidebarRightOpen: DEFAULT.isSidebarRightOpen,
        sidebarLeftWidth: DEFAULT.sidebarLeftWidth,
        sidebarRightWidth: DEFAULT.sidebarRightWidth,
        sidebarRightTab: DEFAULT.sidebarRightTab,
        keyframeSize: DEFAULT.keyframeSize,
        contextKeyframeSize: DEFAULT.contextKeyframeSize,
        resultsPerGroup: DEFAULT.resultsPerGroup,
        queryResultK: DEFAULT.queryResultK,
        resultsAutoFit: DEFAULT.resultsAutoFit,
        cacheEnabled: DEFAULT.cacheEnabled,
        dedupeResults: DEFAULT.dedupeResults,
        apiServicesHostOverrideEnabled: DEFAULT.apiServicesHostOverrideEnabled,
        apiServicesHost: DEFAULT.apiServicesHost,
        dataserverHostOverrideEnabled: DEFAULT.dataserverHostOverrideEnabled,
        dataserverHost: DEFAULT.dataserverHost,
        justifyResultRows: DEFAULT.justifyResultRows,
        tupleIndicatorMode: DEFAULT.tupleIndicatorMode,
        videoBadgeOrientation: DEFAULT.videoBadgeOrientation,
        resultsetBadgeLabelMode: DEFAULT.resultsetBadgeLabelMode,
        showLocalTimeInTitles: DEFAULT.showLocalTimeInTitles,
        timeBadgeTimezoneOverride: DEFAULT.timeBadgeTimezoneOverride,
        virtualizationEnabled: DEFAULT.virtualizationEnabled,
        virtualizationThreshold: DEFAULT.virtualizationThreshold,
        dresEnabled: DEFAULT.dresEnabled,
        dresChallengeType: DEFAULT.dresChallengeType,
        dresEvaluationIdByChallenge: DEFAULT.dresEvaluationIdByChallenge,
        dresSubmitServer: DEFAULT.dresSubmitServer,
        dresUsername: DEFAULT.dresUsername,
        dresPassword: DEFAULT.dresPassword,
        dresMemberId: DEFAULT.dresMemberId,
        autoTranslateQueries: DEFAULT.autoTranslateQueries,
        showAutoTranslateToggle: DEFAULT.showAutoTranslateToggle,
        temporalWindowSeconds: DEFAULT.temporalWindowSeconds,
        videoPlayerModalMode: DEFAULT.videoPlayerModalMode,
        imageModalScale: DEFAULT.imageModalScale,
        slideshowModalScale: DEFAULT.slideshowModalScale,
        qaStreamPanelHeight: DEFAULT.qaStreamPanelHeight,
        modelSelectionPerStepEnabled: DEFAULT.modelSelectionPerStepEnabled,
        defaultTextModel: DEFAULT.defaultTextModel,
        defaultImageModel: DEFAULT.defaultImageModel,
        runtimeSettingsDefaultsVersion: DEFAULT.runtimeSettingsDefaultsVersion
      });
    },

    // ---- LayoutTab (runtime only)
    setLayoutTab(layoutTab) {
      update(u => ({ ...u, layoutTab }));
    },

    // ---- Persistent (with persist)
    setViewMode(viewMode) {
      update(u => ({ ...u, viewMode }));
      persist({ viewMode });
    },

    setSortMode(sortMode) {
      const raw = String(sortMode || '').trim().toLowerCase();
      const safe = raw === 'time' ? 'time_asc' : (['time_asc', 'time_desc'].includes(raw) ? raw : 'relevance');
      update(u => ({ ...u, sortMode: safe }));
      persist({ sortMode: safe });
    },

    setTheme(theme) {
      const safe = ['default', 'dark', 'light'].includes(theme) ? theme : 'default';
      update(u => ({ ...u, theme: safe }));
      persist({ theme: safe });
    },

    setDresChallengeType(dresChallengeType) {
      const safe = DRES_CHALLENGE_TYPES.includes(dresChallengeType) ? dresChallengeType : DRES_CHALLENGE_TYPES[0];
      update((u) => {
        const currentMap = normalizeEvaluationIdByChallenge(
          u.dresEvaluationIdByChallenge,
          DEFAULT.dresEvaluationIdByChallenge
        );
        const selectedEvaluationId = String(currentMap[u.dresChallengeType] || '').trim()
          || getFirstSelectedEvaluationId(currentMap);
        const nextMap = selectedEvaluationId
          ? { ...currentMap, [safe]: selectedEvaluationId }
          : currentMap;

        persist({
          dresChallengeType: safe,
          dresEvaluationIdByChallenge: nextMap
        });
        return {
          ...u,
          dresChallengeType: safe,
          dresEvaluationIdByChallenge: nextMap
        };
      });
    },

    setDresEvaluationId(challengeType, evaluationId) {
      const safeChallengeType = DRES_CHALLENGE_TYPES.includes(challengeType) ? challengeType : null;
      const safeEvaluationId = String(evaluationId ?? '').trim();
      if (!safeChallengeType) return;

      update((u) => {
        const normalized = normalizeEvaluationIdByChallenge(
          u.dresEvaluationIdByChallenge,
          DEFAULT.dresEvaluationIdByChallenge
        );
        const nextMap = {
          ...normalized,
          [safeChallengeType]: safeEvaluationId
        };

        persist({ dresEvaluationIdByChallenge: nextMap });
        return { ...u, dresEvaluationIdByChallenge: nextMap };
      });
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

    setContextKeyframeSize(contextKeyframeSize) {
      const safe = Math.min(400, Math.max(80, Number(contextKeyframeSize) || DEFAULT.contextKeyframeSize));
      update(u => ({ ...u, contextKeyframeSize: safe }));
      persist({ contextKeyframeSize: safe });
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

    applySettings(patch = {}) {
      let nextState = null;

      update((u) => {
        const safeTheme = ['default', 'dark', 'light'].includes(patch.theme) ? patch.theme : u.theme;
        const safeVideoBadgeOrientation = ['horizontal', 'vertical'].includes(patch.videoBadgeOrientation)
          ? patch.videoBadgeOrientation
          : u.videoBadgeOrientation;
        const safeTupleIndicatorMode = normalizeTupleIndicatorMode(patch.tupleIndicatorMode, u.tupleIndicatorMode);
        const safeResultsetBadgeLabelMode = normalizeResultsetBadgeLabelMode(patch.resultsetBadgeLabelMode, u.resultsetBadgeLabelMode);
        const safeApiServicesHostOverrideEnabled = patch.apiServicesHostOverrideEnabled == null
          ? u.apiServicesHostOverrideEnabled
          : !!patch.apiServicesHostOverrideEnabled;
        const safeApiServicesHost = patch.apiServicesHost == null
          ? u.apiServicesHost
          : normalizeDataserverHost(patch.apiServicesHost, u.apiServicesHost);
        const safeTimeBadgeTimezoneOverride = normalizeTimeBadgeTimezoneOverride(patch.timeBadgeTimezoneOverride, u.timeBadgeTimezoneOverride);
        const safeDataserverHostOverrideEnabled = patch.dataserverHostOverrideEnabled == null
          ? u.dataserverHostOverrideEnabled
          : !!patch.dataserverHostOverrideEnabled;
        const safeDataserverHost = patch.dataserverHost == null
          ? u.dataserverHost
          : normalizeDataserverHost(patch.dataserverHost, u.dataserverHost);
        const safeChallengeType = DRES_CHALLENGE_TYPES.includes(patch.dresChallengeType)
          ? patch.dresChallengeType
          : u.dresChallengeType;
        const patchEvaluationMap = patch.dresEvaluationIdByChallenge ?? patch.dresEvaluationIdsByChallenge;
        const safeEvaluationIdByChallenge = patchEvaluationMap == null
          ? normalizeEvaluationIdByChallenge(u.dresEvaluationIdByChallenge, DEFAULT.dresEvaluationIdByChallenge)
          : normalizeEvaluationIdByChallenge(patchEvaluationMap, u.dresEvaluationIdByChallenge);
        const safeTemporalWindowSeconds = patch.temporalWindowSeconds == null
          ? u.temporalWindowSeconds
          : Math.min(MAX_TEMPORAL_WINDOW_SECONDS, Math.max(MIN_TEMPORAL_WINDOW_SECONDS, Number(patch.temporalWindowSeconds) || u.temporalWindowSeconds || DEFAULT.temporalWindowSeconds));
        const safeQueryResultK = patch.queryResultK == null
          ? u.queryResultK
          : normalizeQueryResultK(patch.queryResultK, u.queryResultK || DEFAULT.queryResultK);
        const safeContextKeyframeSize = patch.contextKeyframeSize == null
          ? u.contextKeyframeSize
          : Math.min(400, Math.max(80, Number(patch.contextKeyframeSize) || u.contextKeyframeSize || DEFAULT.contextKeyframeSize));
        const safeVideoPlayerModalMode = ['profile', 'video', 'slideshow'].includes(patch.videoPlayerModalMode)
          ? patch.videoPlayerModalMode
          : u.videoPlayerModalMode;
        const safeImageModalScale = patch.imageModalScale == null
          ? u.imageModalScale
          : normalizeModalSizePx(patch.imageModalScale, u.imageModalScale || DEFAULT.imageModalScale);
        const safeSlideshowModalScale = patch.slideshowModalScale == null
          ? u.slideshowModalScale
          : normalizeModalSizePx(patch.slideshowModalScale, u.slideshowModalScale || DEFAULT.slideshowModalScale);
        const safeQaStreamPanelHeight = patch.qaStreamPanelHeight == null
          ? u.qaStreamPanelHeight
          : normalizeQaStreamPanelHeight(patch.qaStreamPanelHeight, u.qaStreamPanelHeight || DEFAULT.qaStreamPanelHeight);
        const safeDefaultTextModel = String(patch.defaultTextModel ?? '').trim() || u.defaultTextModel || DEFAULT.defaultTextModel;
        const safeDefaultImageModel = String(patch.defaultImageModel ?? '').trim() || u.defaultImageModel || DEFAULT.defaultImageModel;

        nextState = {
          ...u,
          theme: safeTheme,
          keyframeSize: patch.keyframeSize ?? u.keyframeSize,
          contextKeyframeSize: safeContextKeyframeSize,
          resultsPerGroup: patch.resultsPerGroup ?? patch.resultsPerRow ?? u.resultsPerGroup,
          queryResultK: safeQueryResultK,
          resultsAutoFit: true,
          cacheEnabled: patch.cacheEnabled ?? u.cacheEnabled,
          dedupeResults: patch.dedupeResults ?? u.dedupeResults,
          apiServicesHostOverrideEnabled: safeApiServicesHostOverrideEnabled,
          apiServicesHost: safeApiServicesHost,
          dataserverHostOverrideEnabled: safeDataserverHostOverrideEnabled,
          dataserverHost: safeDataserverHost,
          justifyResultRows: patch.justifyResultRows ?? u.justifyResultRows,
          tupleIndicatorMode: safeTupleIndicatorMode,
          videoBadgeOrientation: safeVideoBadgeOrientation,
          resultsetBadgeLabelMode: safeResultsetBadgeLabelMode,
          showLocalTimeInTitles: patch.showLocalTimeInTitles ?? u.showLocalTimeInTitles,
          timeBadgeTimezoneOverride: safeTimeBadgeTimezoneOverride,
          virtualizationEnabled: patch.virtualizationEnabled ?? u.virtualizationEnabled,
          virtualizationThreshold: patch.virtualizationThreshold ?? u.virtualizationThreshold,
          dresEnabled: patch.dresEnabled ?? u.dresEnabled,
          dresChallengeType: safeChallengeType,
          dresEvaluationIdByChallenge: safeEvaluationIdByChallenge,
          dresSubmitServer: patch.dresSubmitServer == null ? u.dresSubmitServer : (patch.dresSubmitServer ?? '').trim(),
          dresUsername: patch.dresUsername == null ? u.dresUsername : (patch.dresUsername ?? '').trim(),
          dresPassword: patch.dresPassword ?? u.dresPassword,
          dresMemberId: patch.dresMemberId == null ? u.dresMemberId : (patch.dresMemberId ?? '').trim(),
          autoTranslateQueries: patch.autoTranslateQueries ?? u.autoTranslateQueries,
          showAutoTranslateToggle: patch.showAutoTranslateToggle ?? u.showAutoTranslateToggle,
          temporalWindowSeconds: safeTemporalWindowSeconds,
          videoPlayerModalMode: safeVideoPlayerModalMode,
          imageModalScale: safeImageModalScale,
          slideshowModalScale: safeSlideshowModalScale,
          qaStreamPanelHeight: safeQaStreamPanelHeight,
          modelSelectionPerStepEnabled: patch.modelSelectionPerStepEnabled ?? u.modelSelectionPerStepEnabled,
          defaultTextModel: safeDefaultTextModel,
          defaultImageModel: safeDefaultImageModel,
          runtimeSettingsDefaultsVersion: u.runtimeSettingsDefaultsVersion
        };

        return nextState;
      });

      if (nextState) {
        persist({
          theme: nextState.theme,
          keyframeSize: nextState.keyframeSize,
          contextKeyframeSize: nextState.contextKeyframeSize,
          resultsPerGroup: nextState.resultsPerGroup,
          queryResultK: nextState.queryResultK,
          resultsAutoFit: nextState.resultsAutoFit,
          cacheEnabled: nextState.cacheEnabled,
          dedupeResults: nextState.dedupeResults,
          apiServicesHostOverrideEnabled: nextState.apiServicesHostOverrideEnabled,
          apiServicesHost: nextState.apiServicesHost,
          dataserverHostOverrideEnabled: nextState.dataserverHostOverrideEnabled,
          dataserverHost: nextState.dataserverHost,
          justifyResultRows: nextState.justifyResultRows,
          tupleIndicatorMode: nextState.tupleIndicatorMode,
          videoBadgeOrientation: nextState.videoBadgeOrientation,
          resultsetBadgeLabelMode: nextState.resultsetBadgeLabelMode,
          showLocalTimeInTitles: nextState.showLocalTimeInTitles,
          timeBadgeTimezoneOverride: nextState.timeBadgeTimezoneOverride,
          virtualizationEnabled: nextState.virtualizationEnabled,
          virtualizationThreshold: nextState.virtualizationThreshold,
          dresEnabled: nextState.dresEnabled,
          dresChallengeType: nextState.dresChallengeType,
          dresEvaluationIdByChallenge: nextState.dresEvaluationIdByChallenge,
          dresSubmitServer: nextState.dresSubmitServer,
          dresUsername: nextState.dresUsername,
          dresPassword: nextState.dresPassword,
          dresMemberId: nextState.dresMemberId,
          autoTranslateQueries: nextState.autoTranslateQueries,
          showAutoTranslateToggle: nextState.showAutoTranslateToggle,
          temporalWindowSeconds: nextState.temporalWindowSeconds,
          videoPlayerModalMode: nextState.videoPlayerModalMode,
          imageModalScale: nextState.imageModalScale,
          slideshowModalScale: nextState.slideshowModalScale,
          qaStreamPanelHeight: nextState.qaStreamPanelHeight,
          modelSelectionPerStepEnabled: nextState.modelSelectionPerStepEnabled,
          defaultTextModel: nextState.defaultTextModel,
          defaultImageModel: nextState.defaultImageModel,
          runtimeSettingsDefaultsVersion: nextState.runtimeSettingsDefaultsVersion
        });
      }
    }
  };

  return { subscribe, set, update, actions };
}

export const uiStore = createUIStore();
