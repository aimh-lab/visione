// src/config/appDefaults.js
//
// Single source of truth for the default values of persistent app settings.
// Previously these defaults were copy-pasted independently in:
//   - src/stores/persistentState.js (appSettingsStore initial value)
//   - src/stores/uiStore.js (DEFAULT object)
//   - src/components/SettingsModal.svelte (prop defaults + save() fallbacks)
// Keeping a single object avoids the three copies drifting apart.

import { DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from './modelDefaults.js';
import { DRES_CHALLENGE_TYPES, DEFAULT_DRES_CHALLENGE_TYPE } from './dresConfig.js';

export const APP_SETTINGS_DEFAULTS = {
  theme: 'default',
  viewMode: 'byvideo',
  sortMode: 'relevance',
  isSidebarOpen: true,
  isSidebarRightOpen: false,
  sidebarLeftWidth: 18,
  sidebarRightWidth: 18,
  keyframeSize: 170,
  contextKeyframeSize: 170,
  resultsPerGroup: 5,
  queryResultK: 7200,
  resultsAutoFit: true,
  cacheEnabled: false,
  dedupeResults: true,
  apiServicesHostOverrideEnabled: false,
  apiServicesHost: '',
  dataserverHostOverrideEnabled: false,
  dataserverHost: 'https://localhost:43333',
  justifyResultRows: false,
  tupleIndicatorMode: 'badge+bar',
  videoBadgeOrientation: 'horizontal',
  resultsetBadgeLabelMode: 'both',
  showLocalTimeInTitles: true,
  timeBadgeTimezoneOverride: 'profile',
  virtualizationEnabled: true,
  virtualizationThreshold: 40,
  dresEnabled: true,
  dresChallengeType: DEFAULT_DRES_CHALLENGE_TYPE,
  dresEvaluationIdByChallenge: Object.fromEntries(DRES_CHALLENGE_TYPES.map((type) => [type, ''])),
  dresSubmitServer: 'https://vbs.videobrowsing.org/',
  dresUsername: 'VISIONE',
  dresPassword: '',
  dresMemberId: '',
  autoTranslateQueries: true,
  showAutoTranslateToggle: true,
  temporalWindowSeconds: 25200,
  videoPlayerModalMode: 'profile',
  imageModalScale: 500,
  slideshowModalScale: 500,
  qaStreamPanelHeight: 288,
  modelSelectionPerStepEnabled: true,
  defaultTextModel: DEFAULT_TEXT_MODEL,
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  runtimeSettingsDefaultsVersion: ''
};
