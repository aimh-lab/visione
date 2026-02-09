// src/lib/ui/domRowNav.js
import { browser } from '$app/environment';

export function getFirstOfNextRowDOM({ currentIndex, direction, container, items }) {
  if (!browser) return currentIndex;
  if (!container || !Array.isArray(items) || items.length === 0) return currentIndex;

  const currentEl = container.querySelector(
    `[data-index="${currentIndex}"], [data-frame-id="${items[currentIndex]?.imgId}"]`
  );
  if (!currentEl) return currentIndex;

  const currentTop = currentEl.getBoundingClientRect().top;

  const allElements = Array.from(container.querySelectorAll("[data-index], [data-frame-id]"));
  if (allElements.length === 0) return currentIndex;

  if (direction === 1) {
    for (let i = 0; i < allElements.length; i++) {
      const rect = allElements[i].getBoundingClientRect();
      if (rect.top > currentTop + 10) {
        const idx = allElements[i].getAttribute("data-index");
        const frameId = allElements[i].getAttribute("data-frame-id");

        if (idx !== null) return parseInt(idx, 10);

        if (frameId) {
          const t = items.findIndex(item => item.imgId === frameId);
          return t >= 0 ? t : currentIndex;
        }
      }
    }
    return items.length - 1;
  }

  // direction === -1
  for (let i = allElements.length - 1; i >= 0; i--) {
    const rect = allElements[i].getBoundingClientRect();
    if (rect.top < currentTop - 10) {
      const prevRowTop = rect.top;

      for (let j = 0; j <= i; j++) {
        const checkRect = allElements[j].getBoundingClientRect();
        if (Math.abs(checkRect.top - prevRowTop) < 10) {
          const firstIdx = allElements[j].getAttribute("data-index");
          const firstFrameId = allElements[j].getAttribute("data-frame-id");

          if (firstIdx !== null) return parseInt(firstIdx, 10);

          if (firstFrameId) {
            const t = items.findIndex(item => item.imgId === firstFrameId);
            return t >= 0 ? t : currentIndex;
          }
        }
      }
      break;
    }
  }

  return 0;
}
