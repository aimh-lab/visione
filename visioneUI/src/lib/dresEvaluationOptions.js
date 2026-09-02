// src/lib/dresEvaluationOptions.js
//
// Pure helpers for the DRES-evaluation-picker UI in +page.svelte (settings
// panel + auto-selection on first load): normalizing the list of evaluations
// returned by the DRES server, and resolving which one is "selected" for
// display/bootstrap purposes.
//
// NOT the same concern as dresController.js's getSelectedEvaluationId: that
// one is used right before *submitting* a result and deliberately has no
// cross-challenge-type fallback (submitting to whatever evaluationId happens
// to be configured for a different challenge would silently send results to
// the wrong evaluation). Here, a fallback is fine — this only feeds a label
// shown to the user and the "pick a sensible default" bootstrap logic.

import { DRES_CHALLENGE_TYPES } from '../config/dresConfig.js';

export function getAnySelectedDresEvaluationId(mapLike) {
  const map = mapLike && typeof mapLike === 'object' ? mapLike : {};
  for (const key of DRES_CHALLENGE_TYPES) {
    const id = String(map[key] || '').trim();
    if (id) return id;
  }
  return '';
}

export function getSelectedDresEvaluationIdForChallenge(mapLike, challengeType) {
  const map = mapLike && typeof mapLike === 'object' ? mapLike : {};
  return String(map[challengeType] || '').trim() || getAnySelectedDresEvaluationId(map);
}

export function normalizeEvaluationOptions(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((item) => {
      const id = String(item?.id ?? '').trim();
      if (!id) return null;

      return {
        id,
        name: String(item?.name ?? '').trim(),
        displayName: String(item?.name ?? '').trim() || `Evaluation ${String(item?.status ?? '').trim() || String(item?.type ?? '').trim() || ''}`.trim(),
        status: String(item?.status ?? '').trim(),
        type: String(item?.type ?? '').trim()
      };
    })
    .filter((item) => !!item)
    .sort((a, b) => {
      const aActive = a.status === 'ACTIVE' ? 0 : 1;
      const bActive = b.status === 'ACTIVE' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.id.localeCompare(b.id);
    });
}

export function canLoadDresEvaluations(settingsLike) {
  const settings = settingsLike && typeof settingsLike === 'object' ? settingsLike : {};
  return !!settings?.dresEnabled
    && !!String(settings?.dresSubmitServer || '').trim()
    && !!String(settings?.dresUsername || '').trim()
    && !!String(settings?.dresPassword || '').trim();
}

export function computeDresEvaluationLoadKey(settingsLike) {
  const settings = settingsLike && typeof settingsLike === 'object' ? settingsLike : {};
  return [
    String(!!settings?.dresEnabled),
    String(settings?.dresSubmitServer || '').trim(),
    String(settings?.dresUsername || '').trim(),
    String(settings?.dresPassword || '').trim()
  ].join('|');
}
