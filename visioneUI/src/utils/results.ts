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

  const metadata = (item && typeof item.metadata === 'object' && item.metadata) ? item.metadata : {};

  let rawImg =
    pick(item, "imgId", "imgid", "imageId", "imageid", "image_id", "frameId", "frameid", "id", "file", "fileName", "filename", "path", "uri");
  let rawVid = pick(item, "videoId", "videoid", "vid", "video", "camera");

  if (typeof rawImg === "string") {
    const s = String(rawImg);
    const noExt = s.replace(/\.jpg$/i, "");
    const m = noExt.match(/-(\d+)-(\d+)$/);
    if (m) {
      rawVid = rawVid ?? m[1];
      // Keep the original id exactly as provided by the backend.
      rawImg = s;
    } else {
      rawImg = s;
    }
  }

  if (!rawVid) {
    rawVid = pick(metadata, 'hour_id', 'hourId', 'video_id', 'videoId');
  }

  if (!rawVid) {
    for (const [key, val] of Object.entries(item)) {
      if (!/^videoid$/i.test(key)) continue;
      const s = String(val);
      if (/^\d{3,6}$/.test(s)) { rawVid = s; break; }
    }
  }

  const imgId = rawImg ? String(rawImg) : null;
  const videoId = rawVid ? String(rawVid) : (imgId ? imgId.split("-")[0] : null);
  const imageUrl = String(pick(metadata, 'images', 'image_url', 'imageUrl', 'url') || '').trim() || null;
  const thumbnailUrl = String(pick(metadata, 'thumbnails', 'thumbnail_url', 'thumbnailUrl') || '').trim() || null;
  const videoUrl = String(pick(metadata, 'videos', 'video_url', 'videoUrl') || '').trim() || null;
  const hourId = String(pick(metadata, 'hour_id', 'hourId') || '').trim() || null;
  const fallbackId = imgId ? imgId.replace(/\.jpg$/i, '') : null;
  const url = thumbnailUrl || imageUrl || (videoId && fallbackId ? tinyFrameUrl(videoId, fallbackId) : null);
  const timestamp = pick(metadata, 'epoch', 'timestamp', 'time') ?? item.timestamp ?? item.date ?? null;

  return {
    index: i,
    title: imgId ?? `Image ${i + 1}`,
    videoId,
    imgId,
    url,
    imageUrl,
    thumbnailUrl,
    videoUrl,
    hourId,
    timestamp,
    date: timestamp,
    size: item.size ?? null,
    resolution: item.resolution ?? null,
    tags: item.tags ?? item.labels ?? [],
    submitted: false,
    raw: item,
  };
}
