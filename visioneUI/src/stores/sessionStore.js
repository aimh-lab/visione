import { writable, get } from 'svelte/store';
import { uiStore } from './uiStore.js';

const DEFAULT = {
  rfPositive: [],
  rfNegative: [],
  submittedImages: [],
  submittedAnswers: [],
  pinnedVideoSummaries: []
};

const freshDefault = () => ({
  rfPositive: [],
  rfNegative: [],
  submittedImages: [],
  submittedAnswers: [],
  pinnedVideoSummaries: []
});

function createSessionStore() {
  const { subscribe, update } = writable(DEFAULT);

  const actions = {
    clearAll() {
      update(() => freshDefault());
    },

    submitAnswer({ text, status = 'PENDING', verdict = '', description = '' }) {
      const value = String(text ?? '').trim();
      if (!value) return;
      const timestamp = Date.now();

      update((s) => ({
        ...s,
        submittedAnswers: [
          {
            id: `answer-${timestamp}`,
            text: value,
            status,
            verdict,
            description,
            createdAt: timestamp
          },
          ...s.submittedAnswers
        ]
      }));

      uiStore.actions.focusRightTab('Submitted');
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
    },

    pinVideoSummary({ videoId, highlightImgId = null, label = '' }) {
      const safeVideoId = String(videoId || '').trim();
      if (!safeVideoId) return { added: false, reason: 'missing-video-id' };

      const safeHighlight = String(highlightImgId || '').trim() || null;
      const safeLabel = String(label || '').trim() || safeVideoId;

      let added = false;
      update((s) => {
        const exists = (s.pinnedVideoSummaries || []).some(
          (item) => item.videoId === safeVideoId && String(item.highlightImgId || '') === String(safeHighlight || '')
        );
        if (exists) return s;
        added = true;
        return {
          ...s,
          pinnedVideoSummaries: [
            { videoId: safeVideoId, highlightImgId: safeHighlight, label: safeLabel },
            ...(s.pinnedVideoSummaries || [])
          ].slice(0, 12)
        };
      });

      return { added, reason: added ? 'added' : 'already-exists' };
    },

    unpinVideoSummary({ videoId, highlightImgId = null }) {
      const safeVideoId = String(videoId || '').trim();
      if (!safeVideoId) return;
      const safeHighlight = String(highlightImgId || '').trim() || null;

      update((s) => ({
        ...s,
        pinnedVideoSummaries: (s.pinnedVideoSummaries || []).filter(
          (item) => !(item.videoId === safeVideoId && String(item.highlightImgId || '') === String(safeHighlight || ''))
        )
      }));
    },

    clearPinnedVideoSummaries() {
      update((s) => ({ ...s, pinnedVideoSummaries: [] }));
    }
  };

  return { subscribe, actions, get: () => get({ subscribe }) };
}

export const sessionStore = createSessionStore();
