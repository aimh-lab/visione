// src/lib/controllers/textareaController.js
//
// Pure-ish helpers for managing the textareas array and associated images
// in the multi-step query builder. Each function returns the new state
// so the caller can assign it back.

/**
 * Insert a new empty textarea after `index`.
 * @returns {Array} Updated textareas array.
 */
export function addTextarea(textareas, index) {
  return [
    ...textareas.slice(0, index + 1),
    { value: '', enabled: true, model: '' },
    ...textareas.slice(index + 1)
  ];
}

/**
 * Remove textarea at `index`.
 * @returns {{ textareas: Array, shouldSearch: boolean }}
 */
export function removeTextarea(textareas, index) {
  if (textareas.length <= 1) return { textareas, shouldSearch: false };

  const next = textareas.filter((_, i) => i !== index);
  const shouldSearch = next.some(t => t.enabled && t.value?.trim());
  return { textareas: next, shouldSearch };
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
  return queries.map(q => ({ value: q, enabled: true, model: '' }));
}
