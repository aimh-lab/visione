import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore } from './sessionStore.js';

beforeEach(() => {
  sessionStore.actions.clearAll();
});

describe('clearAll', () => {
  it('resets every field to its empty default', () => {
    sessionStore.actions.toggleRFPositive({ imgId: 'a', imgObj: { imgId: 'a' } });
    sessionStore.actions.clearAll();
    expect(sessionStore.get()).toEqual({
      rfPositive: [],
      rfNegative: [],
      submittedImages: [],
      submittedAnswers: [],
      pinnedVideoSummaries: [],
      pinnedImages: []
    });
  });
});

describe('submitAnswer', () => {
  it('prepends a normalized submitted-answer entry (most recent first)', () => {
    sessionStore.actions.submitAnswer({ text: 'first' });
    sessionStore.actions.submitAnswer({ text: 'second', status: 'ACCEPTED', verdict: 'CORRECT' });
    const [latest, earlier] = sessionStore.get().submittedAnswers;
    expect(latest).toMatchObject({ text: 'second', status: 'ACCEPTED', verdict: 'CORRECT' });
    expect(earlier).toMatchObject({ text: 'first', status: 'PENDING' });
    expect(latest.id).not.toBe(earlier.id);
  });

  it('ignores a blank/missing text', () => {
    sessionStore.actions.submitAnswer({ text: '   ' });
    expect(sessionStore.get().submittedAnswers).toEqual([]);
  });
});

describe('submitFrame', () => {
  it('adds the frame to submittedImages and calls markSubmitted with the imgId', () => {
    let markedId = null;
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1' }, markSubmitted: (id) => { markedId = id; } });
    expect(sessionStore.get().submittedImages).toEqual([{ imgId: 'f1' }]);
    expect(markedId).toBe('f1');
  });

  it('does not add the same imgId twice', () => {
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1' } });
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1', extra: true } });
    expect(sessionStore.get().submittedImages).toHaveLength(1);
  });

  it('is a no-op when imgId or frameObj is missing', () => {
    sessionStore.actions.submitFrame({ imgId: '', frameObj: { imgId: 'f1' } });
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: null });
    expect(sessionStore.get().submittedImages).toEqual([]);
  });
});

describe('updateSubmittedFrame', () => {
  it('merges a patch into the matching submitted frame', () => {
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1', verdict: '' } });
    sessionStore.actions.updateSubmittedFrame({ imgId: 'f1', patch: { verdict: 'CORRECT' } });
    expect(sessionStore.get().submittedImages[0]).toEqual({ imgId: 'f1', verdict: 'CORRECT' });
  });

  it('leaves other frames untouched', () => {
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1' } });
    sessionStore.actions.submitFrame({ imgId: 'f2', frameObj: { imgId: 'f2' } });
    sessionStore.actions.updateSubmittedFrame({ imgId: 'f1', patch: { verdict: 'X' } });
    expect(sessionStore.get().submittedImages.find((i) => i.imgId === 'f2')).toEqual({ imgId: 'f2' });
  });
});

describe('toggleRFPositive / toggleRFNegative', () => {
  it('adds an image to rfPositive, removing it from rfNegative if present', () => {
    sessionStore.actions.toggleRFNegative({ imgId: 'a', imgObj: { imgId: 'a' } });
    sessionStore.actions.toggleRFPositive({ imgId: 'a', imgObj: { imgId: 'a' } });
    const s = sessionStore.get();
    expect(s.rfPositive).toEqual([{ imgId: 'a' }]);
    expect(s.rfNegative).toEqual([]);
  });

  it('toggling an already-positive image removes it (does not move it to negative)', () => {
    sessionStore.actions.toggleRFPositive({ imgId: 'a', imgObj: { imgId: 'a' } });
    sessionStore.actions.toggleRFPositive({ imgId: 'a', imgObj: { imgId: 'a' } });
    const s = sessionStore.get();
    expect(s.rfPositive).toEqual([]);
    expect(s.rfNegative).toEqual([]);
  });

  it('rfPositive and rfNegative are mutually exclusive for the same imgId', () => {
    sessionStore.actions.toggleRFPositive({ imgId: 'a', imgObj: { imgId: 'a' } });
    sessionStore.actions.toggleRFNegative({ imgId: 'a', imgObj: { imgId: 'a' } });
    const s = sessionStore.get();
    expect(s.rfPositive).toEqual([]);
    expect(s.rfNegative).toEqual([{ imgId: 'a' }]);
  });
});

describe('addSubmittedToRFPositive', () => {
  it('adds every submitted image not already in rfPositive, removing them from rfNegative', () => {
    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1' } });
    sessionStore.actions.submitFrame({ imgId: 'f2', frameObj: { imgId: 'f2' } });
    sessionStore.actions.toggleRFNegative({ imgId: 'f2', imgObj: { imgId: 'f2' } });

    const result = sessionStore.actions.addSubmittedToRFPositive();
    expect(result).toEqual({ addedCount: 2 });

    const s = sessionStore.get();
    expect(s.rfPositive.map((i) => i.imgId).sort()).toEqual(['f1', 'f2']);
    expect(s.rfNegative).toEqual([]);
  });

  it('reports addedCount: 0 and makes no changes when there are no submitted images, or all are already positive', () => {
    expect(sessionStore.actions.addSubmittedToRFPositive()).toEqual({ addedCount: 0 });

    sessionStore.actions.submitFrame({ imgId: 'f1', frameObj: { imgId: 'f1' } });
    sessionStore.actions.toggleRFPositive({ imgId: 'f1', imgObj: { imgId: 'f1' } });
    expect(sessionStore.actions.addSubmittedToRFPositive()).toEqual({ addedCount: 0 });
  });
});

describe('pinVideoSummary / unpinVideoSummary / clearPinnedVideoSummaries', () => {
  it('pins a video summary, reporting added: true', () => {
    const result = sessionStore.actions.pinVideoSummary({ videoId: 'v1', label: 'My Video' });
    expect(result).toEqual({ added: true, reason: 'added' });
    expect(sessionStore.get().pinnedVideoSummaries).toEqual([
      { videoId: 'v1', highlightImgId: null, label: 'My Video', scope: 'hour' }
    ]);
  });

  it('does not duplicate the same videoId+highlight+scope combination', () => {
    sessionStore.actions.pinVideoSummary({ videoId: 'v1' });
    const result = sessionStore.actions.pinVideoSummary({ videoId: 'v1' });
    expect(result).toEqual({ added: false, reason: 'already-exists' });
    expect(sessionStore.get().pinnedVideoSummaries).toHaveLength(1);
  });

  it('treats a different scope or highlightImgId as a distinct pin', () => {
    sessionStore.actions.pinVideoSummary({ videoId: 'v1', scope: 'hour' });
    sessionStore.actions.pinVideoSummary({ videoId: 'v1', scope: 'day' });
    expect(sessionStore.get().pinnedVideoSummaries).toHaveLength(2);
  });

  it('normalizes an invalid scope to "hour"', () => {
    sessionStore.actions.pinVideoSummary({ videoId: 'v1', scope: 'bogus' });
    expect(sessionStore.get().pinnedVideoSummaries[0].scope).toBe('hour');
  });

  it('returns without pinning when videoId is blank', () => {
    expect(sessionStore.actions.pinVideoSummary({ videoId: '' })).toEqual({ added: false, reason: 'missing-video-id' });
  });

  it('unpinVideoSummary removes the matching pin', () => {
    sessionStore.actions.pinVideoSummary({ videoId: 'v1' });
    sessionStore.actions.unpinVideoSummary({ videoId: 'v1' });
    expect(sessionStore.get().pinnedVideoSummaries).toEqual([]);
  });

  it('caps pinned video summaries at 12, dropping the oldest', () => {
    for (let i = 0; i < 15; i += 1) sessionStore.actions.pinVideoSummary({ videoId: `v${i}` });
    const pinned = sessionStore.get().pinnedVideoSummaries;
    expect(pinned).toHaveLength(12);
    expect(pinned[0].videoId).toBe('v14'); // most recent first
  });

  it('clearPinnedVideoSummaries empties the list', () => {
    sessionStore.actions.pinVideoSummary({ videoId: 'v1' });
    sessionStore.actions.clearPinnedVideoSummaries();
    expect(sessionStore.get().pinnedVideoSummaries).toEqual([]);
  });
});

describe('pinImage / unpinImage / clearPinnedImages', () => {
  it('pins an image, deriving a label from the given label, then title, then imgId', () => {
    sessionStore.actions.pinImage({ img: { imgId: 'i1', title: 'My Title' } });
    expect(sessionStore.get().pinnedImages[0]).toMatchObject({ imgId: 'i1', label: 'My Title' });
  });

  it('does not duplicate the same imgId', () => {
    sessionStore.actions.pinImage({ img: { imgId: 'i1' } });
    const result = sessionStore.actions.pinImage({ img: { imgId: 'i1' } });
    expect(result).toEqual({ added: false, reason: 'already-exists' });
    expect(sessionStore.get().pinnedImages).toHaveLength(1);
  });

  it('returns without pinning when the image or its imgId is missing', () => {
    expect(sessionStore.actions.pinImage({ img: null })).toEqual({ added: false, reason: 'missing-img-id' });
    expect(sessionStore.actions.pinImage({ img: {} })).toEqual({ added: false, reason: 'missing-img-id' });
  });

  it('unpinImage removes the matching image', () => {
    sessionStore.actions.pinImage({ img: { imgId: 'i1' } });
    sessionStore.actions.unpinImage({ imgId: 'i1' });
    expect(sessionStore.get().pinnedImages).toEqual([]);
  });

  it('caps pinned images at 12, dropping the oldest', () => {
    for (let i = 0; i < 15; i += 1) sessionStore.actions.pinImage({ img: { imgId: `i${i}` } });
    const pinned = sessionStore.get().pinnedImages;
    expect(pinned).toHaveLength(12);
    expect(pinned[0].imgId).toBe('i14');
  });

  it('clearPinnedImages empties the list', () => {
    sessionStore.actions.pinImage({ img: { imgId: 'i1' } });
    sessionStore.actions.clearPinnedImages();
    expect(sessionStore.get().pinnedImages).toEqual([]);
  });
});
