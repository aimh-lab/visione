import { warnFallback } from './fallbackWarn.js';

const ICONS = {
  rank: `<line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/>`,
  relevance: `<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5z"/>`,
  video: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  date: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  timeAsc: `<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>`,
  timeDesc: `<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>`,
  metadata: `<rect x="4" y="4" width="16" height="16" rx="3" ry="3"/><path d="M8 9h8M8 13h8M8 17h5"/>`
};

const DEFAULT_GROUP_BY_OPTIONS = [
  {
    value: 'byrank',
    label: 'Standard',
    description: 'Show all results (without grouping)',
    icon: ICONS.rank,
    kind: 'rank'
  },
  {
    value: 'bydate',
    label: 'By Day',
    description: 'Group results by day',
    icon: ICONS.date,
    kind: 'date'
  },
  {
    value: 'byvideo',
    label: 'By Video',
    description: 'Group results by video',
    icon: ICONS.video,
    kind: 'video'
  }
];

export const SORT_MODE_OPTIONS = [
  {
    value: 'relevance',
    label: 'Relevance',
    description: 'Best matches first',
    icon: ICONS.relevance
  },
  {
    value: 'time_asc',
    label: 'Oldest First',
    description: 'Order results from oldest to newest',
    icon: ICONS.timeAsc
  },
  {
    value: 'time_desc',
    label: 'Newest First',
    description: 'Order results from newest to oldest',
    icon: ICONS.timeDesc
  }
];

const DEFAULT_BY_VALUE = new Map(DEFAULT_GROUP_BY_OPTIONS.map((option) => [option.value, option]));

function toSafeString(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeKind(kind, value, metadata) {
  const normalizedKind = toSafeString(kind).toLowerCase();
  if (['rank', 'video', 'date', 'metadata'].includes(normalizedKind)) {
    return normalizedKind;
  }

  if (toSafeString(metadata)) return 'metadata';

  const normalizedValue = toSafeString(value).toLowerCase();
  if (normalizedValue === 'byrank') return 'rank';
  if (normalizedValue === 'byvideo') return 'video';
  if (normalizedValue === 'bydate') return 'date';
  if (normalizedValue.startsWith('metadata:')) return 'metadata';
  return 'video';
}

function normalizeEntry(entry, index) {
  if (typeof entry !== 'object') return null;

  const rawValue = toSafeString(entry.value);
  let metadata = toSafeString(entry.metadata);
  const preset = DEFAULT_BY_VALUE.get(rawValue.toLowerCase());
  const value = rawValue || (metadata ? `metadata:${metadata}` : slugify(entry.label) || `group-${index + 1}`);

  let kind = normalizeKind(entry.kind, value, metadata);
  if (!metadata && kind === 'metadata') {
    const maybeMetadata = value.toLowerCase().startsWith('metadata:') ? value.slice('metadata:'.length) : '';
    metadata = toSafeString(maybeMetadata);
  }

  const label = toSafeString(entry.label || preset?.label || (metadata ? `Group by ${metadata}` : 'Group'));
  const description = toSafeString(entry.description)
    || preset?.description
    || (kind === 'metadata' && metadata ? `Group results by metadata field ${metadata}` : 'Group results');

  if (preset && !toSafeString(entry.kind) && !metadata) {
    kind = preset.kind;
  }

  return {
    value,
    label,
    description,
    icon: ICONS[kind] || ICONS.video,
    kind,
    metadata: kind === 'metadata' ? metadata : undefined
  };
}

export function getDefaultGroupByOptions() {
  return DEFAULT_GROUP_BY_OPTIONS.map((option) => ({ ...option }));
}

export function normalizeGroupByOptions(runtimeProfile = {}) {
  const configured = Array.isArray(runtimeProfile?.groupBy?.modes)
    ? runtimeProfile.groupBy.modes
    : null;

  if (!configured) {
    throw new Error(
      'normalizeGroupByOptions: runtimeProfile.groupBy.modes is missing or not an array. ' +
      'This should always be set (see runtimeProfiles.json "defaults.groupBy.modes") — check how this runtimeProfile was built.'
    );
  }

  const result = [];
  const seen = new Set();

  configured.forEach((entry, index) => {
    const normalized = normalizeEntry(entry, index);
    if (!normalized) return;
    if (seen.has(normalized.value)) return;
    seen.add(normalized.value);
    result.push(normalized);
  });

  if (result.length === 0) {
    throw new Error(
      `normalizeGroupByOptions: runtimeProfile.groupBy.modes (${JSON.stringify(configured)}) normalized to zero valid options.`
    );
  }

  return result;
}

export function resolveViewMode(currentMode, runtimeProfile = {}) {
  const options = normalizeGroupByOptions(runtimeProfile);
  const current = toSafeString(currentMode);
  if (current && options.some((option) => option.value === current)) {
    return current;
  }
  const fallback = options[0]?.value || 'byrank';
  if (current) {
    // Not a config bug: a persisted viewMode from a *different* dataset (e.g. "bydate"
    // from LSC) legitimately doesn't exist for the active one's groupBy.modes. This is
    // exactly the case the caller's auto-correction reactive block exists to handle —
    // fall back quietly instead of throwing, unlike normalizeGroupByOptions above (which
    // throws because there the *profile itself* would be broken/missing).
    warnFallback(
      'groupByConfig.resolveViewMode',
      `viewMode "${current}" is not available for the active dataset (available: ${options.map((o) => o.value).join(', ')}); using "${fallback}" instead.`,
      { current, available: options.map((o) => o.value) }
    );
  }
  return fallback;
}

export function resolveSortMode(currentMode) {
  const current = toSafeString(currentMode).toLowerCase();
  if (current === 'time') return 'time_asc';
  if (SORT_MODE_OPTIONS.some((option) => option.value === current)) return current;
  if (current) {
    warnFallback('groupByConfig.resolveSortMode', `Unrecognized sortMode "${currentMode}", using "relevance".`, { currentMode });
  }
  return 'relevance';
}

export function resolveGroupByConfig(viewMode, runtimeProfile = {}) {
  const options = normalizeGroupByOptions(runtimeProfile);
  const fallback = options[0] || getDefaultGroupByOptions()[0];
  const active = options.find((option) => option.value === viewMode) || fallback;

  return {
    mode: active.value,
    label: active.label,
    kind: active.kind,
    metadata: active.metadata || ''
  };
}

// Metadata field names that represent a "video-like" temporal bucket even though
// normalizeEntry() above assigns them kind: 'metadata' (a preset mode combined with
// a custom `metadata` override loses its preset kind). LSC's "By Video" mode groups
// by the 'hour_id' column; add more names here if another dataset configures an
// equivalent custom video-like grouping field, instead of repeating this check
// as a literal string comparison at each call site.
const VIDEO_LIKE_GROUP_METADATA_FIELDS = new Set(['hour_id']);

export function isVideoLikeGroupByMetadata(field) {
  return VIDEO_LIKE_GROUP_METADATA_FIELDS.has(String(field || '').trim().toLowerCase());
}

export function isVideoLikeGroupBy(groupBy) {
  const kind = String(groupBy?.kind || '').trim().toLowerCase();
  if (kind === 'video') return true;
  if (kind !== 'metadata') return false;
  return isVideoLikeGroupByMetadata(groupBy?.metadata);
}
