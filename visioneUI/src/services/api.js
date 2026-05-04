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
    this.defaultRelevanceFeedbackModel = 'qwen_embedding_8B';
    this.defaultMetadataToRetrieve = ['hour_id'];
    this.supportsVideos = true;
    this.elementUrlCache = new Map();
    this.elementUrlInFlight = new Map();
    this.elementUrlCacheMax = 3000;
    this.elementUrlTtlMs = 10 * 60 * 1000;
    this.discoveryCache = null;
    this.discoveryInFlight = null;
    this.translationCache = new Map();
    this.translationInFlight = new Map();
    this.translationCacheMax = 1000;
    this.translationCacheTtlMs = 30 * 60 * 1000;
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
    return String(videoId || '');
  }

  // ... #makeRequest e metodi esistenti ...

  async getMiddleTimestamp(imgId) {
    if (!imgId) throw new APIError('imgId is required', 400);

    // Collection has no videos: avoid requesting video-only timing fields.
    if (!this.supportsVideos) {
      return 0;
    }

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

      // Preferred metadata: hour_msb_middletime, fallback to video_offset_seconds.
      try {
        const metadata = await this.getField(imgId, ['hour_msb_middletime', 'video_offset_seconds']);
        const middle = Number(metadata?.hour_msb_middletime);
        const offset = Number(metadata?.video_offset_seconds);
        if (Number.isFinite(middle) && middle >= 0) {
          num = middle;
        } else if (Number.isFinite(offset) && offset >= 0) {
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

  setSupportsVideos(enabled) {
    this.supportsVideos = Boolean(enabled);
  }

  getThumbnailUrlByImgId(imgId, videoId = '') {
    const rawId = String(imgId || '').trim();
    if (!rawId) return null;

    const rawVideoId = String(videoId || '').trim();
    if (rawVideoId) {
      return `${this.baseUrl}/thumbnails/${rawVideoId}/${rawId}`;
    }

    const hour = rawId.match(/^(\d{8}_\d{2})\d{4}_\d{3}(?:\.[^./]+)?$/i)?.[1] || '';
    if (!hour) return null;
    return `${this.baseUrl}/thumbnails/${hour}/${rawId}`;
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
        // Exponential backoff for each retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Search API
  async search({ textareas, relevanceFeedback = null, simReorder = false, framesPerRow = 5, temporalWindowSeconds = undefined }) {
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

    const payload = this.#buildSearchPayload(activeTextareas, temporalWindowSeconds);
    const normalizedRF = this.#buildRelevanceFeedback(relevanceFeedback);
    if (normalizedRF) {
      payload.relevance_feedback = normalizedRF;
    }
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
      urls_to_retrieve: this.#buildUrlsToRetrieve(),
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

  async getElementUrlsBatch(ids = [], what = ['images']) {
    const normalizedIds = (Array.isArray(ids) ? ids : [ids])
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    if (normalizedIds.length === 0) throw new APIError('ids is required', 400);

    const list = (Array.isArray(what) ? what : [what]).map((w) => String(w).trim()).filter(Boolean);
    if (list.length === 0) throw new APIError('what is required', 400);

    const response = await this.#makeRequest(`${this.baseUrl}/element-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: normalizedIds,
        what: list
      }),
      retries: 2
    });

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new APIError('Invalid response from /element-url: expected array', 500);
    }

    return payload;
  }

  async getElementUrl(id, what = ['images']) {
    if (!id) throw new APIError('id is required', 400);
    const list = (Array.isArray(what) ? what : [what]).map((w) => String(w).trim()).filter(Boolean);
    if (list.length === 0) throw new APIError('what is required', 400);

    const rows = await this.getElementUrlsBatch([id], list);
    const normalizedId = String(id).trim();
    return rows.find((row) => String(row?.id || '').trim() === normalizedId) || rows[0] || null;
  }

  async getElementUrls(id, what = ['images', 'thumbnails']) {
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
      const urls = raw && typeof raw === 'object' ? raw : {};

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
  // New API only returns image_name; timestamp is null and may be resolved later.
  async getVideoKeyframes(videoId) {
    if (!videoId) {
      throw new APIError('VideoId is required', 400);
    }

    const normalizedVideoId = this.#normalizeVideoId(videoId);

    // New API: /field?select_field=hour_id&select_value=<videoId>&field=image_name
    const params = new URLSearchParams();
    params.set('select_field', 'hour_id');
    params.set('select_value', normalizedVideoId);
    params.append('field', 'image_name');

    const response = await this.#makeRequest(`${this.baseUrl}/field?${params.toString()}`, {
      retries: 2
    });

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new APIError('Invalid response from /field: expected array', 500);
    }

    return data
      .filter((item) => item?.image_name)
      .map((item) => {
        return {
          imgId: String(item.image_name),
          timestamp: null
        };
      });
  }

  // Health check API (optional)
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

  async translateText(text, { target = 'en', source = 'auto' } = {}) {
    const raw = String(text || '').trim();
    if (!raw) return raw;

    const cacheKey = `${source}|${target}|${raw}`;
    const now = Date.now();
    const cached = this.translationCache.get(cacheKey);
    if (cached && now - cached.ts < this.translationCacheTtlMs) {
      this.translationCache.delete(cacheKey);
      this.translationCache.set(cacheKey, cached);
      return cached.value;
    }

    if (this.translationInFlight.has(cacheKey)) {
      return this.translationInFlight.get(cacheKey);
    }

    const run = (async () => {
      const translated = await this.#translateTextRequest(raw, { target, source });
      this.translationCache.set(cacheKey, { value: translated, ts: Date.now() });
      while (this.translationCache.size > this.translationCacheMax) {
        const oldestKey = this.translationCache.keys().next().value;
        if (oldestKey === undefined) break;
        this.translationCache.delete(oldestKey);
      }
      return translated;
    })();

    this.translationInFlight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      this.translationInFlight.delete(cacheKey);
    }
  }

  async #translateTextRequest(raw, { target, source }) {
    const endpoint = `${this.baseUrl}/translate`;

    const response = await this.#makeRequest(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: raw,
        source_language: source,
        target_language: target
      }),
      retries: 1,
      timeout: 10000
    });

    return await this.#extractTranslatedText(response, raw);
  }

  async #extractTranslatedText(response, fallbackRaw) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const plain = String(await response.text() || '').trim();
      return plain || fallbackRaw;
    }

    const data = await response.json();
    const translated = this.#readTranslatedTextFromPayload(data, fallbackRaw);
    return translated || fallbackRaw;
  }

  #readTranslatedTextFromPayload(payload, fallbackRaw) {
    if (typeof payload === 'string') {
      const direct = payload.trim();
      return direct || fallbackRaw;
    }

    if (!payload || typeof payload !== 'object') {
      return fallbackRaw;
    }

    const candidates = [
      payload.translated_text,
      payload.translatedText,
      payload.translation,
      payload.translated,
      payload.english,
      payload.result,
      payload.text
    ];

    for (const value of candidates) {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
    }

    const nested = payload.data;
    if (nested && typeof nested === 'object') {
      return this.#readTranslatedTextFromPayload(nested, fallbackRaw);
    }

    return fallbackRaw;
  }

  #buildSearchPayload(activeTextareas, temporalWindowSeconds = undefined) {
    const textareaNodes = activeTextareas
      .map((t) => this.#buildTextareaQueryNode(t, this.defaultSubqueryK, this.defaultSubqueryK))
      .filter(Boolean);

    if (textareaNodes.length === 0) {
      throw new APIError('No valid query items', 400);
    }

    if (textareaNodes.length === 1) {
      const singleTextareaNode = this.#buildTextareaQueryNode(
        activeTextareas[0],
        this.defaultSingleK,
        this.defaultSingleK
      );

      if (!singleTextareaNode) {
        throw new APIError('No valid query items', 400);
      }

      const metadataToRetrieve = this.#buildMetadataToRetrieve(singleTextareaNode);

      return {
        query: singleTextareaNode,
        urls_to_retrieve: this.#buildUrlsToRetrieve(),
        metadata_to_retrieve: metadataToRetrieve
      };
    }

    const safeTemporalWindowSeconds = Number.isFinite(Number(temporalWindowSeconds))
      ? Math.min(99999, Math.max(1, Number(temporalWindowSeconds)))
      : this.defaultTemporalWindowSeconds;

    const temporalQuery = {
      query: {
        item: textareaNodes,
        aggregation_type: 'temporal',
        window_seconds: safeTemporalWindowSeconds,
        k: this.defaultAggregatedK
      },
      urls_to_retrieve: this.#buildUrlsToRetrieve()
    };

    const metadataToRetrieve = this.#buildMetadataToRetrieve(temporalQuery.query);

    return {
      ...temporalQuery,
      metadata_to_retrieve: metadataToRetrieve
    };
  }

  #buildTextareaQueryNode(textarea, leafK, groupK) {
    const queryItems = this.#expandTextareaToItems(textarea);
    if (queryItems.length === 0) return null;

    const subqueries = queryItems.map((item) => {
      const defaultModel = item.type === 'image' ? this.defaultImageModel : this.defaultTextModel;
      const node = {
        item: item.value,
        model: item.model || defaultModel,
        k: leafK
      };

      if (item.filters && Array.isArray(item.filters.arguments) && item.filters.arguments.length > 0) {
        node.filters = item.filters;
      }

      return node;
    });

    if (subqueries.length === 1) {
      return subqueries[0];
    }

    return {
      item: subqueries,
      aggregation_type: 'rrf',
      k: groupK
    };
  }

  #buildUrlsToRetrieve() {
    return this.supportsVideos
      ? ['images', 'thumbnails', 'videos']
      : ['images', 'thumbnails'];
  }

  #expandTextareaToItems(textarea) {
    const raw = String(textarea?.value || '').trim();
    const { cleanText, filters } = this.#extractFiltersFromRawQuery(raw);
    const similarityImgId = String(textarea?.similarityImgId || '').trim();
    const legacyModel = String(textarea?.model || '').trim();
    const textModel = String(textarea?.textModel || legacyModel || '').trim();
    const imageModel = String(textarea?.imageModel || legacyModel || '').trim();
    const out = [];

    if (similarityImgId) {
      out.push({ type: 'image', value: `image:${similarityImgId}`, model: imageModel, filters });
    }

    if (cleanText) {
      const lowerRaw = cleanText.toLowerCase();
      if (lowerRaw.startsWith('similarity:')) {
        const legacyId = cleanText.slice('similarity:'.length).trim();
        if (legacyId) {
          out.push({ type: 'image', value: `image:${legacyId}`, model: imageModel, filters });
        }
      } else if (lowerRaw.startsWith('image:')) {
        out.push({ type: 'image', value: cleanText, model: imageModel, filters });
      } else {
        out.push({ type: 'text', value: cleanText, model: textModel, filters });
      }
    }

    return out;
  }

  #buildMetadataToRetrieve(queryNode) {
    const defaults = Array.isArray(this.defaultMetadataToRetrieve)
      ? this.defaultMetadataToRetrieve.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const fromFilters = Array.from(this.#collectFilterAttributes(queryNode));
    return Array.from(new Set([...defaults, ...fromFilters]));
  }

  #collectFilterAttributes(queryNode) {
    const out = new Set();

    const walk = (node) => {
      if (!node || typeof node !== 'object') return;

      const args = node?.filters?.arguments;
      if (Array.isArray(args)) {
        for (const arg of args) {
          const attr = String(arg?.attribute || '').trim();
          if (attr) out.add(attr);
        }
      }

      const item = node?.item;
      if (Array.isArray(item)) {
        item.forEach((sub) => walk(sub));
      }
    };

    walk(queryNode);
    return out;
  }

  #extractFiltersFromRawQuery(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return { cleanText: '', filters: null };

    const tokenPattern = /[^\s:]+:"[^"]*"|[^\s:]+:'[^']*'|\S+/g;
    const tokens = text.match(tokenPattern) || [];
    const passthroughTokens = [];
    const args = [];

    for (const token of tokens) {
      const firstColon = token.indexOf(':');
      if (firstColon <= 0) {
        passthroughTokens.push(token);
        continue;
      }

      const rawKey = token.slice(0, firstColon).trim();
      const rawValue = token.slice(firstColon + 1).trim();
      const parsed = this.#parseFilterToken(rawKey, rawValue);

      if (!parsed || !Array.isArray(parsed.arguments) || parsed.arguments.length === 0) {
        passthroughTokens.push(token);
        continue;
      }

      args.push(...parsed.arguments);
    }

    const cleanText = passthroughTokens.join(' ').replace(/\s+/g, ' ').trim();
    if (args.length === 0) return { cleanText: text, filters: null };

    return {
      cleanText,
      filters: {
        operator: 'and',
        arguments: args
      }
    };
  }

  #parseFilterToken(key, rawValue) {
    const alias = String(key || '').trim().toLowerCase();
    const value = this.#unquoteValue(rawValue);
    if (!value) return null;

    const numericShortcuts = {
      y: 'year',
      year: 'year',
      m: 'month',
      month: 'month',
      d: 'day',
      day: 'day',
      h: 'hour',
      hour: 'hour',
      hr: 'heart_rate_bpm',
      heart_rate_bpm: 'heart_rate_bpm'
    };

    const textShortcuts = {
      semantic: 'semantic_name',
      sem: 'semantic_name',
      semantic_name: 'semantic_name',
      new_semantic_name: 'new_semantic_name',
      ns: 'new_semantic_name',
      type: 'type'
    };

    if (alias === 'date') {
      const dateArgs = this.#parseDateFilterArguments(value);
      return dateArgs.length > 0 ? { arguments: dateArgs } : null;
    }

    if (Object.prototype.hasOwnProperty.call(numericShortcuts, alias)) {
      const attribute = numericShortcuts[alias];
      const parsed = this.#extractComparatorValue(value, 'eq');
      const numericValue = Number(parsed.value);
      if (!Number.isFinite(numericValue)) return null;
      return {
        arguments: [{ comparator: parsed.comparator, attribute, value: numericValue }]
      };
    }

    if (Object.prototype.hasOwnProperty.call(textShortcuts, alias)) {
      const attribute = textShortcuts[alias];
      const parsed = this.#extractComparatorValue(value, attribute === 'type' ? 'eq' : 'ilike');
      const normalized = this.#normalizeTextFilterValue(parsed.value, parsed.comparator);
      if (!normalized) return null;
      return {
        arguments: [{ comparator: parsed.comparator, attribute, value: normalized }]
      };
    }

    return null;
  }

  #unquoteValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1).trim();
    }
    return raw;
  }

  #extractComparatorValue(raw, fallbackComparator) {
    const value = String(raw || '').trim();
    if (!value) return { comparator: fallbackComparator, value: '' };

    const namedMatch = value.match(/^(eq|ne|lt|gt|egt|elt|like|ilike):(.*)$/i);
    if (namedMatch) {
      return { comparator: namedMatch[1].toLowerCase(), value: this.#unquoteValue(namedMatch[2]) };
    }

    const symbolicMatch = value.match(/^(>=|<=|!=|>|<|=|~)(.*)$/);
    if (symbolicMatch) {
      const symbol = symbolicMatch[1];
      const mapped = symbol === '>'
        ? 'gt'
        : symbol === '>='
          ? 'egt'
        : symbol === '<'
          ? 'lt'
          : symbol === '<='
            ? 'elt'
          : symbol === '!='
            ? 'ne'
            : symbol === '~'
              ? (String(fallbackComparator || '').trim().toLowerCase() === 'like' ? 'like' : 'ilike')
              : 'eq';
      return { comparator: mapped, value: this.#unquoteValue(symbolicMatch[2]) };
    }

    return { comparator: fallbackComparator, value: this.#unquoteValue(value) };
  }

  #normalizeTextFilterValue(rawValue, comparator) {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    if (comparator === 'like' || comparator === 'ilike') {
      const withoutBoundaryPercents = value.replace(/^%+|%+$/g, '');
      const core = withoutBoundaryPercents || value.replace(/%/g, '');
      return `%${core}%`;
    }
    return value;
  }

  #parseDateFilterArguments(rawValue) {
    const input = String(rawValue || '').trim();
    if (!input) return [];

    if (input.includes('..')) {
      const [fromRaw, toRaw] = input.split('..', 2);
      const from = this.#toEpochStart(fromRaw);
      const to = this.#toEpochEnd(toRaw);
      const out = [];
      if (Number.isFinite(from)) out.push({ comparator: 'gt', attribute: 'epoch', value: Math.floor(from) - 1 });
      if (Number.isFinite(to)) out.push({ comparator: 'lt', attribute: 'epoch', value: Math.floor(to) + 1 });
      return out;
    }

    const parsed = this.#extractComparatorValue(input, 'eq');
    const comparator = parsed.comparator;
    const value = parsed.value;
    const start = this.#toEpochStart(value);
    const end = this.#toEpochEnd(value);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return [];
    }

    if (comparator === 'eq') {
      return [
        { comparator: 'gt', attribute: 'epoch', value: Math.floor(start) - 1 },
        { comparator: 'lt', attribute: 'epoch', value: Math.floor(end) + 1 }
      ];
    }

    if (comparator === 'ne') {
      return [{ comparator: 'ne', attribute: 'epoch', value: Math.floor(start) }];
    }

    if (comparator === 'gt') {
      return [{ comparator: 'gt', attribute: 'epoch', value: Math.floor(end) }];
    }

    if (comparator === 'lt') {
      return [{ comparator: 'lt', attribute: 'epoch', value: Math.floor(start) }];
    }

    return [];
  }

  #toEpochStart(rawDate) {
    const normalized = String(rawDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return NaN;
    const epochMs = Date.parse(`${normalized}T00:00:00Z`);
    if (!Number.isFinite(epochMs)) return NaN;
    return Math.floor(epochMs / 1000);
  }

  #toEpochEnd(rawDate) {
    const normalized = String(rawDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return NaN;
    const epochMs = Date.parse(`${normalized}T23:59:59Z`);
    if (!Number.isFinite(epochMs)) return NaN;
    return Math.floor(epochMs / 1000);
  }

  #buildRelevanceFeedback(config) {
    if (!config || typeof config !== 'object') return null;

    const positiveIds = Array.from(new Set(
      (Array.isArray(config.positiveIds) ? config.positiveIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ));

    const negativeIds = Array.from(new Set(
      (Array.isArray(config.negativeIds) ? config.negativeIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ));

    if (positiveIds.length === 0 && negativeIds.length === 0) return null;

    const method = String(config.method || '').trim().toLowerCase() === 'rocchio'
      ? 'rocchio'
      : 'svm';

    const model = String(config.model || this.defaultRelevanceFeedbackModel).trim()
      || this.defaultRelevanceFeedbackModel;

    const explicitAdditional = Number(config.numAdditionalNegatives);
    const hasExplicitAdditional = Number.isFinite(explicitAdditional) && explicitAdditional >= 0;
    const fallbackAdditional = negativeIds.length === 0 ? 4 : 0;

    const out = {
      positive_ids: positiveIds,
      model,
      method
    };

    if (negativeIds.length > 0) {
      out.negative_ids = negativeIds;
    }

    if (hasExplicitAdditional) {
      out.num_additional_negatives = Math.floor(explicitAdditional);
    } else if (fallbackAdditional > 0) {
      out.num_additional_negatives = fallbackAdditional;
    }

    return out;
  }
}

// Export singleton instance
export const visioneAPI = new VisioneAPI();
export { APIError };
