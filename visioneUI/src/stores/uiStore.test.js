// @vitest-environment jsdom
//
// appSettingsStore.get() always reads back from localStorage (not the
// in-memory writable — see PersistentStore#get in persistentState.js), so
// this needs a real `window`/`localStorage` to observe anything uiStore
// persists.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { uiStore } from './uiStore.js';
import { appSettingsStore } from './persistentState.js';
import { APP_SETTINGS_DEFAULTS } from '../config/appDefaults.js';

// uiStore's persist() debounces the actual appSettingsStore write by 250ms
// (see uiStore.js). Fake timers make that deterministic, and clearing them in
// afterEach prevents a test's unflushed debounce from firing mid-way through
// a later, unrelated test and silently mutating the shared appSettingsStore
// singleton.
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  appSettingsStore.set(APP_SETTINGS_DEFAULTS);
  uiStore.actions.resetUI();
  vi.runAllTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

let warnSpy;
function suppressWarnings() {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
}
afterEach(() => warnSpy?.mockRestore());

describe('resetUI', () => {
  it('resets the runtime and persistent fields to their defaults', () => {
    uiStore.actions.setTheme('dark');
    uiStore.actions.setLayoutTab('View2');
    uiStore.actions.resetUI();
    const state = get(uiStore);
    expect(state.theme).toBe('default');
    expect(state.layoutTab).toBe('View1');
    expect(state.sidebarRightTab).toBe('RF');
    expect(state.viewMode).toBe(APP_SETTINGS_DEFAULTS.viewMode);
  });
});

describe('hydrateFromSettings', () => {
  it('adopts a persisted value for a straightforward passthrough field', () => {
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, theme: 'dark' });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).theme).toBe('dark');
  });

  it('does not touch layoutTab (intentionally excluded from hydration)', () => {
    uiStore.actions.setLayoutTab('Similarity');
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).layoutTab).toBe('Similarity');
  });

  it('falls back to the current value for an unrecognized persisted dresChallengeType', () => {
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, dresChallengeType: 'bogus' });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).dresChallengeType).toBe(APP_SETTINGS_DEFAULTS.dresChallengeType);
  });

  it('derives apiServicesHostOverrideEnabled from a non-empty apiServicesHost when the flag itself is unset', () => {
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, apiServicesHostOverrideEnabled: undefined, apiServicesHost: 'https://x' });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).apiServicesHostOverrideEnabled).toBe(true);
  });

  it('normalizes an invalid persisted tupleIndicatorMode to the fallback, with a warning', () => {
    suppressWarnings();
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, tupleIndicatorMode: 'bogus' });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).tupleIndicatorMode).toBe('badge+bar');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('strips a trailing slash from persisted host URLs', () => {
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, dataserverHost: 'https://host/' });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).dataserverHost).toBe('https://host');
  });

  it('defaults contextKeyframeSize to keyframeSize when not persisted separately', () => {
    appSettingsStore.set({ ...APP_SETTINGS_DEFAULTS, keyframeSize: 250, contextKeyframeSize: undefined });
    uiStore.actions.hydrateFromSettings();
    expect(get(uiStore).contextKeyframeSize).toBe(250);
  });
});

describe('applyRuntimeSettingsDefaults', () => {
  it('is a no-op with no version string', () => {
    const before = get(uiStore);
    uiStore.actions.applyRuntimeSettingsDefaults({});
    expect(get(uiStore)).toEqual(before);
  });

  it('applies queryResultK/temporalWindowSeconds only when the current value is not already a finite number', () => {
    uiStore.set({ ...get(uiStore), queryResultK: NaN, temporalWindowSeconds: NaN });
    uiStore.actions.applyRuntimeSettingsDefaults({ version: 'v1', queryResultK: 500, temporalWindowSeconds: 60 });
    const state = get(uiStore);
    expect(state.queryResultK).toBe(500);
    expect(state.temporalWindowSeconds).toBe(60);
    expect(state.runtimeSettingsDefaultsVersion).toBe('v1');
  });

  it('does not override an already-finite queryResultK/temporalWindowSeconds', () => {
    const before = get(uiStore).queryResultK;
    uiStore.actions.applyRuntimeSettingsDefaults({ version: 'v1', queryResultK: 999999 });
    expect(get(uiStore).queryResultK).toBe(before);
  });

  it('is idempotent: re-applying the same version again is a no-op', () => {
    uiStore.set({ ...get(uiStore), queryResultK: NaN });
    uiStore.actions.applyRuntimeSettingsDefaults({ version: 'v1', queryResultK: 500 });
    const afterFirst = get(uiStore);
    uiStore.set({ ...afterFirst, queryResultK: NaN }); // simulate it becoming "unset" again
    uiStore.actions.applyRuntimeSettingsDefaults({ version: 'v1', queryResultK: 777 });
    // Same version already recorded -> must not re-apply.
    expect(get(uiStore).queryResultK).toBeNaN();
  });
});

describe('simple setters', () => {
  it('setLayoutTab updates layoutTab without persisting (runtime-only)', () => {
    uiStore.actions.setLayoutTab('View2');
    expect(get(uiStore).layoutTab).toBe('View2');
  });

  it('setViewMode passes the value through as-is (no validation)', () => {
    uiStore.actions.setViewMode('byvideo');
    expect(get(uiStore).viewMode).toBe('byvideo');
  });

  describe('setSortMode', () => {
    it('accepts "relevance"/"time_asc"/"time_desc" as-is', () => {
      uiStore.actions.setSortMode('time_desc');
      expect(get(uiStore).sortMode).toBe('time_desc');
    });

    it('maps legacy "time" to "time_asc"', () => {
      uiStore.actions.setSortMode('time');
      expect(get(uiStore).sortMode).toBe('time_asc');
    });

    it('falls back to "relevance" (with a warning) for an unrecognized value', () => {
      suppressWarnings();
      uiStore.actions.setSortMode('bogus');
      expect(get(uiStore).sortMode).toBe('relevance');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('setTheme', () => {
    it('accepts "default"/"dark"/"light"', () => {
      uiStore.actions.setTheme('dark');
      expect(get(uiStore).theme).toBe('dark');
    });

    it('falls back to "default" (with a warning) for an unrecognized value', () => {
      suppressWarnings();
      uiStore.actions.setTheme('neon');
      expect(get(uiStore).theme).toBe('default');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('setAutoTranslateQueries coerces its argument to a boolean', () => {
    uiStore.actions.setAutoTranslateQueries(1);
    expect(get(uiStore).autoTranslateQueries).toBe(true);
    uiStore.actions.setAutoTranslateQueries(0);
    expect(get(uiStore).autoTranslateQueries).toBe(false);
  });

  describe('setKeyframeSize / setContextKeyframeSize', () => {
    it('clamps to [80, 400]', () => {
      uiStore.actions.setKeyframeSize(1000);
      expect(get(uiStore).keyframeSize).toBe(400);
      uiStore.actions.setKeyframeSize(1);
      expect(get(uiStore).keyframeSize).toBe(80);
      uiStore.actions.setContextKeyframeSize(1000);
      expect(get(uiStore).contextKeyframeSize).toBe(400);
    });

    it('falls back to the current default for a non-numeric value', () => {
      uiStore.actions.setKeyframeSize('not-a-number');
      expect(get(uiStore).keyframeSize).toBe(APP_SETTINGS_DEFAULTS.keyframeSize);
    });
  });

  it('toggleSidebar / toggleRightSidebar flip their respective booleans', () => {
    const initialLeft = get(uiStore).isSidebarOpen;
    uiStore.actions.toggleSidebar();
    expect(get(uiStore).isSidebarOpen).toBe(!initialLeft);

    const initialRight = get(uiStore).isSidebarRightOpen;
    uiStore.actions.toggleRightSidebar();
    expect(get(uiStore).isSidebarRightOpen).toBe(!initialRight);
  });

  describe('setSidebarLeftWidth / setSidebarRightWidth', () => {
    it('clamps to [12, 55] (vw)', () => {
      uiStore.actions.setSidebarLeftWidth(90);
      expect(get(uiStore).sidebarLeftWidth).toBe(55);
      uiStore.actions.setSidebarRightWidth(1);
      expect(get(uiStore).sidebarRightWidth).toBe(12);
    });

    it('accepts a normal value unchanged', () => {
      uiStore.actions.setSidebarLeftWidth(25);
      expect(get(uiStore).sidebarLeftWidth).toBe(25);
    });
  });

  it('focusRightTab sets sidebarRightTab and opens the right sidebar', () => {
    uiStore.actions.focusRightTab('Submitted');
    expect(get(uiStore)).toMatchObject({ sidebarRightTab: 'Submitted', isSidebarRightOpen: true });
  });
});

describe('setDresChallengeType', () => {
  it('switches the challenge type', () => {
    uiStore.actions.setDresChallengeType('AVS');
    expect(get(uiStore).dresChallengeType).toBe('AVS');
  });

  it('falls back to the first DRES_CHALLENGE_TYPES entry (with a warning) for an unrecognized type', () => {
    suppressWarnings();
    uiStore.actions.setDresChallengeType('bogus');
    expect(get(uiStore).dresChallengeType).toBe('KIS');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('carries the previously-selected evaluation id over to the new challenge type when it has none of its own', () => {
    uiStore.actions.setDresEvaluationId('KIS', 'eval-123');
    uiStore.actions.setDresChallengeType('AVS');
    expect(get(uiStore).dresEvaluationIdByChallenge.AVS).toBe('eval-123');
  });

  // NOTE: this is the actual current behavior, not necessarily the intended
  // one — flagging for product judgment rather than "fixing" unilaterally,
  // since it affects which DRES evaluation a later submission goes to.
  // setDresChallengeType() unconditionally carries the *current* (soon to be
  // previous) challenge type's evaluation id onto the new one whenever it
  // resolves a non-empty id (own id, or any other challenge type's as a
  // fallback) — even clobbering an id the new challenge type already had of
  // its own. Switching KIS -> AVS -> KIS -> AVS again would silently replace
  // a correctly-configured AVS evaluation id with KIS's.
  it('carries the current challenge type\'s evaluation id onto the new one, clobbering any id it already had', () => {
    uiStore.actions.setDresEvaluationId('KIS', 'kis-eval');
    uiStore.actions.setDresEvaluationId('AVS', 'avs-eval');
    // dresChallengeType is still 'KIS' (never switched) at this point, so
    // switching to AVS carries KIS's id over, clobbering AVS's own 'avs-eval'.
    uiStore.actions.setDresChallengeType('AVS');
    expect(get(uiStore).dresEvaluationIdByChallenge.AVS).toBe('kis-eval');
  });
});

describe('setDresEvaluationId', () => {
  it('sets the evaluation id for a valid challenge type', () => {
    uiStore.actions.setDresEvaluationId('AVS', 'eval-1');
    expect(get(uiStore).dresEvaluationIdByChallenge.AVS).toBe('eval-1');
  });

  it('warns and drops the value for an invalid challenge type, without changing state', () => {
    suppressWarnings();
    const before = get(uiStore).dresEvaluationIdByChallenge;
    uiStore.actions.setDresEvaluationId('bogus', 'eval-1');
    expect(get(uiStore).dresEvaluationIdByChallenge).toEqual(before);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('applySettings', () => {
  it('merges only the provided fields, leaving the rest untouched', () => {
    uiStore.actions.applySettings({ theme: 'dark' });
    const state = get(uiStore);
    expect(state.theme).toBe('dark');
    expect(state.sortMode).toBe(APP_SETTINGS_DEFAULTS.sortMode);
  });

  it('falls back (with a warning) for an unrecognized theme/videoBadgeOrientation/videoPlayerModalMode/dresChallengeType', () => {
    suppressWarnings();
    uiStore.actions.applySettings({
      theme: 'neon',
      videoBadgeOrientation: 'diagonal',
      videoPlayerModalMode: 'holographic',
      dresChallengeType: 'bogus'
    });
    const state = get(uiStore);
    expect(state.theme).toBe(APP_SETTINGS_DEFAULTS.theme);
    expect(state.videoBadgeOrientation).toBe(APP_SETTINGS_DEFAULTS.videoBadgeOrientation);
    expect(state.videoPlayerModalMode).toBe(APP_SETTINGS_DEFAULTS.videoPlayerModalMode);
    expect(state.dresChallengeType).toBe(APP_SETTINGS_DEFAULTS.dresChallengeType);
    expect(warnSpy).toHaveBeenCalledTimes(4);
  });

  it('clamps numeric fields (temporalWindowSeconds, queryResultK, contextKeyframeSize, imageModalScale, slideshowModalScale, qaStreamPanelHeight)', () => {
    uiStore.actions.applySettings({
      temporalWindowSeconds: 999999999,
      queryResultK: 999999999,
      contextKeyframeSize: 999999,
      imageModalScale: 1,
      slideshowModalScale: 1,
      qaStreamPanelHeight: 1
    });
    const state = get(uiStore);
    expect(state.temporalWindowSeconds).toBeLessThanOrEqual(99999);
    expect(state.queryResultK).toBeLessThanOrEqual(100000);
    expect(state.contextKeyframeSize).toBe(400);
    expect(state.imageModalScale).toBe(80);
    expect(state.slideshowModalScale).toBe(80);
    expect(state.qaStreamPanelHeight).toBe(160);
  });

  it('trims string fields (dresSubmitServer, dresUsername, dresMemberId)', () => {
    uiStore.actions.applySettings({ dresSubmitServer: '  https://dres  ', dresUsername: '  bob  ', dresMemberId: '  m1  ' });
    const state = get(uiStore);
    expect(state.dresSubmitServer).toBe('https://dres');
    expect(state.dresUsername).toBe('bob');
    expect(state.dresMemberId).toBe('m1');
  });

  it('does not trim dresPassword (preserved verbatim)', () => {
    uiStore.actions.applySettings({ dresPassword: '  secret  ' });
    expect(get(uiStore).dresPassword).toBe('  secret  ');
  });

  it('falls back to the default model when defaultTextModel/defaultImageModel is blank', () => {
    uiStore.actions.applySettings({ defaultTextModel: '   ', defaultImageModel: '' });
    const state = get(uiStore);
    expect(state.defaultTextModel).toBe(APP_SETTINGS_DEFAULTS.defaultTextModel);
    expect(state.defaultImageModel).toBe(APP_SETTINGS_DEFAULTS.defaultImageModel);
  });

  it('does not change runtimeSettingsDefaultsVersion', () => {
    uiStore.actions.applyRuntimeSettingsDefaults({ version: 'v1' });
    uiStore.actions.applySettings({ theme: 'dark' });
    expect(get(uiStore).runtimeSettingsDefaultsVersion).toBe('v1');
  });
});

describe('persist debouncing', () => {
  it('coalesces several rapid actions into a single debounced write, with the last patch\'s values', () => {
    uiStore.actions.setSidebarLeftWidth(20);
    uiStore.actions.setSidebarLeftWidth(30);
    uiStore.actions.setSidebarLeftWidth(40);

    // Not yet written: still within the debounce window.
    expect(appSettingsStore.get().sidebarLeftWidth).toBe(APP_SETTINGS_DEFAULTS.sidebarLeftWidth);

    vi.advanceTimersByTime(250);
    expect(appSettingsStore.get().sidebarLeftWidth).toBe(40);
  });

  it('flushes immediately on demand via the beforeunload/pagehide listeners (registered only when window exists)', () => {
    // In this (node) test environment `window` is undefined, so uiStore never
    // registered those listeners — this documents that persist() otherwise
    // relies entirely on the debounce timer to eventually flush.
    uiStore.actions.setTheme('dark');
    expect(appSettingsStore.get().theme).toBe(APP_SETTINGS_DEFAULTS.theme);
    vi.advanceTimersByTime(250);
    expect(appSettingsStore.get().theme).toBe('dark');
  });

  it('accumulates patch fields across separate action calls within the same debounce window', () => {
    uiStore.actions.setTheme('dark');
    uiStore.actions.setSortMode('time_desc');
    vi.advanceTimersByTime(250);
    const saved = appSettingsStore.get();
    expect(saved.theme).toBe('dark');
    expect(saved.sortMode).toBe('time_desc');
  });
});
