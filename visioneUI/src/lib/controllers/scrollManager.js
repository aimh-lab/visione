// src/lib/controllers/scrollManager.js
//
// Manages per-tab scroll containers: saves/restores positions,
// registers DOM elements, and supports cross-tab navigation.

import { uiStore } from '../../stores/uiStore.js';
import { tick } from 'svelte';
import { get } from 'svelte/store';

const TABS = ['View1', 'View2', 'Similarity'];

export function createScrollManager() {
  const containers = { View1: null, View2: null, Similarity: null };
  let prevLayoutTab = null;
  const suppressNextRestore = { View1: false, View2: false, Similarity: false };

  // One handler per tab, stored so we can remove the exact listener later.
  const scrollHandlers = {
    View1:      () => { if (containers.View1)      uiStore.actions.setScrollTop('View1',      containers.View1.scrollTop); },
    View2:      () => { if (containers.View2)      uiStore.actions.setScrollTop('View2',      containers.View2.scrollTop); },
    Similarity: () => { if (containers.Similarity) uiStore.actions.setScrollTop('Similarity', containers.Similarity.scrollTop); }
  };

  /** Register (or replace) the scroll container for a given tab. */
  function registerContainer(tab, el) {
    const old = containers[tab];
    if (old && old !== el) {
      old.removeEventListener('scroll', scrollHandlers[tab]);
    }
    containers[tab] = el;
    if (el) {
      el.addEventListener('scroll', scrollHandlers[tab], { passive: true });
    }
  }

  /** Persist current scroll offset for a tab into uiStore. */
  function saveScrollTop(tab) {
    const el = containers[tab];
    if (el) uiStore.actions.setScrollTop(tab, el.scrollTop);
  }

  /** Restore scroll offset for a tab from uiStore.scrollPositions. */
  function restoreScrollTop(tab) {
    const y = get(uiStore).scrollPositions?.[tab] ?? 0;
    const el = containers[tab];
    if (el) el.scrollTop = y;
  }

  /** Reset scroll position for a specific tab (sets to 0). */
  function resetScroll(tab) {
    uiStore.actions.setScrollTop(tab, 0);
    tick().then(() => {
      const el = containers[tab];
      if (!el) return;
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => el?.scrollTo?.({ top: 0 }));
      } else {
        el.scrollTop = 0;
      }
    });
  }

  /**
   * Called when the active tab changes.
   * Saves position for the old tab, restores for the new one.
   */
  function handleTabChange(nextTab) {
    if (prevLayoutTab) saveScrollTop(prevLayoutTab);
    const skipRestore = suppressNextRestore[nextTab];
    suppressNextRestore[nextTab] = false;
    prevLayoutTab = nextTab;

    tick().then(() => {
      if (!skipRestore) restoreScrollTop(nextTab);
    });
  }

  /** Suppress the next restore for a given tab (e.g. after openVideoSummary). */
  function suppressRestore(tab) {
    suppressNextRestore[tab] = true;
  }

  /** Reset all scroll positions (used by resetApp). */
  function resetAllScrollPositions() {
    uiStore.actions.resetScrollPositions();
    prevLayoutTab = null;
    tick().then(() => {
      TABS.forEach(tab => {
        const el = containers[tab];
        if (el) el.scrollTop = 0;
      });
    });
  }

  /** Get the container element for a tab. */
  function getContainer(tab) {
    return containers[tab];
  }

  /** Detach all scroll listeners. Call from onDestroy. */
  function destroy() {
    TABS.forEach(tab => {
      const el = containers[tab];
      if (el) el.removeEventListener('scroll', scrollHandlers[tab]);
    });
  }

  return {
    registerContainer,
    saveScrollTop,
    restoreScrollTop,
    resetScroll,
    handleTabChange,
    suppressRestore,
    resetAllScrollPositions,
    getContainer,
    destroy
  };
}
