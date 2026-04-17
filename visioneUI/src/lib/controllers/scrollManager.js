// src/lib/controllers/scrollManager.js
//
// Manages per-tab scroll containers: saves/restores positions,
// registers DOM elements, and supports cross-tab navigation.
// Scroll positions are stored in a plain object (NOT in a Svelte store)
// to avoid triggering reactive subscribers on every scroll event.

import { tick } from 'svelte';

const TABS = ['View1', 'View2', 'Similarity'];

export function createScrollManager() {
  const containers = { View1: null, View2: null, Similarity: null };
  const positions  = { View1: 0, View2: 0, Similarity: 0 };
  let prevLayoutTab = null;
  const suppressNextRestore = { View1: false, View2: false, Similarity: false };

  // One handler per tab - writes to a plain object, no store involved.
  const scrollHandlers = {
    View1:      () => { if (containers.View1)      positions.View1      = containers.View1.scrollTop; },
    View2:      () => { if (containers.View2)      positions.View2      = containers.View2.scrollTop; },
    Similarity: () => { if (containers.Similarity) positions.Similarity = containers.Similarity.scrollTop; }
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

  /** Record the current scroll offset for a tab. */
  function saveScrollTop(tab) {
    const el = containers[tab];
    if (el) positions[tab] = el.scrollTop;
  }

  /** Restore scroll offset for a tab. */
  function restoreScrollTop(tab) {
    const y = positions[tab] ?? 0;
    const el = containers[tab];
    if (el) el.scrollTop = y;
  }

  /** Reset scroll position for a specific tab (sets to 0). */
  function resetScroll(tab) {
    positions[tab] = 0;
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
    positions.View1 = 0;
    positions.View2 = 0;
    positions.Similarity = 0;
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
