import runtimeProfiles from '../config/runtimeProfiles.json';
import { warnFallback } from './fallbackWarn.js';

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
  const isUnknownCollection = (!isObject(byCollection) || Object.keys(byCollection).length === 0)
    && collectionKey !== 'default';

  if (isUnknownCollection) {
    throw new Error(
      `resolveRuntimeProfile: collection "${collectionKey}" has no entry in runtimeProfiles.json. ` +
      `Add a "collections.${collectionKey}" section (media.hasVideos, groupBy, queryFilters, timeBadge, ` +
      `videoPlayer, titleFormatting, dres — see the "lsc" entry for reference) before pointing the UI at this dataset.`
    );
  }

  const hasCompetitionEntry = !!runtimeProfiles?.competitions?.[competitionKey];
  const byCompetition = runtimeProfiles?.competitions?.[competitionKey] || runtimeProfiles?.competitions?.default || {};

  if (!hasCompetitionEntry && competitionKey !== 'DEFAULT') {
    warnFallback(
      'runtimeProfile.resolveRuntimeProfile.competition',
      `Competition "${competitionKey}" has no entry in runtimeProfiles.json; using "competitions.default".`,
      { competitionKey }
    );
  }

  return deepMerge(deepMerge(defaults, byCollection), byCompetition);
}
