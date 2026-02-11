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
  constructor(baseUrl = 'https://visione.isti.cnr.it:41000/services', videosBase = 'https://visione.isti.cnr.it:41000/videos') {
    this.baseUrl = baseUrl;
    this.videosBase = videosBase;
  }

  // ... #makeRequest e metodi esistenti ...

  async getMiddleTimestamp(imgId) {
    if (!imgId) throw new APIError('imgId richiesto', 400);
    const url = `${this.baseUrl}/core/getMiddleTimestamp?id=${encodeURIComponent(imgId)}`;
    const res = await this.#makeRequest(url, { retries: 1, timeout: 15000 });
    const text = await res.text();
    const num = Number(text);
    if (!Number.isFinite(num)) throw new APIError(`Risposta non numerica: ${text}`, 500);
    return num;
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
      throw new APIError('Almeno una textarea deve essere abilitata e contenere testo', 400);
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
      throw new APIError('BaseImgId è richiesto per similarity search', 400);
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
      throw new APIError('VideoId è richiesto', 400);
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
