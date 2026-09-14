import { describe, it, expect } from 'vitest';
import { resolveVideoTimeReferenceSeconds } from './videoTimeReference.js';

describe('resolveVideoTimeReferenceSeconds', () => {
  const fields = { item_time: 'start_time_seconds', item_start_time: 'start_time_seconds', item_end_time: 'end_time_seconds' };

  it('reads the mapped field from item.raw.metadata', () => {
    const item = { raw: { metadata: { start_time_seconds: 42.5 } } };
    expect(resolveVideoTimeReferenceSeconds(item, fields)).toBe(42.5);
  });

  it('falls back to item.raw and item when metadata does not have the field', () => {
    expect(resolveVideoTimeReferenceSeconds({ raw: { start_time_seconds: 10 } }, fields)).toBe(10);
    expect(resolveVideoTimeReferenceSeconds({ start_time_seconds: 5 }, fields)).toBe(5);
  });

  it('resolves a different semantic key via the third argument', () => {
    const item = { raw: { metadata: { end_time_seconds: 99 } } };
    expect(resolveVideoTimeReferenceSeconds(item, fields, 'item_end_time')).toBe(99);
  });

  it('returns null when the dataset does not declare this mapping at all (e.g. LSC)', () => {
    expect(resolveVideoTimeReferenceSeconds({ raw: { metadata: { start_time_seconds: 42 } } }, {})).toBeNull();
    expect(resolveVideoTimeReferenceSeconds({ raw: { metadata: { start_time_seconds: 42 } } }, undefined)).toBeNull();
  });

  it('returns null when the mapped field is missing or not numeric', () => {
    expect(resolveVideoTimeReferenceSeconds({ raw: { metadata: {} } }, fields)).toBeNull();
    expect(resolveVideoTimeReferenceSeconds({ raw: { metadata: { start_time_seconds: 'n/a' } } }, fields)).toBeNull();
  });

  it('returns null for a negative value', () => {
    expect(resolveVideoTimeReferenceSeconds({ raw: { metadata: { start_time_seconds: -1 } } }, fields)).toBeNull();
  });

  it('returns null for a missing/non-object item', () => {
    expect(resolveVideoTimeReferenceSeconds(null, fields)).toBeNull();
    expect(resolveVideoTimeReferenceSeconds(undefined, fields)).toBeNull();
  });
});
