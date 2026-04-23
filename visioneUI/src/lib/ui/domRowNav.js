// src/lib/ui/domRowNav.js
import { browser } from '$app/environment';

export function getFirstOfNextRowDOM({ currentIndex, direction, container, items }) {
  if (!browser) return currentIndex;
  if (!container || !Array.isArray(items) || items.length === 0) return currentIndex;

  const currentEl = container.querySelector(`[data-index="${currentIndex}"]`);
  if (!currentEl) return currentIndex;

  const currentTop = currentEl.getBoundingClientRect().top;

  const allElements = Array.from(container.querySelectorAll("[data-index]"));
  if (allElements.length === 0) return currentIndex;

  const resolveElementIndex = (entry) => {
    if (entry.idx !== null && Number.isFinite(entry.idx) && entry.idx >= 0) return entry.idx;
    return currentIndex;
  };

  const entries = allElements.map((el) => {
    const rawIdx = el.getAttribute("data-index");
    const parsedIdx = rawIdx !== null ? Number.parseInt(rawIdx, 10) : null;
    return {
      top: el.getBoundingClientRect().top,
      idx: Number.isFinite(parsedIdx) ? parsedIdx : null
    };
  });

  if (direction === 1) {
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].top > currentTop + 10) {
        return resolveElementIndex(entries[i]);
      }
    }
    return items.length - 1;
  }

  // direction === -1
  let prevRowTop = null;
  let prevRowLastIndex = -1;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].top < currentTop - 10) {
      prevRowTop = entries[i].top;
      prevRowLastIndex = i;
      break;
    }
  }

  if (prevRowTop !== null && prevRowLastIndex >= 0) {
    for (let j = 0; j <= prevRowLastIndex; j += 1) {
      if (Math.abs(entries[j].top - prevRowTop) < 10) {
        return resolveElementIndex(entries[j]);
      }
    }
  }

  return 0;
}
