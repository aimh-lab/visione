import { describe, it, expect, vi } from 'vitest';
import { DRES_CHALLENGE_TYPES, DEFAULT_DRES_CHALLENGE_TYPE, normalizeChallengeType } from './dresConfig.js';

describe('DRES_CHALLENGE_TYPES / DEFAULT_DRES_CHALLENGE_TYPE', () => {
  it('exposes the 3 known challenge types with KIS as the default (first entry)', () => {
    expect(DRES_CHALLENGE_TYPES).toEqual(['KIS', 'AVS', 'Q&A']);
    expect(DEFAULT_DRES_CHALLENGE_TYPE).toBe('KIS');
  });
});

describe('normalizeChallengeType', () => {
  it('recognizes AVS and KIS case-insensitively', () => {
    expect(normalizeChallengeType('AVS')).toBe('AVS');
    expect(normalizeChallengeType('avs')).toBe('AVS');
    expect(normalizeChallengeType('KIS')).toBe('KIS');
    expect(normalizeChallengeType('kis')).toBe('KIS');
  });

  it('recognizes "Q&A" and accepts the "QA" alias', () => {
    expect(normalizeChallengeType('Q&A')).toBe('Q&A');
    expect(normalizeChallengeType('q&a')).toBe('Q&A');
    expect(normalizeChallengeType('QA')).toBe('Q&A');
    expect(normalizeChallengeType('qa')).toBe('Q&A');
  });

  it('trims surrounding whitespace before comparing', () => {
    expect(normalizeChallengeType('  avs  ')).toBe('AVS');
  });

  it('defaults to KIS for null/undefined/empty/unrecognized input', () => {
    expect(normalizeChallengeType(null)).toBe('KIS');
    expect(normalizeChallengeType(undefined)).toBe('KIS');
    expect(normalizeChallengeType('')).toBe('KIS');
    expect(normalizeChallengeType('bogus')).toBe('KIS');
  });

  it('calls onFallback with the original raw value for an unrecognized non-empty value', () => {
    const onFallback = vi.fn();
    const result = normalizeChallengeType('bogus', { onFallback });
    expect(result).toBe('KIS');
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback).toHaveBeenCalledWith('bogus');
  });

  it('does not call onFallback for an already-KIS, empty, or nullish value', () => {
    const onFallback = vi.fn();
    normalizeChallengeType('KIS', { onFallback });
    normalizeChallengeType('', { onFallback });
    normalizeChallengeType(null, { onFallback });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('does not call onFallback for a recognized AVS/Q&A value', () => {
    const onFallback = vi.fn();
    normalizeChallengeType('AVS', { onFallback });
    normalizeChallengeType('QA', { onFallback });
    expect(onFallback).not.toHaveBeenCalled();
  });
});
