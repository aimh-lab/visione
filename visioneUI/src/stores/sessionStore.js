import { writable, get } from 'svelte/store';
import { uiStore } from './uiStore.js';

const DEFAULT = {
  rfPositive: [],
  rfNegative: [],
  submittedImages: [],
  submittedAnswers: [],
  pinnedVideoSummaries: [],
  pinnedImages: []
};

const freshDefault = () => ({
  rfPositive: [],
  rfNegative: [],
  submittedImages: [],
  submittedAnswers: [],
  pinnedVideoSummaries: [],
  pinnedImages: []
});

function createSessionStore() {
  const { subscribe, update } = writable(DEFAULT);
  // Date.now() alone can collide for two submitAnswer() calls within the same
  // millisecond, giving submittedAnswers two entries with the same id. Not
  // currently observed (SidebarRight.svelte's {#each submittedAnswers} isn't
  // keyed off it), but `id` should actually be unique.
  let answerIdCounter = 0;

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
            id: `answer-${timestamp}-${answerIdCounter++}`,
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

    addSubmittedToRFPositive() {
      let addedCount = 0;

      update((s) => {
        const submitted = Array.isArray(s.submittedImages) ? s.submittedImages : [];
        if (submitted.length === 0) return s;

        const positiveIds = new Set((s.rfPositive || []).map((item) => String(item?.imgId || '').trim()).filter(Boolean));
        const submittedIds = new Set(submitted.map((item) => String(item?.imgId || '').trim()).filter(Boolean));
        const toAdd = submitted.filter((item) => {
          const imgId = String(item?.imgId || '').trim();
          return imgId && !positiveIds.has(imgId);
        });

        if (toAdd.length === 0) return s;
        addedCount = toAdd.length;

        return {
          ...s,
          rfNegative: (s.rfNegative || []).filter((item) => !submittedIds.has(String(item?.imgId || '').trim())),
          rfPositive: [...(s.rfPositive || []), ...toAdd]
        };
      });

      if (addedCount > 0) uiStore.actions.focusRightTab('RF');
      return { addedCount };
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

    pinVideoSummary({ videoId, highlightImgId = null, label = '', scope = 'hour' }) {
      const safeVideoId = String(videoId || '').trim();
      if (!safeVideoId) return { added: false, reason: 'missing-video-id' };

      const safeHighlight = String(highlightImgId || '').trim() || null;
      const safeLabel = String(label || '').trim() || safeVideoId;
      const safeScope = String(scope || 'hour').trim().toLowerCase() === 'day' ? 'day' : 'hour';

      let added = false;
      update((s) => {
        const exists = (s.pinnedVideoSummaries || []).some(
          (item) => item.videoId === safeVideoId
            && String(item.highlightImgId || '') === String(safeHighlight || '')
            && String(item.scope || 'hour') === safeScope
        );
        if (exists) return s;
        added = true;
        return {
          ...s,
          pinnedVideoSummaries: [
            { videoId: safeVideoId, highlightImgId: safeHighlight, label: safeLabel, scope: safeScope },
            ...(s.pinnedVideoSummaries || [])
          ].slice(0, 12)
        };
      });

      return { added, reason: added ? 'added' : 'already-exists' };
    },

    unpinVideoSummary({ videoId, highlightImgId = null, scope = 'hour' }) {
      const safeVideoId = String(videoId || '').trim();
      if (!safeVideoId) return;
      const safeHighlight = String(highlightImgId || '').trim() || null;
      const safeScope = String(scope || 'hour').trim().toLowerCase() === 'day' ? 'day' : 'hour';

      update((s) => ({
        ...s,
        pinnedVideoSummaries: (s.pinnedVideoSummaries || []).filter(
          (item) => !(item.videoId === safeVideoId
            && String(item.highlightImgId || '') === String(safeHighlight || '')
            && String(item.scope || 'hour') === safeScope)
        )
      }));
    },

    clearPinnedVideoSummaries() {
      update((s) => ({ ...s, pinnedVideoSummaries: [] }));
    },

    pinImage({ img, label = '' }) {
      const safeImg = img && typeof img === 'object' ? img : null;
      const safeImgId = String(safeImg?.imgId || '').trim();
      if (!safeImg || !safeImgId) return { added: false, reason: 'missing-img-id' };

      const safeLabel = String(label || safeImg?.title || safeImgId).trim() || safeImgId;

      let added = false;
      update((s) => {
        const exists = (s.pinnedImages || []).some((item) => item.imgId === safeImgId);
        if (exists) return s;
        added = true;
        return {
          ...s,
          pinnedImages: [
            { ...safeImg, imgId: safeImgId, label: safeLabel },
            ...(s.pinnedImages || [])
          ].slice(0, 12)
        };
      });

      return { added, reason: added ? 'added' : 'already-exists' };
    },

    unpinImage({ imgId }) {
      const safeImgId = String(imgId || '').trim();
      if (!safeImgId) return;

      update((s) => ({
        ...s,
        pinnedImages: (s.pinnedImages || []).filter((item) => item.imgId !== safeImgId)
      }));
    },

    clearPinnedImages() {
      update((s) => ({ ...s, pinnedImages: [] }));
    }
  };

  return { subscribe, actions, get: () => get({ subscribe }) };
}

export const sessionStore = createSessionStore();
