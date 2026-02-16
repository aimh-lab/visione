// src/utils/ui.ts
type ImgLike = {
  index?: number;
  idx?: number;
  title?: string;
  videoId?: string | number;
  imgId?: string | number;
  url?: string;
  submitted?: boolean;
  raw?: unknown;
};

export function indexOfImgId(
  list: Array<{ imgId?: string | number } | null | undefined>,
  imgId: string | number
): number {
  return Array.isArray(list) ? list.findIndex(i => i?.imgId === imgId) : -1;
}

export function ensureImgObj(imgId: string | number, fallback: ImgLike | null | undefined): ImgLike | null {
  if (!fallback) return null;
  return {
    index: fallback.idx ?? -1,
    title: String(fallback.title ?? fallback.imgId ?? ""),
    videoId: fallback.videoId ?? String(fallback.imgId).split("-")[0],
    imgId: fallback.imgId,
    url: fallback.url,
    submitted: !!fallback.submitted,
    raw: fallback.raw ?? null
  };
}

export function buildDisplayRows(sourceImages: ImgLike[], viewMode = "byrank", perRow = 5): ImgLike[][] {
  if (!Array.isArray(sourceImages) || sourceImages.length === 0) return [];
  const chunk = (arr: ImgLike[], n: number): ImgLike[][] => {
    const out: ImgLike[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };
  if (viewMode === "byrank") return chunk(sourceImages, perRow);
  const used = new Set<number>();
  const rows: ImgLike[][] = [];
  for (const img of sourceImages) {
    const imgIndex = img.index ?? -1;
    if (used.has(imgIndex)) continue;
    const vid = img.videoId ?? `vid-${imgIndex}`;
    const row: ImgLike[] = [];
    for (const cand of sourceImages) {
      const candIndex = cand.index ?? -1;
      if (used.has(candIndex)) continue;
      const candVid = cand.videoId ?? `vid-${candIndex}`;
      if (candVid === vid) {
        row.push(cand);
        used.add(candIndex);
        if (row.length >= perRow) break;
      }
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

export function scrollToImage(container: Element | null | undefined, target: number | string): void {
  if (!container) return;
  let el: HTMLElement | null = null;
  if (typeof target === "number") {
    el = container.querySelector<HTMLElement>(`[data-index="${target}"]`);
  } else if (typeof target === "string") {
    el = container.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(target)}"]`)
      || container.querySelector<HTMLElement>(`[data-img-id="${CSS.escape(target)}"]`);
  }
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => el.focus?.({ preventScroll: true }), 120);
  }
}
