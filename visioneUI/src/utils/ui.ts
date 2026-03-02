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
