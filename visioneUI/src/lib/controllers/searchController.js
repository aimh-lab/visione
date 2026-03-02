// src/lib/controllers/searchController.js
export function createSearchController({
  api,                    // visioneAPI
  recentSearches,
  toasts,
  transformSearchResults,
  tick,

  // data accessors
  getTextareas,
  setTextareas,
  getFramesPerRow,        // () => number
  getSubmittedIds,        // () => Set<string>

  // state sinks
  setSearchState,         // ({ loading?, error?, resultSet?, searchTime? }) => void
  setImages,              // (images) => void

  // URL sync
  isRestoringFromHistory, // () => boolean
  syncURL                 // () => void
}) {
  let reqId = 0;
  let debounceTimer = null;
  const DEBOUNCE_MS = 250;

  function runSearch() {
    return new Promise((resolve) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        resolve(_doSearch());
      }, DEBOUNCE_MS);
    });
  }

  /** Bypass debounce — used by internal programmatic calls that already waited. */
  function runSearchImmediate() {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    return _doSearch();
  }

  async function _doSearch() {
    const textareas = getTextareas();
    if (!textareas?.length) return;

    const req = ++reqId;

    setSearchState({ loading: true, error: null });

    const query = textareas
      .filter(t => t.enabled && t.value?.trim())
      .map(t => t.value.trim())
      .join(' ');

    const start = Date.now();

    // 1) Cache
    const cached = recentSearches.find(query);
    if (cached?.results) {
      if (req !== reqId) return;

      if (cached.textareas?.length && isRestoringFromHistory()) {
        setTextareas(cached.textareas.map(t => ({ ...t })));
      }

      setSearchState({
        resultSet: cached.results,
        searchTime: Date.now() - start,
        loading: false,
        error: null
      });

      const submittedIds = getSubmittedIds();
      const transformed = transformSearchResults(cached.results, submittedIds);
      setImages(transformed);

      await tick();
      if (!isRestoringFromHistory()) syncURL();

      toasts.success(`📦 Loaded ${transformed.length} cached results!`);
      return;
    }

    // 2) API
    try {
      const framesPerRow = getFramesPerRow();

      const resultSet = await api.search({
        textareas,
        simReorder: false,
        framesPerRow
      });

      if (req !== reqId) return;

      setSearchState({
        resultSet,
        searchTime: Date.now() - start,
        loading: false,
        error: null
      });

      const submittedIds = getSubmittedIds();
      const transformed = transformSearchResults(resultSet, submittedIds);
      setImages(transformed);

      await tick();
      if (!isRestoringFromHistory()) syncURL();

      if (query && transformed.length > 0) {
        recentSearches.add(query, transformed.length, resultSet, textareas);
        toasts.success(`🌐 Found ${transformed.length} new results!`);
      } else {
        toasts.warning('No results found. Try different keywords.');
      }
    } catch (err) {
      if (req !== reqId) return;

      setSearchState({
        resultSet: null,
        loading: false,
        error: err?.message ?? String(err)
      });

      toasts.error(`Search failed: ${err?.message ?? String(err)}`);
    }
  }

  return { runSearch, runSearchImmediate };
}
