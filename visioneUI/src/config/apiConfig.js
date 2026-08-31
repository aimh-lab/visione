// src/config/apiConfig.js
//
// Centralised network tuning knobs for the VisioneAPI client (src/services/api.js):
// request timeouts, retry counts and in-memory cache sizes/TTLs. Previously these
// were scattered as unnamed magic numbers across dozens of individual #makeRequest
// calls, making it unclear (e.g.) why discovery used a 12s timeout while
// getMiddleTimestamp used 15s, or what the difference between the various
// `retries: 0/1/2` calls was meant to convey.

export const API_CONFIG = {
  // Fallback timeout/retries applied by #makeRequest() when a call site doesn't
  // pass its own value.
  DEFAULT_TIMEOUT_MS: 30000,
  DEFAULT_RETRIES: 1,

  // Exponential backoff between retry attempts (ms): attempt N waits
  // RETRY_BACKOFF_BASE_MS * 2^N.
  RETRY_BACKOFF_BASE_MS: 1000,

  // /discovery (core)
  DISCOVERY_RETRIES: 2,

  // /discovery (dataserver)
  DATASERVER_DISCOVERY_TIMEOUT_MS: 12000,
  DATASERVER_DISCOVERY_RETRIES: 1,

  // Legacy /core/getMiddleTimestamp fallback (new API returns the field directly)
  LEGACY_MIDDLE_TIMESTAMP_TIMEOUT_MS: 15000,
  LEGACY_MIDDLE_TIMESTAMP_RETRIES: 1,

  // /search and /field
  SEARCH_RETRIES: 2,
  FIELD_RETRIES: 2,

  // /health
  HEALTH_CHECK_TIMEOUT_MS: 5000,

  // /qa streaming (SSE): no timeout since the stream is long-lived, and no
  // retries since resubmitting would duplicate the question server-side.
  QA_STREAM_RETRIES: 0,
  QA_STREAM_TIMEOUT_MS: 0,
  QA_CANCEL_TIMEOUT_MS: 10000,
  QA_CANCEL_RETRIES: 0,

  // /translate
  TRANSLATE_TIMEOUT_MS: 10000,
  TRANSLATE_RETRIES: 1,

  // In-memory LRU-ish caches: max entries kept and time-to-live per entry.
  MIDDLE_TIMESTAMP_CACHE_MAX: 500,
  MIDDLE_TIMESTAMP_CACHE_TTL_MS: 5 * 60 * 1000,
  ELEMENT_URL_CACHE_MAX: 3000,
  ELEMENT_URL_CACHE_TTL_MS: 10 * 60 * 1000,
  TRANSLATION_CACHE_MAX: 1000,
  TRANSLATION_CACHE_TTL_MS: 30 * 60 * 1000
};
