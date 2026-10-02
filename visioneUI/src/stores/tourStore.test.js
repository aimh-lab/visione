import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { tour } from './tourStore.js';
import { TOUR_STEPS } from '../lib/tour/tourSteps.js';

describe('tourStore', () => {
  beforeEach(() => tour.stop());

  it('starts at the first step and walks forward and back', () => {
    tour.start(3);
    expect(get(tour)).toMatchObject({ active: true, index: 0 });
    tour.next();
    tour.next();
    expect(get(tour).index).toBe(2);
    tour.prev();
    expect(get(tour).index).toBe(1);
  });

  it('ends after the last step', () => {
    tour.start(2);
    tour.next();
    tour.next();
    expect(get(tour).active).toBe(false);
  });

  it('ignores navigation while inactive', () => {
    tour.next();
    expect(get(tour)).toMatchObject({ active: false, index: 0 });
  });
});

describe('tour steps', () => {
  const byId = (id) => TOUR_STEPS.find((s) => s.id === id);

  it('has unique ids and a done check on every task step', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TOUR_STEPS.filter((s) => s.task)) expect(typeof s.done).toBe('function');
  });

  it('completes the first query only once results arrive', () => {
    const { done } = byId('query');
    const start = { searchCount: 0, resultCount: 0 };
    expect(done({ searchCount: 1, resultCount: 0 }, start, {})).toBe(false);
    expect(done({ searchCount: 1, resultCount: 12 }, start, {})).toBe(true);
  });

  it('completes the video step after the player is opened and closed', () => {
    const { done } = byId('play');
    const memo = {};
    expect(done({ isVideoPlayerOpen: false }, {}, memo)).toBe(false);
    expect(done({ isVideoPlayerOpen: true }, {}, memo)).toBe(false);
    expect(done({ isVideoPlayerOpen: false }, {}, memo)).toBe(true);
  });

  it('completes the sequence step only after the new step is filled and searched', () => {
    const { done } = byId('add-step');
    const start = { stepCount: 1, filledStepCount: 1, searchCount: 3 };
    const memo = {};
    expect(done({ stepCount: 2, filledStepCount: 1, searchCount: 3 }, start, memo)).toBe(false);
    expect(done({ stepCount: 2, filledStepCount: 2, searchCount: 3 }, start, memo)).toBe(false);
    expect(done({ stepCount: 2, filledStepCount: 2, searchCount: 4 }, start, memo)).toBe(true);
  });

  it('completes relevance feedback after a positive, a negative and a new search', () => {
    const { done } = byId('feedback');
    const memo = {};
    expect(done({ rfPositiveCount: 1, rfNegativeCount: 0, searchCount: 5 }, {}, memo)).toBe(false);
    expect(done({ rfPositiveCount: 1, rfNegativeCount: 1, searchCount: 5 }, {}, memo)).toBe(false);
    expect(done({ rfPositiveCount: 1, rfNegativeCount: 1, searchCount: 6 }, {}, memo)).toBe(true);
  });

  it('completes the layout step when the view mode changes', () => {
    const { done } = byId('layout');
    expect(done({ viewMode: 'byrank' }, { viewMode: 'byrank' }, {})).toBe(false);
    expect(done({ viewMode: 'byvideo' }, { viewMode: 'byrank' }, {})).toBe(true);
  });

  it('ends with recent searches', () => {
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].id).toBe('recent');
  });
});
