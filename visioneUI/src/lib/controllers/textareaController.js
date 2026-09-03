// src/lib/controllers/textareaController.js
//
// Pure-ish helpers for managing the textareas array and associated images
// in the multi-step query builder. Each function returns the new state
// so the caller can assign it back.

import { DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from '../../config/modelDefaults.js';

/**
 * Insert a new empty textarea after `index`.
 * @returns {Array} Updated textareas array.
 */
export function addTextarea(textareas, index) {
  return [
    ...textareas.slice(0, index + 1),
    { value: '', enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL },
    ...textareas.slice(index + 1)
  ];
}

/**
 * Remove textarea at `index` and keep `textareaImages` aligned by index.
 * @returns {{ textareas: Array, textareaImages: Object, shouldSearch: boolean }}
 */
export function removeTextarea(textareas, index, textareaImages = {}) {
  if (textareas.length <= 1) {
    return { textareas, textareaImages, shouldSearch: false };
  }

  const nextTextareas = textareas.filter((_, i) => i !== index);

  const imageEntries = Array.from(
    { length: textareas.length },
    (_, i) => textareaImages[i] ?? []
  );
  imageEntries.splice(index, 1);

  const nextTextareaImages = Object.fromEntries(
    imageEntries.map((imgs, i) => [i, imgs])
  );

  const shouldSearch = nextTextareas.some((t, i) => {
    if (!t?.enabled) return false;
    const text = String(t?.value || '').trim();
    const similarity = String(t?.similarityImgId || '').trim();
    const inlineImages = Array.isArray(nextTextareaImages[i]) ? nextTextareaImages[i].length > 0 : false;
    return text.length > 0 || similarity.length > 0 || inlineImages;
  });

  return { textareas: nextTextareas, textareaImages: nextTextareaImages, shouldSearch };
}

/**
 * Toggle the `enabled` flag on the textarea at `index`.
 * @returns {Array} Updated textareas array.
 */
export function toggleTextarea(textareas, index) {
  const next = [...textareas];
  next[index] = { ...next[index], enabled: !next[index].enabled };
  return next;
}

/**
 * Swap (or move) two textareas and their associated images.
 * @param {'swap'|'move'} mode
 * @returns {{ textareas: Array, textareaImages: Object } | null}  null if no-op.
 */
export function swapTextareas(textareas, textareaImages, indexA, indexB, mode = 'swap') {
  if (indexA < 0 || indexA >= textareas.length) return null;
  if (indexB < 0 || indexB >= textareas.length) return null;
  if (indexA === indexB) return null;

  const nextTextareas = [...textareas];
  const nextTextareaImages = { ...textareaImages };

  if (mode === 'move') {
    const [moved] = nextTextareas.splice(indexA, 1);
    nextTextareas.splice(indexB, 0, moved);

    const imageEntries = Array.from(
      { length: textareas.length },
      (_, i) => nextTextareaImages[i] ?? []
    );
    const [movedImages] = imageEntries.splice(indexA, 1);
    imageEntries.splice(indexB, 0, movedImages);

    return {
      textareas: nextTextareas,
      textareaImages: Object.fromEntries(imageEntries.map((imgs, i) => [i, imgs]))
    };
  }

  // swap mode
  const temp = nextTextareas[indexA];
  nextTextareas[indexA] = nextTextareas[indexB];
  nextTextareas[indexB] = temp;

  const imgsA = nextTextareaImages[indexA] ?? [];
  const imgsB = nextTextareaImages[indexB] ?? [];
  nextTextareaImages[indexA] = imgsB;
  nextTextareaImages[indexB] = imgsA;

  return { textareas: nextTextareas, textareaImages: nextTextareaImages };
}

/**
 * Build textareas from an example query array.
 * @param {string[]} queries
 * @returns {Array} New textareas array.
 */
export function loadExampleQuery(queries) {
  return queries.map(q => ({ value: q, enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL }));
}

/**
 * Clears the "disabled by similarity step" bookkeeping on a single textarea
 * (restoring its previous `enabled` state), leaving other textareas as-is.
 * Previously duplicated identically in src/routes/+page.svelte as both the
 * standalone restoreSimilarityDisabledSteps() array mapper (used when closing
 * a similarity step) and the inline clearSimilarityDisableMarker() used while
 * (re)adding one (addSimilarityAsSearchStep) — a risk, since the two "similarity
 * step" flows had to keep this per-item transform in sync by hand.
 * @returns {Object} The textarea, unchanged or with the markers cleared.
 */
export function clearSimilarityDisableMarker(t) {
  if (t?._disabledBySimilarity) {
    return {
      ...t,
      enabled: t?._wasEnabledBeforeSimilarity === true,
      _disabledBySimilarity: false,
      _wasEnabledBeforeSimilarity: false
    };
  }
  if (t?._wasEnabledBeforeSimilarity) {
    return {
      ...t,
      _disabledBySimilarity: false,
      _wasEnabledBeforeSimilarity: false
    };
  }
  return t;
}

/**
 * Applies clearSimilarityDisableMarker() to every textarea in the array.
 * @returns {Array} Updated textareas array.
 */
export function restoreSimilarityDisabledSteps(steps) {
  return steps.map(clearSimilarityDisableMarker);
}
