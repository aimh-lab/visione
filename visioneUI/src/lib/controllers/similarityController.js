// src/lib/controllers/similarityController.js
export function createSimilarityController({
  api,                       // visioneAPI
  toasts,
  transformSimilarityResults,
  tick,

  getSubmittedIds,           // () => Set<string>

  // state sinks
  setSimilarityState,        // ({ loading?, error?, resultSet?, images? }) => void

  // URL sync
  isRestoringFromHistory,    // () => boolean
  syncURL                    // (extra) => void, oppure () => void
}) {
  let reqId = 0;

  async function runSimilaritySearch(baseImgId) {
    if (!baseImgId) return;

    const req = ++reqId;

    setSimilarityState({
      loading: true,
      error: null,
      resultSet: null,
      images: []
    });

    try {
      const resultSet = await api.similaritySearch(baseImgId);
      if (req !== reqId) return;

      const submittedIds = getSubmittedIds();
      const images = transformSimilarityResults(resultSet, submittedIds);

      setSimilarityState({
        loading: false,
        error: null,
        resultSet,
        images
      });

      await tick();
      if (!isRestoringFromHistory()) syncURL({ similarityBase: baseImgId });
    } catch (err) {
      if (req !== reqId) return;

      setSimilarityState({
        loading: false,
        error: err?.message ?? String(err),
        resultSet: null,
        images: []
      });

      toasts.error(`Similarity failed: ${err?.message ?? String(err)}`);
    }
  }

  return { runSimilaritySearch };
}
