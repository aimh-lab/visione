// utils/results.ts
import { tinyFrameUrl } from '$lib/urlConfig.js';

export function findResultsArray(obj: any): any[] | null {
  if (!obj) return null;
  if (Array.isArray(obj)) return obj;
  const keys = ["results", "result", "items", "data", "hits"];
  for (const k of keys) {
    if (Array.isArray((obj as any)[k])) return (obj as any)[k];
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "object" && v) {
      const r = findResultsArray(v);
      if (r) return r;
    }
  }
  return null;
}

export function extractImageInfo(item: any, i: number) {
  const pick = (o: any, ...props: string[]) => {
    for (const p of props) if (o && o[p] != null) return o[p];
    return null;
  };

  let rawImg =
    pick(item, "imgId", "imgid", "imageId", "imageid", "frameId", "frameid", "id", "file", "fileName", "filename", "path", "uri");
  let rawVid = pick(item, "videoId", "videoid", "vid", "video", "camera");

  if (typeof rawImg === "string") {
    let s = rawImg.replace(/.jpg/i, "");
    const m = s.match(/-(\d+)-(\d+)$/);
    if (m) {
      rawVid = rawVid ?? m[1];
      rawImg = `${m[1]}-${m[2]}`;
    } else {
      rawImg = s;
    }
  }

  if (!rawVid) {
    const any = JSON.stringify(item);
    const m2 = any.match(/"videoId"[:\s]*"(\d{3,6})"/i);
    if (m2) rawVid = m2[1];
  }

  const imgId = rawImg ? String(rawImg) : null;
  const videoId = rawVid ? String(rawVid).padStart(5, "0") : (imgId ? imgId.split("-")[0] : null);
  const url = videoId && imgId ? tinyFrameUrl(videoId, imgId) : null;

  return {
    index: i,
    title: imgId ?? `Image ${i + 1}`,
    videoId,
    imgId,
    url,
    date: item.date ?? item.timestamp ?? null,
    size: item.size ?? null,
    resolution: item.resolution ?? null,
    tags: item.tags ?? item.labels ?? [],
    submitted: false,
    raw: item,
  };
}
