// src/lib/fallbackWarn.js
//
// Shared logger for "silent fallback" code paths: places where a value could
// not be resolved/validated as expected and the code substitutes a default
// instead of failing loudly. These are exactly the kind of thing that hides
// subtle bugs (wrong dataset assumption, malformed persisted state, backend
// response shape mismatch) behind a plausible-looking result.
//
// Every call site logs every time it fires (no dedup/throttling) — if a
// specific site turns out to be too noisy in practice (e.g. a fallback that
// fires once per row in a large result set), tighten or remove that specific
// call rather than muting this helper globally.

export function warnFallback(id, message, details) {
  if (details !== undefined) {
    console.warn(`[fallback:${id}] ${message}`, details);
  } else {
    console.warn(`[fallback:${id}] ${message}`);
  }
}
