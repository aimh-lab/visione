const ICONS = {
  rank: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
  video: `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
  date: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  metadata: `<rect x="4" y="4" width="16" height="16" rx="3" ry="3"/><path d="M8 9h8M8 13h8M8 17h5"/>`
};

const DEFAULT_GROUP_BY_OPTIONS = [
  {
    value: 'byrank',
    label: 'No group',
    description: 'Show results without grouping',
    icon: ICONS.rank,
    kind: 'rank'
  },
  {
    value: 'bydate',
    label: 'Group by Date',
    description: 'Group results by calendar date',
    icon: ICONS.date,
    kind: 'date'
  },
  {
    value: 'byvideo',
    label: 'Group by Hour',
    description: 'Group results by hour',
    icon: ICONS.video,
    kind: 'video'
  }
];

export const SORT_MODE_OPTIONS = [
  {
    value: 'relevance',
    label: 'Sort by relevance',
    description: 'Keep backend relevance ranking',
    icon: ICONS.rank
  },
  {
    value: 'time',
    label: 'Sort by time',
    description: 'Order results by capture time',
    icon: ICONS.date
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
    return getDefaultGroupByOptions();
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

  return result.length > 0 ? result : getDefaultGroupByOptions();
}

export function resolveViewMode(currentMode, runtimeProfile = {}) {
  const options = normalizeGroupByOptions(runtimeProfile);
  const current = toSafeString(currentMode);
  if (current && options.some((option) => option.value === current)) {
    return current;
  }
  return options[0]?.value || 'byrank';
}

export function resolveSortMode(currentMode) {
  const current = toSafeString(currentMode).toLowerCase();
  return SORT_MODE_OPTIONS.some((option) => option.value === current) ? current : 'relevance';
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
