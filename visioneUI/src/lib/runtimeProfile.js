import runtimeProfiles from '../config/runtimeProfiles.json';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isObject(base)) return isObject(override) ? { ...override } : base;
  const out = { ...base };
  if (!isObject(override)) return out;

  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(out[key])) {
      out[key] = deepMerge(out[key], value);
      continue;
    }
    out[key] = value;
  }

  return out;
}

export function resolveRuntimeProfile(collectionName = 'default', competitionName = 'default') {
  const defaults = runtimeProfiles?.defaults || {};
  const collectionKey = String(collectionName || 'default').trim().toLowerCase();
  const normalizedCompetition = String(competitionName || 'default').trim();
  const competitionKey = normalizedCompetition.toUpperCase() === 'QA' ? 'Q&A' : normalizedCompetition.toUpperCase();

  const byCollection = runtimeProfiles?.collections?.[collectionKey] || {};
  const byCompetition = runtimeProfiles?.competitions?.[competitionKey] || runtimeProfiles?.competitions?.default || {};

  return deepMerge(deepMerge(defaults, byCollection), byCompetition);
}
