import { describe, it, expect } from 'vitest';
import {
  getAnySelectedDresEvaluationId,
  getSelectedDresEvaluationIdForChallenge,
  normalizeEvaluationOptions,
  canLoadDresEvaluations,
  computeDresEvaluationLoadKey
} from './dresEvaluationOptions.js';

describe('getAnySelectedDresEvaluationId', () => {
  it('returns the first non-empty id in DRES_CHALLENGE_TYPES order (KIS, AVS, Q&A)', () => {
    expect(getAnySelectedDresEvaluationId({ KIS: '', AVS: 'avs-id', 'Q&A': 'qa-id' })).toBe('avs-id');
    expect(getAnySelectedDresEvaluationId({ KIS: 'kis-id', AVS: 'avs-id' })).toBe('kis-id');
  });

  it('returns "" when the map is empty, missing, or has only blank values', () => {
    expect(getAnySelectedDresEvaluationId({})).toBe('');
    expect(getAnySelectedDresEvaluationId(null)).toBe('');
    expect(getAnySelectedDresEvaluationId({ KIS: '   ' })).toBe('');
  });
});

describe('getSelectedDresEvaluationIdForChallenge', () => {
  it('returns the id for the given challenge type when present', () => {
    expect(getSelectedDresEvaluationIdForChallenge({ KIS: 'kis-id', AVS: 'avs-id' }, 'AVS')).toBe('avs-id');
  });

  it('falls back to any selected id when the given challenge type has none', () => {
    expect(getSelectedDresEvaluationIdForChallenge({ AVS: 'avs-id' }, 'KIS')).toBe('avs-id');
  });

  it('returns "" when nothing is selected at all', () => {
    expect(getSelectedDresEvaluationIdForChallenge({}, 'KIS')).toBe('');
  });
});

describe('normalizeEvaluationOptions', () => {
  it('normalizes id/name/status/type, deriving a displayName from name or a status/type fallback', () => {
    const result = normalizeEvaluationOptions([
      { id: '1', name: 'My Eval', status: 'ACTIVE', type: 'KIS' },
      { id: '2', status: 'CREATED', type: 'AVS' }
    ]);
    expect(result[0]).toMatchObject({ id: '1', name: 'My Eval', displayName: 'My Eval', status: 'ACTIVE' });
    // id '2' has no name, so displayName falls back to "Evaluation <status>".
    expect(result.find((e) => e.id === '2').displayName).toBe('Evaluation CREATED');
  });

  it('drops entries with a blank/missing id', () => {
    expect(normalizeEvaluationOptions([{ name: 'no id' }, { id: '' }])).toEqual([]);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeEvaluationOptions(null)).toEqual([]);
    expect(normalizeEvaluationOptions(undefined)).toEqual([]);
  });

  it('sorts ACTIVE evaluations first, then by id', () => {
    const result = normalizeEvaluationOptions([
      { id: 'z', status: 'CREATED' },
      { id: 'b', status: 'ACTIVE' },
      { id: 'a', status: 'ACTIVE' }
    ]);
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'z']);
  });
});

describe('canLoadDresEvaluations', () => {
  const fullSettings = { dresEnabled: true, dresSubmitServer: 'https://dres', dresUsername: 'u', dresPassword: 'p' };

  it('returns true when DRES is enabled and server/username/password are all set', () => {
    expect(canLoadDresEvaluations(fullSettings)).toBe(true);
  });

  it('returns false when dresEnabled is false', () => {
    expect(canLoadDresEvaluations({ ...fullSettings, dresEnabled: false })).toBe(false);
  });

  it('returns false when any of server/username/password is blank', () => {
    expect(canLoadDresEvaluations({ ...fullSettings, dresSubmitServer: '' })).toBe(false);
    expect(canLoadDresEvaluations({ ...fullSettings, dresUsername: '  ' })).toBe(false);
    expect(canLoadDresEvaluations({ ...fullSettings, dresPassword: '' })).toBe(false);
  });

  it('returns false for null/non-object settings', () => {
    expect(canLoadDresEvaluations(null)).toBe(false);
  });
});

describe('computeDresEvaluationLoadKey', () => {
  it('produces a stable "|"-joined key from the load-relevant fields', () => {
    const settings = { dresEnabled: true, dresSubmitServer: 's', dresUsername: 'u', dresPassword: 'p' };
    expect(computeDresEvaluationLoadKey(settings)).toBe('true|s|u|p');
  });

  it('changes when any load-relevant field changes', () => {
    const base = { dresEnabled: true, dresSubmitServer: 's', dresUsername: 'u', dresPassword: 'p' };
    const key1 = computeDresEvaluationLoadKey(base);
    const key2 = computeDresEvaluationLoadKey({ ...base, dresPassword: 'different' });
    expect(key2).not.toBe(key1);
  });

  it('is stable/idempotent for the same input', () => {
    const settings = { dresEnabled: false, dresSubmitServer: '', dresUsername: '', dresPassword: '' };
    expect(computeDresEvaluationLoadKey(settings)).toBe(computeDresEvaluationLoadKey(settings));
  });
});
