// src/lib/queryStepFormatting.js
//
// Pure formatting/styling helpers for a query step (the numbered textarea
// blocks in TextareasManager.svelte): step accent color and comparator/
// metadata-field label formatting. Extracted from TextareasManager.svelte
// (previously ~3600 lines) because these functions have no dependency on
// component state/props — they only transform their own arguments.

import { CATEGORICAL_PALETTE } from "../config/categoricalPalette.js";

// Metadata fields whose filter value is a number (year, epoch, bpm, ...),
// as opposed to a free-text/fuzzy-matched field (e.g. location, music).
const NUMERIC_FILTER_FIELDS = new Set(['year', 'month', 'day', 'hour', 'epoch', 'epoch_from', 'epoch_to', 'heart_rate_bpm']);

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

export function getStepColor(index) {
  const paletteColor = CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length] || CATEGORICAL_PALETTE[0];
  const { r, g, b } = hexToRgb(paletteColor);
  return `rgb(${r}, ${g}, ${b})`;
}

export function withAlpha(color, alpha) {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (!match) return color;
  const [, r, g, b] = match;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

export function getShortcutForField(field) {
  return String(field || '').trim().toLowerCase();
}

export function getDefaultComparatorForField(field) {
  return NUMERIC_FILTER_FIELDS.has(String(field || '').trim().toLowerCase()) ? 'eq' : 'fts';
}

export function getMetadataFieldHint(field) {
  const shortcut = getShortcutForField(field);
  if (NUMERIC_FILTER_FIELDS.has(String(field || '').trim().toLowerCase())) {
    return `${shortcut}:42 or ${shortcut}:>42`;
  }
  return `${shortcut}:dublin or ${shortcut}:~dublin`;
}

export function toComparatorSymbol(comparator, fallback) {
  const normalized = String(comparator || '').trim().toLowerCase();
  if (normalized === 'gte') return '>=';
  if (normalized === 'lte') return '<=';
  if (normalized === 'gt') return '>';
  if (normalized === 'lt') return '<';
  if (normalized === 'eq') return '=';
  if (normalized === 'ne') return '!=';
  if (normalized === 'fts') return '~';

  const normalizedFallback = String(fallback || '').trim().toLowerCase();
  if (normalizedFallback === 'gte') return '>=';
  if (normalizedFallback === 'lte') return '<=';
  if (normalizedFallback === 'gt') return '>';
  if (normalizedFallback === 'lt') return '<';
  if (normalizedFallback === 'ne') return '!=';
  if (normalizedFallback === 'fts') return '~';
  return '=';
}
