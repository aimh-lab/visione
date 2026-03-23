// src/services/api.js
import { VISIONE_SERVICES_URL, VISIONE_VIDEOS_URL, VISIONE_SEARCH_URL } from '$lib/urlConfig.js';

class APIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
  }
}



// src/services/api.js
export class VisioneAPI {
  constructor(baseUrl = VISIONE_SERVICES_URL, videosBase = VISIONE_VIDEOS_URL, searchUrl = VISIONE_SEARCH_URL) {
    this.baseUrl = baseUrl;
    this.videosBase = videosBase;
    this.searchUrl = searchUrl;
    this.middleTimestampCache = new Map();
    this.middleTimestampInFlight = new Map();
    this.middleTimestampCacheMax = 500;
    this.middleTimestampTtlMs = 5 * 60 * 1000;
    this.defaultTextModel = 'openclip_clip_vit_b_32';
    this.defaultImageModel = 'dinov2_base';
    this.defaultSubqueryK = 100000;
    this.defaultSingleK = 1000;
    this.defaultAggregatedK = 1000;
    this.defaultTemporalWindowSeconds = 50;
    this.defaultMetadataToRetrieve = ['hour_id'];
    this.elementUrlCache = new Map();
    this.elementUrlInFlight = new Map();
    this.elementUrlCacheMax = 3000;
    this.elementUrlTtlMs = 10 * 60 * 1000;
    this.discoveryCache = null;
    this.discoveryInFlight = null;
  }

  /** Fetch /discovery once and cache the result for the session. */
  async discovery() {
    if (this.discoveryCache) return this.discoveryCache;
    if (this.discoveryInFlight) return this.discoveryInFlight;

    const run = (async () => {
      const response = await this.#makeRequest(`${this.baseUrl}/discovery`, { retries: 2 });
      const data = await response.json();
      this.discoveryCache = data;
      return data;
    })();

    this.discoveryInFlight = run;
    try {
      return await run;
    } finally {
      this.discoveryInFlight = null;
    }
  }

  #normalizeVideoId(videoId) {
    const raw = String(videoId || '').trim().replace(/\.mp4$/i, '');
    if (!raw) return '';
    return /^\d+$/.test(raw) ? raw.padStart(5, '0') : raw;
  }

  // ... #makeRequest e metodi esistenti ...

  async getMiddleTimestamp(imgId) {
    if (!imgId) throw new APIError('imgId is required', 400);

    const key = String(imgId);
    const now = Date.now();
    const cached = this.middleTimestampCache.get(key);

    if (cached && now - cached.ts < this.middleTimestampTtlMs) {
      this.middleTimestampCache.delete(key);
      this.middleTimestampCache.set(key, cached);
      return cached.value;
    }

    if (this.middleTimestampInFlight.has(key)) {
      return this.middleTimestampInFlight.get(key);
    }

    const run = (async () => {
      let num = null;

      // New API contract: /field?id=...&field=video_offset_seconds
      try {
        const metadata = await this.getField(imgId, ['video_offset_seconds']);
        const offset = Number(metadata?.video_offset_seconds);
        if (Number.isFinite(offset) && offset >= 0) {
          num = offset;
        }
      } catch {
        // Fallback handled below.
      }

      // Legacy fallback kept for older deployments.
      if (!Number.isFinite(num)) {
        const url = `${this.baseUrl}/core/getMiddleTimestamp?id=${encodeURIComponent(imgId)}`;
        const res = await this.#makeRequest(url, { retries: 1, timeout: 15000 });
        const text = await res.text();
        const legacyNum = Number(text);
        if (!Number.isFinite(legacyNum)) throw new APIError(`Non-numeric response: ${text}`, 500);
        num = legacyNum;
      }

      this.middleTimestampCache.set(key, { value: num, ts: Date.now() });
      while (this.middleTimestampCache.size > this.middleTimestampCacheMax) {
        const oldestKey = this.middleTimestampCache.keys().next().value;
        if (oldestKey === undefined) break;
        this.middleTimestampCache.delete(oldestKey);
      }

      return num;
    })();

    this.middleTimestampInFlight.set(key, run);
    try {
      return await run;
    } finally {
      this.middleTimestampInFlight.delete(key);
    }
  }

  getVideoUrl(videoId, quality = 'medium') {
    const vid = this.#normalizeVideoId(videoId);
    if (/^\d+$/.test(vid)) {
      return `${this.videosBase}/${vid}-${quality}.mp4`;
    }
    return `${this.videosBase}/${vid}.mp4`;
  }

  getThumbnailUrlByImgId(imgId, videoId = '') {
    const rawId = String(imgId || '').trim();
    if (!rawId) return null;

    const hour = String(videoId || '').trim() || (rawId.match(/^(\d{8}_\d{2})\d{4}_\d{3}(?:\.jpg)?$/i)?.[1] || '');
    const mmss = rawId.match(/^\d{8}_\d{2}(\d{4})_\d{3}(?:\.jpg)?$/i)?.[1] || '';
    if (!hour || !mmss) return null;

    return `${this.baseUrl}/thumbnails/${hour}/${hour}-${mmss}.jpg`;
  }


  async #makeRequest(url, options = {}) {
    const { retries = 1, timeout = 30000, ...fetchOptions } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const text = await response.text();
          throw new APIError(`HTTP ${response.status}: ${text}`, response.status, response);
        }
        
        return response;
      } catch (error) {
        if (attempt === retries) {
          if (error.name === 'AbortError') {
            throw new APIError('Request timeout', 408);
          }
          if (error instanceof APIError) throw error;
          throw new APIError(`Network error: ${error.message}`, 0, null);
        }
        // Exponential backoff per retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Search API
  async search({ textareas, simReorder = false, framesPerRow = 5 }) {
    void simReorder;
    void framesPerRow;

    const activeTextareas = textareas.filter((t) => {
      const text = String(t?.value || "").trim();
      const simId = String(t?.similarityImgId || "").trim();
      return !!t?.enabled && (text.length > 0 || simId.length > 0);
    });
    
    if (activeTextareas.length === 0) {
      throw new APIError('At least one textarea must be enabled and contain text or image similarity', 400);
    }

    const payload = this.#buildSearchPayload(activeTextareas);
    const payloadText = JSON.stringify(payload);

    console.info('[VisioneAPI] POST /search payload', payload);
    console.info('[VisioneAPI] POST /search payload (text)', payloadText);

    const response = await this.#makeRequest(this.searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 2
    });

    const data = await response.json();
    console.info('[VisioneAPI] POST /search response', data);
    return data;
  }

  // Similarity Search API
  async similaritySearch(baseImgId) {
    if (!baseImgId) {
      throw new APIError('BaseImgId is required for similarity search', 400);
    }

    const payload = {
      query: {
        item: `image:${String(baseImgId).trim()}`,
        model: this.defaultImageModel,
        k: this.defaultSingleK
      },
      urls_to_retrieve: ['images', 'thumbnails', 'videos'],
      metadata_to_retrieve: this.defaultMetadataToRetrieve
    };
    const payloadText = JSON.stringify(payload);

    console.info('[VisioneAPI] POST /search payload (similarity)', payload);
    console.info('[VisioneAPI] POST /search payload (similarity, text)', payloadText);

    const response = await this.#makeRequest(this.searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 2
    });

    const data = await response.json();
    console.info('[VisioneAPI] POST /search response (similarity)', data);
    return data;
  }

  async getElementUrl(id, what = ['images']) {
    if (!id) throw new APIError('id is required', 400);
    const list = (Array.isArray(what) ? what : [what]).map((w) => String(w).trim()).filter(Boolean);
    if (list.length === 0) throw new APIError('what is required', 400);

    const params = new URLSearchParams();
    params.set('id', String(id));
    list.forEach((w) => params.append('what', w));

    const response = await this.#makeRequest(`${this.baseUrl}/element-url?${params.toString()}`, {
      retries: 2
    });
    return response.json();
  }

  async getElementUrls(id, what = ['images', 'thumbnails', 'resized-videos-tiny']) {
    if (!id) throw new APIError('id is required', 400);
    const list = (Array.isArray(what) ? what : [what]).map((w) => String(w).trim()).filter(Boolean);
    if (list.length === 0) throw new APIError('what is required', 400);

    const cacheKey = `${String(id)}::${list.join(',')}`;
    const now = Date.now();
    const cached = this.elementUrlCache.get(cacheKey);
    if (cached && now - cached.ts < this.elementUrlTtlMs) {
      this.elementUrlCache.delete(cacheKey);
      this.elementUrlCache.set(cacheKey, cached);
      return cached.value;
    }

    if (this.elementUrlInFlight.has(cacheKey)) {
      return this.elementUrlInFlight.get(cacheKey);
    }

    const run = (async () => {
      const raw = await this.getElementUrl(id, list);
      const urls = raw && typeof raw === 'object'
        ? (raw.urls && typeof raw.urls === 'object' ? raw.urls : raw)
        : {};

      const normalized = {
        images: String(urls.images || '').trim() || null,
        thumbnails: String(urls.thumbnails || '').trim() || null,
        resizedVideosTiny: String(urls['resized-videos-tiny'] || urls.resizedVideosTiny || '').trim() || null,
      };

      this.elementUrlCache.set(cacheKey, { value: normalized, ts: Date.now() });
      while (this.elementUrlCache.size > this.elementUrlCacheMax) {
        const oldestKey = this.elementUrlCache.keys().next().value;
        if (oldestKey === undefined) break;
        this.elementUrlCache.delete(oldestKey);
      }

      return normalized;
    })();

    this.elementUrlInFlight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      this.elementUrlInFlight.delete(cacheKey);
    }
  }

  async getField(id, fields = ['epoch']) {
    if (!id) throw new APIError('id is required', 400);
    const list = (Array.isArray(fields) ? fields : [fields]).map((f) => String(f).trim()).filter(Boolean);
    if (list.length === 0) throw new APIError('field is required', 400);

    const params = new URLSearchParams();
    params.set('id', String(id));
    list.forEach((f) => params.append('field', f));

    const response = await this.#makeRequest(`${this.baseUrl}/field?${params.toString()}`, {
      retries: 2
    });
    return response.json();
  }

  // Video Keyframes API
  // Returns Array<{ imgId: string, timestamp: number | null }>
  // timestamp = video_offset_seconds (seconds from the start of the video).
  async getVideoKeyframes(videoId) {
    if (!videoId) {
      throw new APIError('VideoId is required', 400);
    }

    const normalizedVideoId = this.#normalizeVideoId(videoId);

    // New API: /field?select_field=hour_id&select_value=<videoId>&field=content&field=video_offset_seconds
    try {
      const params = new URLSearchParams();
      params.set('select_field', 'hour_id');
      params.set('select_value', normalizedVideoId);
      params.append('field', 'content');
      params.append('field', 'video_offset_seconds');

      const response = await this.#makeRequest(`${this.baseUrl}/field?${params.toString()}`, {
        retries: 2
      });

      const data = await response.json();

      if (Array.isArray(data)) {
        return data
          .filter((item) => item?.content)
          .map((item) => {
            const offset = Number(item.video_offset_seconds);
            return {
              imgId: String(item.content),
              timestamp: Number.isFinite(offset) && offset >= 0 ? offset : null
            };
          });
      }
    } catch {
      // Fall back to legacy endpoint below.
    }

    // Legacy fallback for older deployments (returns only imgIds, no timestamp).
    const legacyUrl = `${this.baseUrl}/core/getAllVideoKeyframes?videoId=${encodeURIComponent(normalizedVideoId)}`;
    const legacyResponse = await this.#makeRequest(legacyUrl, {
      retries: 2
    });
    const legacyData = await legacyResponse.json();

    if (!Array.isArray(legacyData)) {
      throw new APIError('Invalid response: expected array', 500);
    }

    return legacyData
      .map((v) => String(v))
      .filter(Boolean)
      .map((imgId) => ({ imgId, timestamp: null }));
  }

  // Health check API (opzionale)
  async healthCheck() {
    try {
      const response = await this.#makeRequest(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'error', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  #buildSearchPayload(activeTextareas) {
    const queryItems = activeTextareas.flatMap((t) => this.#expandTextareaToItems(t));
    if (queryItems.length === 0) {
      throw new APIError('No valid query items', 400);
    }

    if (queryItems.length === 1) {
      const item = queryItems[0];
      const defaultModel = item.type === 'image' ? this.defaultImageModel : this.defaultTextModel;
      return {
        query: {
          item: item.value,
          model: item.model || defaultModel,
          k: this.defaultSingleK
        },
        urls_to_retrieve: ['images', 'thumbnails', 'videos'],
        metadata_to_retrieve: this.defaultMetadataToRetrieve
      };
    }

    return {
      query: {
        item: queryItems.map((item) => {
          const defaultModel = item.type === 'image' ? this.defaultImageModel : this.defaultTextModel;
          return {
            item: item.value,
            model: item.model || defaultModel,
            k: this.defaultSubqueryK
          };
        }),
        aggregation_type: 'temporal',
        window_seconds: this.defaultTemporalWindowSeconds,
        k: this.defaultAggregatedK
      },
      urls_to_retrieve: ['images', 'thumbnails', 'videos'],
      metadata_to_retrieve: this.defaultMetadataToRetrieve
    };
  }

  #expandTextareaToItems(textarea) {
    const raw = String(textarea?.value || '').trim();
    const similarityImgId = String(textarea?.similarityImgId || '').trim();
    const model = String(textarea?.model || '').trim();
    const out = [];

    if (similarityImgId) {
      out.push({ type: 'image', value: `image:${similarityImgId}`, model });
    }

    if (raw) {
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.startsWith('similarity:')) {
        const legacyId = raw.slice('similarity:'.length).trim();
        if (legacyId) {
          out.push({ type: 'image', value: `image:${legacyId}`, model });
        }
      } else if (lowerRaw.startsWith('image:')) {
        out.push({ type: 'image', value: raw, model });
      } else {
        out.push({ type: 'text', value: raw, model });
      }
    }

    return out;
  }
}

// Export singleton instance
export const visioneAPI = new VisioneAPI();
export { APIError };
