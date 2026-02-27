// src/services/api.js
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
  constructor(baseUrl = 'https://visione.isti.cnr.it/services', videosBase = 'https://visione.isti.cnr.it/videos') {
    this.baseUrl = baseUrl;
    this.videosBase = videosBase;
    this.middleTimestampCache = new Map();
    this.middleTimestampInFlight = new Map();
    this.middleTimestampCacheMax = 500;
    this.middleTimestampTtlMs = 5 * 60 * 1000;
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
    const url = `${this.baseUrl}/core/getMiddleTimestamp?id=${encodeURIComponent(imgId)}`;
    const res = await this.#makeRequest(url, { retries: 1, timeout: 15000 });
    const text = await res.text();
    const num = Number(text);
    if (!Number.isFinite(num)) throw new APIError(`Non-numeric response: ${text}`, 500);

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
    const activeTextareas = textareas.filter(t => t.enabled && t.value.trim());
    
    if (activeTextareas.length === 0) {
      throw new APIError('At least one textarea must be enabled and contain text', 400);
    }
    
    const queries = activeTextareas.map(t => ({ textual: t.value.trim() }));
    const parameters = activeTextareas.map(() => ({ textualMode: "all" }));
    const payload = { query: queries, parameters };
    
    const form = new URLSearchParams();
    form.append("query", JSON.stringify(payload));
    form.append("simreorder", String(simReorder));
    form.append("n_frames_per_row", String(framesPerRow));

    const response = await this.#makeRequest(`${this.baseUrl}/core/search`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
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
      query: [{ comboVisualSim: baseImgId }], 
      parameters: [{ simReorder: "true" }] 
    };
    
    const form = new URLSearchParams();
    form.append("query", JSON.stringify(payload));

    const response = await this.#makeRequest(`${this.baseUrl}/core/search`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
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
}

// Export singleton instance
export const visioneAPI = new VisioneAPI();
export { APIError };
