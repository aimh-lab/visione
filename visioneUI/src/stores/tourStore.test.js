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

  it('completes relevance feedback after marking any frame and searching again', () => {
    const { done } = byId('feedback');
    const start = { rfPositiveCount: 0, rfNegativeCount: 0 };
    const memo = {};
    expect(done({ rfPositiveCount: 0, rfNegativeCount: 0, searchCount: 5 }, start, memo)).toBe(false);
    expect(done({ rfPositiveCount: 0, rfNegativeCount: 1, searchCount: 5 }, start, memo)).toBe(false);
    expect(done({ rfPositiveCount: 0, rfNegativeCount: 1, searchCount: 6 }, start, memo)).toBe(true);
  });

  it('moves the sequence step focus to the new query box once it is added', () => {
    const { target } = byId('add-step');
    expect(target({ stepCount: 1 }, { stepCount: 1 })).toBe('add-step');
    expect(target({ stepCount: 2 }, { stepCount: 1 })).toBe('new-query-input');
  });

  it('completes the layout step when the view mode changes', () => {
    const { done } = byId('layout');
    expect(done({ viewMode: 'byrank' }, { viewMode: 'byrank' }, {})).toBe(false);
    expect(done({ viewMode: 'byvideo' }, { viewMode: 'byrank' }, {})).toBe(true);
  });

  it('completes the reorder step when the steps are reordered', () => {
    const { done } = byId('reorder');
    expect(done({ reorderCount: 0 }, { reorderCount: 0 }, {})).toBe(false);
    expect(done({ reorderCount: 1 }, { reorderCount: 0 }, {})).toBe(true);
  });

  it('completes the skip step when a step is disabled', () => {
    const { done } = byId('skip-step');
    expect(done({ enabledStepCount: 2 }, { enabledStepCount: 2 }, {})).toBe(false);
    expect(done({ enabledStepCount: 1 }, { enabledStepCount: 2 }, {})).toBe(true);
  });

  it('completes the delete step when a step is removed', () => {
    const { done } = byId('delete-step');
    expect(done({ stepCount: 2 }, { stepCount: 2 }, {})).toBe(false);
    expect(done({ stepCount: 1 }, { stepCount: 2 }, {})).toBe(true);
  });

  it('completes the agent step once a run starts and finishes', () => {
    const { done } = byId('agent');
    const memo = {};
    expect(done({ agentStreaming: false }, {}, memo)).toBe(false);
    expect(done({ agentStreaming: true }, {}, memo)).toBe(false);
    expect(done({ agentStreaming: false }, {}, memo)).toBe(true);
  });

  it('skips the agent steps and the translator tip without the AI services token', () => {
    expect(byId('agent').skip({ aiServicesAvailable: false })).toBe(true);
    expect(byId('agent-check').skip({ aiServicesAvailable: false })).toBe(true);
    expect(byId('agent').skip({ aiServicesAvailable: true })).toBe(false);
    const query = byId('query');
    expect(query.callouts({ aiServicesAvailable: false })).toEqual([]);
    expect(query.body({ aiServicesAvailable: false })).not.toContain('Translate');
    expect(query.callouts({ aiServicesAvailable: true })).toHaveLength(1);
  });

  it('starts with the challenge and ends with the reset', () => {
    expect(TOUR_STEPS[0].id).toBe('challenge');
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.id).toBe('reset');
    expect(last.done({ resetCount: 0 }, { resetCount: 0 }, {})).toBe(false);
    expect(last.done({ resetCount: 1 }, { resetCount: 0 }, {})).toBe(true);
  });
});
