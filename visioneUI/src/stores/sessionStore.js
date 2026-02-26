import { writable, get } from 'svelte/store';
import { uiStore } from './uiStore.js';

const DEFAULT = {
  rfPositive: [],
  rfNegative: [],
  submittedImages: []
};

const freshDefault = () => ({
  rfPositive: [],
  rfNegative: [],
  submittedImages: []
});

function createSessionStore() {
  const { subscribe, update } = writable(DEFAULT);

  const actions = {
    clearAll() {
      update(() => freshDefault());
    },

    submitFrame({ imgId, frameObj, markSubmitted }) {
      if (!imgId || !frameObj) return;

      update(s => {
        if (s.submittedImages.some(x => x.imgId === imgId)) return s;
        return { ...s, submittedImages: [...s.submittedImages, frameObj] };
      });

      markSubmitted?.(imgId);
      uiStore.actions.focusRightTab('Submitted');
    },

    updateSubmittedFrame({ imgId, patch }) {
      if (!imgId || !patch || typeof patch !== 'object') return;

      update((s) => ({
        ...s,
        submittedImages: s.submittedImages.map((item) =>
          item.imgId === imgId ? { ...item, ...patch } : item
        )
      }));
    },

    toggleRFPositive({ imgId, imgObj }) {
      if (!imgId || !imgObj) return;

      update(s => {
        const exists = s.rfPositive.some(x => x.imgId === imgId);
        if (exists) {
          return { ...s, rfPositive: s.rfPositive.filter(x => x.imgId !== imgId) };
        }
        return {
          ...s,
          rfNegative: s.rfNegative.filter(x => x.imgId !== imgId),
          rfPositive: [...s.rfPositive, imgObj]
        };
      });

      uiStore.actions.focusRightTab('RF');
    },

    toggleRFNegative({ imgId, imgObj }) {
      if (!imgId || !imgObj) return;

      update(s => {
        const exists = s.rfNegative.some(x => x.imgId === imgId);
        if (exists) {
          return { ...s, rfNegative: s.rfNegative.filter(x => x.imgId !== imgId) };
        }
        return {
          ...s,
          rfPositive: s.rfPositive.filter(x => x.imgId !== imgId),
          rfNegative: [...s.rfNegative, imgObj]
        };
      });

      uiStore.actions.focusRightTab('RF');
    }
  };

  return { subscribe, actions, get: () => get({ subscribe }) };
}

export const sessionStore = createSessionStore();
