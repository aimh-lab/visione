import { describe, it, expect } from 'vitest';
import {
  FRAME_DRAG_MIME,
  QUERY_IMAGE_DRAG_MIME,
  isFrameDragEvent,
  isQueryImageDragEvent,
  isImageDragEvent,
  getNearestStepIndex
} from './queryStepDrag.js';

const dragEvent = (types) => ({ dataTransfer: { types } });

describe('isFrameDragEvent / isQueryImageDragEvent / isImageDragEvent', () => {
  it('recognizes an event carrying the frame-drag MIME type', () => {
    expect(isFrameDragEvent(dragEvent([FRAME_DRAG_MIME]))).toBe(true);
    expect(isFrameDragEvent(dragEvent(['text/plain']))).toBe(false);
  });

  it('recognizes an event carrying the query-image-drag MIME type', () => {
    expect(isQueryImageDragEvent(dragEvent([QUERY_IMAGE_DRAG_MIME]))).toBe(true);
    expect(isQueryImageDragEvent(dragEvent(['text/plain']))).toBe(false);
  });

  it('handles a DOMStringList-like `types` (iterable, not a plain array)', () => {
    const domStringListLike = { *[Symbol.iterator]() { yield FRAME_DRAG_MIME; } };
    expect(isFrameDragEvent({ dataTransfer: { types: domStringListLike } })).toBe(true);
  });

  it('returns false when dataTransfer/types is missing', () => {
    expect(isFrameDragEvent({})).toBe(false);
    expect(isFrameDragEvent({ dataTransfer: {} })).toBe(false);
    expect(isFrameDragEvent(null)).toBe(false);
  });

  it('isImageDragEvent is true for either MIME type, false otherwise', () => {
    expect(isImageDragEvent(dragEvent([FRAME_DRAG_MIME]))).toBe(true);
    expect(isImageDragEvent(dragEvent([QUERY_IMAGE_DRAG_MIME]))).toBe(true);
    expect(isImageDragEvent(dragEvent(['text/plain']))).toBe(false);
  });
});

describe('getNearestStepIndex', () => {
  const elAt = (top, height = 20) => ({ getBoundingClientRect: () => ({ top, height }) });

  it('returns the index of the step whose vertical center is closest to clientY', () => {
    const stepRefs = [elAt(0), elAt(100), elAt(200)]; // centers at 10, 110, 210
    expect(getNearestStepIndex(stepRefs, 105)).toBe(1);
    expect(getNearestStepIndex(stepRefs, 15)).toBe(0);
    expect(getNearestStepIndex(stepRefs, 500)).toBe(2);
  });

  it('skips null/missing refs (e.g. steps not yet mounted)', () => {
    const stepRefs = [null, elAt(100)];
    expect(getNearestStepIndex(stepRefs, 0)).toBe(1);
  });

  it('returns -1 when there are no usable refs', () => {
    expect(getNearestStepIndex([], 0)).toBe(-1);
    expect(getNearestStepIndex([null, null], 0)).toBe(-1);
  });
});
