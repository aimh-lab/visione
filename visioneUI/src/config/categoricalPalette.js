// src/config/categoricalPalette.js
//
// Shared categorical color palette, used wherever the UI needs to assign a
// stable color to an item based on an index or a hash (e.g. "color group N
// this way"). Previously two independent 7-color / 4-color palettes were
// invented for the same pattern in src/components/ResultsGrid.svelte
// (TUPLE_GROUP_COLORS, badge/border color per result tuple group) and
// src/components/TextareasManager.svelte (TIMELINE_STOPS, color per query
// step). Centralizing avoids a third bespoke palette next time.
//
// Usage: CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]

export const CATEGORICAL_PALETTE = [
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7'
];
