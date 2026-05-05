// utils/results.ts
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
  const tupleItems = Array.isArray(item) ? item : null;
  const baseItem = tupleItems
    ? (tupleItems.find((entry) => entry != null) ?? null)
    : item;

  if (typeof baseItem === 'string' || typeof baseItem === 'number') {
    const rawImg = String(baseItem).trim();
    const imgId = rawImg || null;
    const match = rawImg.match(/-(\d+)-(\d+)(?:\.[^./]+)?$/i);
    const videoId = match?.[1] ?? (imgId ? imgId.split('-')[0] : null);
    const url = null;

    return {
      index: i,
      title: imgId ?? `Image ${i + 1}`,
      videoId: videoId ? String(videoId) : null,
      imgId,
      url,
      imageUrl: null,
      thumbnailUrl: null,
      videoUrl: null,
      hourId: null,
      timestamp: null,
      date: null,
      size: null,
      resolution: null,
      tags: [],
      submitted: false,
      raw: { id: imgId },
      tupleItems: tupleItems ?? null,
      tupleSize: tupleItems?.length ?? 1
    };
  }

  if (!baseItem || typeof baseItem !== 'object') {
    return {
      index: i,
      title: `Image ${i + 1}`,
      videoId: null,
      imgId: null,
      url: null,
      imageUrl: null,
      thumbnailUrl: null,
      videoUrl: null,
      hourId: null,
      timestamp: null,
      date: null,
      size: null,
      resolution: null,
      tags: [],
      submitted: false,
      raw: null,
      tupleItems: tupleItems ?? null,
      tupleSize: tupleItems?.length ?? 1
    };
  }

  const pick = (o: any, ...props: string[]) => {
    for (const p of props) if (o && o[p] != null) return o[p];
    return null;
  };

  const metadata = (baseItem && typeof baseItem.metadata === 'object' && baseItem.metadata) ? baseItem.metadata : {};

  let rawImg =
    pick(baseItem, "imgId", "imgid", "imageId", "imageid", "image_id", "frameId", "frameid", "id", "file", "fileName", "filename", "path", "uri");
  let rawVid = pick(baseItem, "videoId", "videoid", "vid", "video", "camera");

  if (typeof rawImg === "string") {
    const s = String(rawImg);
    const m = s.match(/-(\d+)-(\d+)(?:\.[^./]+)?$/i);
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
    for (const [key, val] of Object.entries(baseItem)) {
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
  const url = thumbnailUrl || imageUrl || null;
  const timestamp = pick(metadata, 'epoch', 'timestamp', 'time') ?? baseItem.timestamp ?? baseItem.date ?? null;

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
    size: baseItem.size ?? null,
    resolution: baseItem.resolution ?? null,
    tags: baseItem.tags ?? baseItem.labels ?? [],
    submitted: false,
    raw: baseItem,
    tupleItems: tupleItems ?? null,
    tupleSize: tupleItems?.length ?? 1
  };
}
