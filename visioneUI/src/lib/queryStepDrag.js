// src/lib/queryStepDrag.js
//
// Shared drag-and-drop contract between the producer of a draggable frame/
// query-image (ResultsGrid.svelte, TextareasManager.svelte's attached-image
// chips) and the consumer that accepts drops onto a query step
// (TextareasManager.svelte). Previously FRAME_DRAG_MIME's value was a literal
// string duplicated independently in ResultsGrid.svelte and TextareasManager.svelte.
//
// Also holds the pure step-reorder geometry helper (nearest step to a given
// pointer Y), extracted because it does not depend on any component state
// beyond its own arguments.

export const FRAME_DRAG_MIME = "application/x-visione-frame";
export const QUERY_IMAGE_DRAG_MIME = "application/x-visione-query-image";

export function isFrameDragEvent(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes(FRAME_DRAG_MIME);
}

export function isQueryImageDragEvent(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes(QUERY_IMAGE_DRAG_MIME);
}

export function isImageDragEvent(event) {
  return isFrameDragEvent(event) || isQueryImageDragEvent(event);
}

/**
 * Index of the step (in `stepRefs`) whose element center is closest to
 * `clientY`, used while dragging a step to decide where it would land.
 * @param {Array<HTMLElement|null>} stepRefs
 * @param {number} clientY
 */
export function getNearestStepIndex(stepRefs, clientY) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < stepRefs.length; i += 1) {
    const el = stepRefs[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}
