import { describe, it, expect } from 'vitest';
import { resolveElementTypeAlias } from './api.js';

// resolveElementTypeAlias() is what lets the frontend keep working against
// both an older dataserver release (declares plural "images"/"thumbnails" in
// /discovery) and the current one (singular "image"/"thumbnail"), and is
// meant to absorb future renames (e.g. "video"/"sound") without touching any
// call site — see the comment above ELEMENT_TYPE_CANONICAL in api.js.
describe('resolveElementTypeAlias', () => {
  it('resolves a request for the new singular spelling against a dataserver still declaring the old plural one', () => {
    expect(resolveElementTypeAlias('image', ['images'])).toBe('images');
    expect(resolveElementTypeAlias('thumbnail', ['thumbnails'])).toBe('thumbnails');
  });

  it('resolves a request for the old plural spelling against a dataserver declaring the new singular one', () => {
    expect(resolveElementTypeAlias('images', ['image'])).toBe('image');
    expect(resolveElementTypeAlias('thumbnails', ['thumbnail'])).toBe('thumbnail');
  });

  it('resolves when the request and the dataserver already agree', () => {
    expect(resolveElementTypeAlias('image', ['image'])).toBe('image');
    expect(resolveElementTypeAlias('images', ['images'])).toBe('images');
  });

  it('prefers the current/canonical spelling when the dataserver happens to declare both', () => {
    expect(resolveElementTypeAlias('image', ['images', 'image'])).toBe('image');
  });

  it('is case-insensitive and trims the requested type', () => {
    expect(resolveElementTypeAlias('  IMAGE  ', ['image'])).toBe('image');
  });

  it('resolves "sound"/"sounds" requests to a dataserver declaring "audio" (forward-looking alias)', () => {
    expect(resolveElementTypeAlias('sound', ['audio'])).toBe('audio');
  });

  it('resolves "video"/"videos" either direction', () => {
    expect(resolveElementTypeAlias('video', ['videos'])).toBe('videos');
    expect(resolveElementTypeAlias('videos', ['video'])).toBe('video');
  });

  it('returns null when no known alias for the requested kind is present', () => {
    expect(resolveElementTypeAlias('image', ['video'])).toBeNull();
    expect(resolveElementTypeAlias('thumbnail', [])).toBeNull();
  });

  it('falls back to treating an unrecognized requested type as its own literal alias', () => {
    // A type this table doesn't know about (not image/thumbnail/video/audio)
    // still resolves if the dataserver happens to declare that exact string.
    expect(resolveElementTypeAlias('metadata-blob', ['metadata-blob'])).toBe('metadata-blob');
    expect(resolveElementTypeAlias('metadata-blob', ['image'])).toBeNull();
  });

  it('returns null for a blank/missing requested type', () => {
    expect(resolveElementTypeAlias('', ['image'])).toBeNull();
    expect(resolveElementTypeAlias(null, ['image'])).toBeNull();
  });

  it('treats a non-array availableTypes as empty', () => {
    expect(resolveElementTypeAlias('image', null)).toBeNull();
    expect(resolveElementTypeAlias('image', undefined)).toBeNull();
  });
});
