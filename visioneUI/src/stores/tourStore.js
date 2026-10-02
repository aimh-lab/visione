import { writable } from 'svelte/store';

// Guided tour state: whether it is running and which step is shown.
// `stepCount` is set by the overlay so `next()` knows when the tour is over.
function createTourStore() {
  const { subscribe, set, update } = writable({ active: false, index: 0, stepCount: 0 });

  return {
    subscribe,
    start(stepCount = 0) {
      set({ active: true, index: 0, stepCount });
    },
    stop() {
      update((s) => ({ ...s, active: false, index: 0 }));
    },
    next() {
      update((s) => {
        if (!s.active) return s;
        const index = s.index + 1;
        if (s.stepCount && index >= s.stepCount) return { ...s, active: false, index: 0 };
        return { ...s, index };
      });
    },
    prev() {
      update((s) => (s.active ? { ...s, index: Math.max(0, s.index - 1) } : s));
    },
    setStepCount(stepCount) {
      update((s) => ({ ...s, stepCount }));
    }
  };
}

export const tour = createTourStore();

// Window event used by the tour to ask components for UI state they own
// (e.g. opening the agent panel), without threading props through the tree.
export const TOUR_UI_EVENT = 'visione-tour-ui';

export function requestTourUi(action, detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOUR_UI_EVENT, { detail: { action, ...detail } }));
}
