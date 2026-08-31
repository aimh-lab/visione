import defaults from '../config/runtimeProfiles/defaults.json';
import competitions from '../config/runtimeProfiles/competitions.json';
import { warnFallback } from './fallbackWarn.js';

// One file per dataset under config/runtimeProfiles/collections/ — add a new dataset
// by dropping a new <name>.json there, no registry to update. A deployment built
// without one of these files (e.g. collections/lsc.json removed for a V3C-only
// build) simply won't bundle that dataset's config.
const collectionModules = import.meta.glob('../config/runtimeProfiles/collections/*.json', { eager: true });
const collections = {};
for (const path in collectionModules) {
  const match = path.match(/([^/]+)\.json$/);
  if (!match) continue;
  const name = match[1].toLowerCase();
  const mod = collectionModules[path];
  collections[name] = mod?.default ?? mod;
}

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
  const collectionKey = String(collectionName || 'default').trim().toLowerCase();
  const normalizedCompetition = String(competitionName || 'default').trim();
  const competitionKey = normalizedCompetition.toUpperCase() === 'QA' ? 'Q&A' : normalizedCompetition.toUpperCase();

  const byCollection = collections[collectionKey] || {};
  const isUnknownCollection = (!isObject(byCollection) || Object.keys(byCollection).length === 0)
    && collectionKey !== 'default';

  if (isUnknownCollection) {
    throw new Error(
      `resolveRuntimeProfile: collection "${collectionKey}" has no entry in ` +
      `src/config/runtimeProfiles/collections/. Add a "${collectionKey}.json" file there ` +
      `(media.hasVideos, groupBy, queryFilters, timeBadge, videoPlayer, titleFormatting, dres — ` +
      `see collections/lsc.json for reference) before pointing the UI at this dataset.`
    );
  }

  const hasCompetitionEntry = !!competitions?.[competitionKey];
  const byCompetition = competitions?.[competitionKey] || competitions?.default || {};

  if (!hasCompetitionEntry && competitionKey !== 'DEFAULT') {
    warnFallback(
      'runtimeProfile.resolveRuntimeProfile.competition',
      `Competition "${competitionKey}" has no entry in competitions.json; using "default".`,
      { competitionKey }
    );
  }

  return deepMerge(deepMerge(defaults, byCollection), byCompetition);
}
