import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts } from './toastStore.js';

beforeEach(() => {
  // Drain any toasts left over from a previous test.
  for (const t of get(toasts)) toasts.remove(t.id);
});

describe('toasts.success/error/warning/info', () => {
  it('adds a toast with the right type and default duration, returning its id', () => {
    const id = toasts.success('Saved!');
    const [toast] = get(toasts);
    expect(toast).toMatchObject({ id, message: 'Saved!', type: 'success', duration: 3000 });
  });

  it('uses a longer default duration for errors', () => {
    toasts.error('Oops');
    expect(get(toasts)[0].duration).toBe(5000);
  });

  it('assigns increasing, distinct ids across calls', () => {
    const id1 = toasts.info('a');
    const id2 = toasts.info('b');
    expect(id2).not.toBe(id1);
  });

  it('accepts a custom duration override', () => {
    toasts.info('custom', 1234);
    expect(get(toasts)[0].duration).toBe(1234);
  });
});

describe('toasts capacity', () => {
  it('keeps only the most recent 3 toasts', () => {
    toasts.info('1');
    toasts.info('2');
    toasts.info('3');
    toasts.info('4');
    const messages = get(toasts).map((t) => t.message);
    expect(messages).toEqual(['2', '3', '4']);
  });
});

describe('toasts.remove and auto-dismiss', () => {
  it('remove() drops the toast with the matching id', () => {
    const id = toasts.info('bye');
    toasts.remove(id);
    expect(get(toasts).find((t) => t.id === id)).toBeUndefined();
  });

  describe('with fake timers', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('auto-removes the toast after its duration elapses', () => {
      const id = toasts.info('temporary', 1000);
      expect(get(toasts).some((t) => t.id === id)).toBe(true);
      vi.advanceTimersByTime(999);
      expect(get(toasts).some((t) => t.id === id)).toBe(true);
      vi.advanceTimersByTime(1);
      expect(get(toasts).some((t) => t.id === id)).toBe(false);
    });

    it('does not schedule auto-removal for a duration of 0 (persistent toast)', () => {
      const id = toasts.info('persistent', 0);
      vi.advanceTimersByTime(100000);
      expect(get(toasts).some((t) => t.id === id)).toBe(true);
    });
  });
});
