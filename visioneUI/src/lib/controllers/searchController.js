// src/lib/controllers/searchController.js
export function createSearchController({
  api,                    // visioneAPI
  recentSearches,
  toasts,
  transformSearchResults,
  tick,

  // data accessors
  getTextareas,
  getSearchTextareas,
  setTextareas,
  getFramesPerRow,        // () => number
  getCacheEnabled,        // () => boolean
  getAutoTranslateEnabled,// () => boolean
  getTemporalWindowSeconds, // () => number
  getSubmittedIds,        // () => Set<string>
  getSimilarityPreview,   // (textareas) => { imgId?, url?, name? } | null
  getRelevanceFeedback,   // () => { positiveIds, negativeIds, method, model?, numAdditionalNegatives? } | null

  // state sinks
  setSearchState,         // ({ loading?, error?, resultSet?, searchTime? }) => void
  setImages,              // (images) => void

  // URL sync
  isRestoringFromHistory, // () => boolean
  syncURL,                // () => void
  onTranslatedTextareas,   // ({ textareas, translatedCount }) => void
  onSearchSnapshot        // ({ source, textareas, relevanceFeedback, resultSet, searchTime }) => void
}) {
  let reqId = 0;
  let debounceTimer = null;
  const DEBOUNCE_MS = 250;

  function hasQueryFilterShortcuts(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return false;

    // Keep user-authored shortcut filters untouched in the visible query text.
    return /(^|\s)(date|type|city|country|semantic|sem|semantic_name|new_semantic_name|ns|y|year|m|month|d|day|h|hour|hr|heart_rate_bpm):/i.test(value);
  }

  async function maybeTranslateTextareas(rawTextareas) {
    const source = Array.isArray(rawTextareas) ? rawTextareas : [];
    const autoTranslateEnabled = typeof getAutoTranslateEnabled === 'function'
      ? !!getAutoTranslateEnabled()
      : false;

    if (!autoTranslateEnabled) {
      return {
        translatedTextareas: source,
        translatedCount: 0,
        failedCount: 0
      };
    }

    let translatedCount = 0;
    let failedCount = 0;
    const translatedTextareas = await Promise.all(source.map(async (t) => {
      const rawValue = String(t?.value || '').trim();
      if (!rawValue) return t;

      if (hasQueryFilterShortcuts(rawValue)) {
        // Do not rewrite user-visible query when filters are present.
        return t;
      }

      const lowerRaw = rawValue.toLowerCase();
      if (lowerRaw.startsWith('image:') || lowerRaw.startsWith('similarity:')) {
        return t;
      }

      try {
        const translated = await api.translateText(rawValue, { target: 'en', source: 'auto' });
        const normalized = String(translated || '').trim();
        if (!normalized || normalized === rawValue) {
          return t;
        }

        translatedCount += 1;
        return {
          ...t,
          value: normalized,
          translatedFrom: rawValue
        };
      } catch {
        failedCount += 1;
        // Non-blocking fallback to original query text.
        return t;
      }
    }));

    return { translatedTextareas, translatedCount, failedCount };
  }

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
    const rawTextareas = getTextareas();
    if (!rawTextareas?.length) return;
    const preparedTextareas = typeof getSearchTextareas === 'function'
      ? getSearchTextareas(rawTextareas)
      : rawTextareas;
    const {
      translatedTextareas: textareas,
      translatedCount,
      failedCount
    } = await maybeTranslateTextareas(preparedTextareas);

    if (translatedCount > 0) {
      onTranslatedTextareas?.({
        textareas,
        translatedCount
      });
    } else if (failedCount > 0) {
      toasts.warning('Auto-translation unavailable. Using original query text.');
    }

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
        const legacyModel = String(t?.model || '').trim();
        const textModel = String(t?.textModel || legacyModel || '').trim();
        const imageModel = String(t?.imageModel || legacyModel || '').trim();
        let part = '';
        if (simId && text) part = `sim:${simId} text:${text}`;
        else if (simId) part = `sim:${simId}`;
        else part = text;
        // Include separate text/image model fingerprints in cache key so model changes bust cache.
        const tm = textModel || '__default_text__';
        const im = imageModel || '__default_image__';
        return `${part} tm:${tm} im:${im}`;
      })
      .join(' ');

    const relevanceFeedback = typeof getRelevanceFeedback === 'function'
      ? (getRelevanceFeedback() || null)
      : null;

    const rfFingerprint = relevanceFeedback
      ? ` rf:method=${String(relevanceFeedback.method || 'svm')} pos=${(relevanceFeedback.positiveIds || []).join(',')} neg=${(relevanceFeedback.negativeIds || []).join(',')} model=${String(relevanceFeedback.model || '')} addNeg=${Number.isFinite(Number(relevanceFeedback.numAdditionalNegatives)) ? Number(relevanceFeedback.numAdditionalNegatives) : ''}`
      : '';

    const cacheKey = `${query}${rfFingerprint}`;
    const cacheEnabled = typeof getCacheEnabled === 'function' ? !!getCacheEnabled() : true;

    const start = Date.now();

    // 1) Cache
    try {
      const cached = cacheEnabled ? recentSearches.find(cacheKey) : null;
      if (cacheEnabled && cached?.results) {
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

        onSearchSnapshot?.({
          source: 'cache',
          textareas,
          relevanceFeedback,
          resultSet: cached.results,
          searchTime: Date.now() - start,
          translation: {
            enabled: typeof getAutoTranslateEnabled === 'function' ? !!getAutoTranslateEnabled() : false,
            translatedCount
          }
        });

        if (translatedCount > 0) {
          toasts.info(`Translated ${translatedCount} query step${translatedCount > 1 ? 's' : ''} to English.`);
        }

        setImages(transformed);

        await tick();
        if (!isRestoringFromHistory()) syncURL();

        toasts.success(`📦 Loaded ${transformed.length} cached results!`);
        return;
      }

      // 2) API
      const framesPerRow = getFramesPerRow();
      const temporalWindowSeconds = typeof getTemporalWindowSeconds === 'function'
        ? Number(getTemporalWindowSeconds())
        : undefined;

      const resultSet = await api.search({
        textareas,
        relevanceFeedback,
        simReorder: false,
        framesPerRow,
        temporalWindowSeconds
      });

      if (req !== reqId) return;

      setSearchState({
        resultSet,
        searchTime: Date.now() - start,
        loading: false,
        error: null
      });

      onSearchSnapshot?.({
        source: 'api',
        textareas,
        relevanceFeedback,
        resultSet,
        searchTime: Date.now() - start,
        translation: {
          enabled: typeof getAutoTranslateEnabled === 'function' ? !!getAutoTranslateEnabled() : false,
          translatedCount
        }
      });

      if (translatedCount > 0) {
        toasts.info(`Translated ${translatedCount} query step${translatedCount > 1 ? 's' : ''} to English.`);
      }

      const submittedIds = getSubmittedIds();
      const transformed = transformSearchResults(resultSet, submittedIds);
      assertUniqueImageIds(transformed);
      setImages(transformed);

      await tick();
      if (!isRestoringFromHistory()) syncURL();

      if (transformed.length > 0) {
        if (cacheEnabled && cacheKey) {
          const similarityPreview = typeof getSimilarityPreview === 'function'
            ? getSimilarityPreview(rawTextareas)
            : null;
          recentSearches.add(cacheKey, transformed.length, resultSet, rawTextareas, similarityPreview);
        }
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
