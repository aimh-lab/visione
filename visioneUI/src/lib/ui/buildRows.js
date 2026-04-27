// src/lib/ui/buildRows.js
export function buildRows(items, { viewMode, resultsPerRow, resultsAutoFit }) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const mode = viewMode;
  const perRow = Math.max(1, Number(resultsPerRow) || 5);
  const auto = !!resultsAutoFit;

  const sortByDateDesc = (arr) =>
    [...arr].sort((a, b) => {
      const dateA = a.timestamp || a.raw?.timestamp || 0;
      const dateB = b.timestamp || b.raw?.timestamp || 0;
      return dateB - dateA;
    });

  const groupByVideo = (arr) => {
    const byVideo = new Map();
    for (const img of arr) {
      const vid = img.videoId ?? `vid-${img.index}`;
      if (!byVideo.has(vid)) byVideo.set(vid, []);
      byVideo.get(vid).push(img);
    }
    return Array.from(byVideo.values());
  };

  if (auto) {
    if (mode === "byrank") return [items];

    if (mode === "byvideo") {
      // One visual container per video; cards wrap inside the same row.
      return groupByVideo(items);
    }

    if (mode === "bydate") {
      return [sortByDateDesc(items)];
    }
  }

  if (mode === "byrank") return chunk(items, perRow);
  if (mode === "bydate") return chunk(sortByDateDesc(items), perRow);

  // byvideo: one row per video group, independent from resultsPerRow.
  return groupByVideo(items);
}
