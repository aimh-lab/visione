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

describe('filter-only search ordering', () => {
  const videoIdOnly = [{ value: 'video_id:13160', enabled: true }];

  it('orders by the dataset\'s declared item_time field (V3C)', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    api.videoTimeReferenceFields = { item_time: 'start_time_seconds' };
    const payload = api.buildSearchPayloadForLogging(videoIdOnly);
    expect(payload.reorder_by).toEqual({ columns: ['start_time_seconds'] });
  });

  it('falls back to epoch when no item_time field is declared (LSC)', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    const payload = api.buildSearchPayloadForLogging(videoIdOnly);
    expect(payload.reorder_by).toEqual({ columns: ['epoch'] });
  });
});

describe('shot id filter', () => {
  it('filters by shot id with equality only', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    for (const value of ['id:13160_42', 'shot_id:13160_42', 'id:~13160_42']) {
      const payload = api.buildSearchPayloadForLogging([{ value, enabled: true }]);
      expect(payload.query.filters.arguments).toEqual([
        { comparator: 'eq', attribute: 'id', value: '13160_42' }
      ]);
    }
  });
});

describe('multi-model steps', () => {
  it('fuses one subquery per selected text model with RRF', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    const payload = api.buildSearchPayloadForLogging([{
      value: 'A person surfing in the ocean at sunset',
      enabled: true,
      textModel: 'openclip_clip_vit_h_14_image,omni_embed_nemotron_3B_video_audio'
    }]);
    expect(payload.query.aggregation_type).toBe('rrf');
    expect(payload.query.item.map((n) => [n.item, n.model])).toEqual([
      ['A person surfing in the ocean at sunset', 'openclip_clip_vit_h_14_image'],
      ['A person surfing in the ocean at sunset', 'omni_embed_nemotron_3B_video_audio']
    ]);
  });

  it('fuses one subquery per selected image model for similarity steps', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    const payload = api.buildSearchPayloadForLogging([{
      value: '', enabled: true, similarityImgId: 'abc', imageModel: 'm1,m2'
    }]);
    expect(payload.query.aggregation_type).toBe('rrf');
    expect(payload.query.item.map((n) => [n.item, n.model])).toEqual([['image:abc', 'm1'], ['image:abc', 'm2']]);
  });

  it('keeps a plain subquery for a single model', async () => {
    const { VisioneAPI } = await import('./api.js');
    const api = new VisioneAPI();
    const payload = api.buildSearchPayloadForLogging([{ value: 'a dog', enabled: true, textModel: 'm1' }]);
    expect(payload.query).toMatchObject({ item: 'a dog', model: 'm1' });
  });
});
