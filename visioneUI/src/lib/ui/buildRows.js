// src/lib/ui/buildRows.js
export function buildRows(items, { viewMode, resultsPerRow, resultsAutoFit }) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  const mode = viewMode;
  const perRow = resultsPerRow ?? 5;
  const auto = !!resultsAutoFit;

  const sortByDateDesc = (arr) =>
    [...arr].sort((a, b) => {
      const dateA = a.timestamp || a.raw?.timestamp || 0;
      const dateB = b.timestamp || b.raw?.timestamp || 0;
      return dateB - dateA;
    });

  if (auto) {
    if (mode === "byrank") return [items];

    if (mode === "byvideo") {
      const byVideo = new Map();
      for (const img of items) {
        const vid = img.videoId ?? `vid-${img.index}`;
        if (!byVideo.has(vid)) byVideo.set(vid, []);
        byVideo.get(vid).push(img);
      }
      return Array.from(byVideo.values());
    }

    if (mode === "bydate") {
      return [sortByDateDesc(items)];
    }
  }

  if (mode === "byrank") return chunk(items, perRow);
  if (mode === "bydate") return chunk(sortByDateDesc(items), perRow);

  // byvideo (senza auto-fit) - grouping O(n) + chunking
  const byVideo = new Map();
  for (const img of items) {
    const vid = img.videoId ?? `vid-${img.index}`;
    if (!byVideo.has(vid)) byVideo.set(vid, []);
    byVideo.get(vid).push(img);
  }

  const rows = [];
  for (const group of byVideo.values()) {
    for (let i = 0; i < group.length; i += perRow) {
      rows.push(group.slice(i, i + perRow));
    }
  }

  return rows;
}
