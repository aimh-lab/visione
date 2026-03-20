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
  getSimilarityPreview,   // (textareas) => { imgId?, url?, name? } | null

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

  function assertUniqueImageIds(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    const seen = new Map();
    for (let i = 0; i < items.length; i += 1) {
      const id = String(items[i]?.imgId ?? '').trim();
      if (!id) continue;
      if (seen.has(id)) {
        const firstIndex = seen.get(id);
        throw new Error(`Duplicate image id in search results: ${id} (indexes ${firstIndex} and ${i})`);
      }
      seen.set(id, i);
    }
  }

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
      .filter((t) => {
        const text = String(t?.value || '').trim();
        const simId = String(t?.similarityImgId || '').trim();
        return !!t?.enabled && (text.length > 0 || simId.length > 0);
      })
      .map((t) => {
        const text = String(t?.value || '').trim();
        const simId = String(t?.similarityImgId || '').trim();
        const model = String(t?.model || '').trim();
        let part = '';
        if (simId && text) part = `sim:${simId} text:${text}`;
        else if (simId) part = `sim:${simId}`;
        else part = text;
        return model ? `${part} model:${model}` : part;
      })
      .join(' ');

    const start = Date.now();

    // 1) Cache
    try {
      const cached = recentSearches.find(query);
      if (cached?.results) {
        if (req !== reqId) return;

        if (cached.textareas?.length && isRestoringFromHistory()) {
          setTextareas(cached.textareas.map(t => ({ ...t })));
        }

        const submittedIds = getSubmittedIds();
        const transformed = transformSearchResults(cached.results, submittedIds);
        assertUniqueImageIds(transformed);

        setSearchState({
          resultSet: cached.results,
          searchTime: Date.now() - start,
          loading: false,
          error: null
        });

        setImages(transformed);

        await tick();
        if (!isRestoringFromHistory()) syncURL();

        toasts.success(`📦 Loaded ${transformed.length} cached results!`);
        return;
      }

      // 2) API
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
      assertUniqueImageIds(transformed);
      setImages(transformed);

      await tick();
      if (!isRestoringFromHistory()) syncURL();

      if (query && transformed.length > 0) {
        const similarityPreview = typeof getSimilarityPreview === 'function'
          ? getSimilarityPreview(textareas)
          : null;
        recentSearches.add(query, transformed.length, resultSet, textareas, similarityPreview);
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
