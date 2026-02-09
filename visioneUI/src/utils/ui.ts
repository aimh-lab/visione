// src/utils/ui.ts
export function indexOfImgId(list, imgId) {
  return Array.isArray(list) ? list.findIndex(i => i?.imgId === imgId) : -1;
}

export function ensureImgObj(imgId, fallback) {
  if (!fallback) return null;
  return {
    index: fallback.idx ?? -1,
    title: fallback.title ?? fallback.imgId,
    videoId: fallback.videoId ?? String(fallback.imgId).split("-")[0],
    imgId: fallback.imgId,
    url: fallback.url,
    submitted: !!fallback.submitted,
    raw: fallback.raw ?? null
  };
}

export function buildDisplayRows(sourceImages, viewMode = "byrank", perRow = 5) {
  if (!Array.isArray(sourceImages) || sourceImages.length === 0) return [];
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };
  if (viewMode === "byrank") return chunk(sourceImages, perRow);
  const used = new Set();
  const rows = [];
  for (const img of sourceImages) {
    if (used.has(img.index)) continue;
    const vid = img.videoId ?? `vid-${img.index}`;
    const row = [];
    for (const cand of sourceImages) {
      if (used.has(cand.index)) continue;
      const candVid = cand.videoId ?? `vid-${cand.index}`;
      if (candVid === vid) {
        row.push(cand);
        used.add(cand.index);
        if (row.length >= perRow) break;
      }
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

export function scrollToImage(container, target) {
  if (!container) return;
  let el = null;
  if (typeof target === "number") {
    el = container.querySelector(`[data-index="${target}"]`);
  } else if (typeof target === "string") {
    el = container.querySelector(`[data-frame-id="${CSS.escape(target)}"]`)
      || container.querySelector(`[data-img-id="${CSS.escape(target)}"]`);
  }
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => el.focus?.({ preventScroll: true }), 120);
  }
}
