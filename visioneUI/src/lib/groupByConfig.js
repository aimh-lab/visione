const ICONS = {
  rank: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
  video: `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
  date: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  metadata: `<rect x="4" y="4" width="16" height="16" rx="3" ry="3"/><path d="M8 9h8M8 13h8M8 17h5"/>`
};

const DEFAULT_GROUP_BY_OPTIONS = [
  {
    value: 'byrank',
    label: 'By Rank',
    description: 'Sort results by relevance score',
    icon: ICONS.rank,
    kind: 'rank'
  },
  {
    value: 'byvideo',
    label: 'By Video',
    description: 'Group results by video ID',
    icon: ICONS.video,
    kind: 'video'
  },
  {
    value: 'bydate',
    label: 'By Date',
    description: 'Sort by creation date',
    icon: ICONS.date,
    kind: 'date'
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
  if (!entry) return null;

  if (typeof entry === 'string') {
    const value = toSafeString(entry);
    if (!value) return null;

    const preset = DEFAULT_BY_VALUE.get(value.toLowerCase());
    if (preset) return { ...preset };

    return {
      value: slugify(value) || `group-${index + 1}`,
      label: value,
      description: `Group results by ${value}`,
      icon: ICONS.metadata,
      kind: 'metadata',
      metadata: value
    };
  }

  if (typeof entry !== 'object') return null;

  const rawValue = toSafeString(entry.value || entry.mode);
  let metadata = toSafeString(entry.metadata || entry.field);
  const preset = DEFAULT_BY_VALUE.get(rawValue.toLowerCase());
  const value = rawValue || (metadata ? `metadata:${metadata}` : slugify(entry.label || entry.name) || `group-${index + 1}`);

  let kind = normalizeKind(entry.kind || entry.type, value, metadata);
  if (!metadata && kind === 'metadata') {
    const maybeMetadata = value.toLowerCase().startsWith('metadata:') ? value.slice('metadata:'.length) : '';
    metadata = toSafeString(maybeMetadata);
  }

  const label = toSafeString(entry.label || entry.name || preset?.label || (metadata ? `By ${metadata}` : 'Group'));
  const description = toSafeString(entry.description)
    || preset?.description
    || (kind === 'metadata' && metadata ? `Group results by metadata field ${metadata}` : 'Group results');

  if (preset && !toSafeString(entry.kind || entry.type) && !metadata) {
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
    : (Array.isArray(runtimeProfile?.groupByModes) ? runtimeProfile.groupByModes : null);

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
