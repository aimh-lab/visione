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

      // New API contract: /field?id=...&field=...
      try {
        const metadata = await this.getField(imgId, ['middle_timestamp', 'middleTimestamp', 'timestamp', 'epoch']);
        const candidate = Number(
          metadata?.middle_timestamp
            ?? metadata?.middleTimestamp
            ?? metadata?.timestamp
            ?? metadata?.epoch
        );
        if (Number.isFinite(candidate)) {
          num = candidate;
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
    const vid = String(videoId).padStart(5, '0');
    return `${this.videosBase}/${vid}-${quality}.mp4`;
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

    const response = await this.#makeRequest(this.searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 2
    });

    return response.json();
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
      urls_to_retrieve: ['images', 'thumbnails', 'videos']
    };

    const response = await this.#makeRequest(this.searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 2
    });

    return response.json();
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
  async getVideoKeyframes(videoId) {
    if (!videoId) {
      throw new APIError('VideoId is required', 400);
    }

    const url = `${this.baseUrl}/core/getAllVideoKeyframes?videoId=${encodeURIComponent(String(videoId))}`;
    
    const response = await this.#makeRequest(url, {
      retries: 2
    });
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new APIError('Invalid response: expected array', 500);
    }
    
    return data;
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
      return {
        query: {
          item: item.value,
          model: item.type === 'image' ? this.defaultImageModel : this.defaultTextModel,
          k: this.defaultSingleK
        },
        urls_to_retrieve: ['images', 'thumbnails', 'videos']
      };
    }

    return {
      query: {
        item: queryItems.map((item) => ({
          item: item.value,
          model: item.type === 'image' ? this.defaultImageModel : this.defaultTextModel,
          k: this.defaultSubqueryK
        })),
        aggregation_type: 'temporal',
        window_seconds: this.defaultTemporalWindowSeconds,
        k: this.defaultAggregatedK
      },
      urls_to_retrieve: ['images', 'thumbnails', 'videos']
    };
  }

  #expandTextareaToItems(textarea) {
    const raw = String(textarea?.value || '').trim();
    const similarityImgId = String(textarea?.similarityImgId || '').trim();
    const out = [];

    if (similarityImgId) {
      out.push({ type: 'image', value: `image:${similarityImgId}` });
    }

    if (raw) {
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.startsWith('similarity:')) {
        const legacyId = raw.slice('similarity:'.length).trim();
        if (legacyId) {
          out.push({ type: 'image', value: `image:${legacyId}` });
        }
      } else if (lowerRaw.startsWith('image:')) {
        out.push({ type: 'image', value: raw });
      } else {
        out.push({ type: 'text', value: raw });
      }
    }

    return out;
  }
}

// Export singleton instance
export const visioneAPI = new VisioneAPI();
export { APIError };
