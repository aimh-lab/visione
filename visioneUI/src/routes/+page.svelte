<script>
  import * as ui from '../utils/ui';
  import { createModalController } from '../stores/modalController.js';
  import SearchView from "../views/SearchView.svelte";
  import VideoSummaryView from "../views/VideoSummaryView.svelte";
  import SimilarityView from "../views/SimilarityView.svelte";
  import AdaptiveTabLayout from "../components/AdaptiveTabLayout.svelte";

  import SettingsModal from "../components/SettingsModal.svelte";
  import Keybindings from "../components/Keybindings.svelte";
  import { visioneAPI } from '../services/api.js';
  import { transformSearchResults, transformSimilarityResults, transformVideoKeyframes } from '../services/transformers.js';
  import VideoPlayerModal from "../components/VideoPlayerModal.svelte";
  import { recentSearches } from '../stores/recentSearches.js';
  import { deserializeFromURL, updateURL } from '../utils/urlState.js';
  import { tabsPosition } from '../stores/tabsPosition.js';
  import { toasts } from '../stores/toastStore.js';
  import ToastContainer from '../components/ToastContainer.svelte';
  import StatusBar from '../components/StatusBar.svelte';
  import { uiStore } from '../stores/uiStore.js';
  import { get } from 'svelte/store';
  import { sessionStore } from '../stores/sessionStore.js';
  import { browser } from '$app/environment';
  import { createSearchController } from '$lib/controllers/searchController.js';
  import { createSimilarityController } from '$lib/controllers/similarityController.js';
  import { createVideoController } from '$lib/controllers/videoController.js';
  import { createDresController } from '$lib/controllers/dresController.js';
  import { createScrollManager } from '$lib/controllers/scrollManager.js';
  import { createVideoPlayerController } from '$lib/controllers/videoPlayerController.js';
  import { addTextarea as _addTextarea, removeTextarea as _removeTextarea, toggleTextarea as _toggleTextarea, swapTextareas as _swapTextareas, loadExampleQuery as _loadExampleQuery } from '$lib/controllers/textareaController.js';
  import { buildRows } from '$lib/ui/buildRows.js';
  import { getFirstOfNextRowDOM } from '$lib/ui/domRowNav.js';

  import { onMount, onDestroy, tick } from "svelte";

  // ---------------------------
  // Stato non-UI (locale)
  // ---------------------------
  // Scroll manager (owns listeners + position save/restore)
  const scrollMgr = createScrollManager();

  // Local refs to containers (updated via register callbacks)
  let imagesContainer;
  let similarityContainer;
  let view2Container;

  function resetSearchScroll() {
    lastViewedSearchIndex = 0;
    scrollMgr.resetScroll('View1');
  }


  // VideoPlayerModal
  let isVideoPlayerOpen = false;
  let videoPlayer = {
    url: "",
    startTime: 0,
    title: "",
    videoId: "",
    highlightedKeyframes: []
  };

  // Settings modal (solo apertura/chiusura)
  let isSettingsOpen = false;

  // Back/forward
  let isRestoringFromHistory = false;


  // Controller modali
  const searchModal = createModalController();
  const similarityModal = createModalController();
  const videoModal = createModalController();

  // Stati derivati dai controller
  let selectedImage = null;
  let isModalOpen = false;

  let simSelected = null;
  let simIsModalOpen = false;

  let view2SelectedFrame = null;
  let view2IsModalOpen = false;

  $: ({ isOpen: isModalOpen, selected: selectedImage } = $searchModal);
  $: ({ isOpen: simIsModalOpen, selected: simSelected } = $similarityModal);
  $: ({ isOpen: view2IsModalOpen, selected: view2SelectedFrame } = $videoModal);

  // ---------------------------
  // CSS vars (solo da uiStore)
  // ---------------------------
  $: if (browser) {
    const { keyframeSize, theme } = $uiStore;
    document.documentElement.style.setProperty('--kf-size', `${keyframeSize}px`);
    document.documentElement.style.setProperty('--min-card-w', `${Math.round(keyframeSize * 1.1)}px`);
    document.documentElement.setAttribute('data-theme', theme || 'default');
  }


  // ---------------------------
  // Datasets / risultati
  // ---------------------------
  let images = [];
  let searchResultSet = null;
  let searchLoading = false;
  let searchError = null;

  // submittedImages: per ora “in-session”. (Commit 2: sessionStore)
  $: submittedImages = $sessionStore.submittedImages;

  // Derivate
  $: totalImages = images.length;

  // Query UI
  let textareas = [{ value: "", enabled: true }];
  let textareaImages = {};
  $: rfPositive = $sessionStore.rfPositive;
  $: rfNegative = $sessionStore.rfNegative;
  let selectedIndex = 0;

  // View2 stato
  let view2Frames = null;
  let view2VideoId = null;
  let view2Loading = false;
  let view2Error = null;
  let view2SelectedImgId = null;

  // Similarity stato
  let similarityLoading = false;
  let similarityError = null;
  let similarityResultSet = null;
  let similarityImages = [];
  let similarityBaseImgId = null;

  // Similarity UI
  let similarityDisplayRows = [];
  let focusSearchInputHandler = () => {};

  // Variabili separate per ogni view
  let lastViewedSearchIndex = 0;
  let lastViewedVideoIndex = 0;
  let lastViewedSimilarityIndex = 0;

  let searchTime = 0;
  const URL_SYNC_DEBOUNCE_MS = 180;
  let urlSyncTimer = null;
  let lastSearchResultSet = null;

  function scheduleURLSync() {
    if (isRestoringFromHistory || !browser) return;

    if (urlSyncTimer) {
      clearTimeout(urlSyncTimer);
      urlSyncTimer = null;
    }

    urlSyncTimer = setTimeout(() => {
      urlSyncTimer = null;
      updateURL({ textareas, activeTab: get(uiStore).layoutTab }, false);
    }, URL_SYNC_DEBOUNCE_MS);
  }

  function appendSubmittedFrames(transformed) {
    const submitted = $sessionStore.submittedImages;
    if (submitted.length === 0) return transformed;

    const existing = new Set(transformed.map(i => i.imgId));
    const missing = submitted.filter(i => !existing.has(i.imgId));

    return [
      ...transformed,
      ...missing.map((i, idx) => ({
        ...i,
        index: transformed.length + idx
      }))
    ];
  }

  const flatSimilarity = () => similarityDisplayRows?.flat?.() ?? [];

  const registerContainer = (el) => { scrollMgr.registerContainer('View1', el); imagesContainer = el; };
  const registerSimilarityContainer = (el) => { scrollMgr.registerContainer('Similarity', el); similarityContainer = el; };
  const registerView2Container = (el) => { scrollMgr.registerContainer('View2', el); view2Container = el; };

  let prevLayoutTab = null;
  $: if ($uiStore.layoutTab && $uiStore.layoutTab !== prevLayoutTab) {
    const nextTab = $uiStore.layoutTab;
    scrollMgr.handleTabChange(nextTab);
    prevLayoutTab = nextTab;
  }

  const getSubmittedIds = () => new Set($sessionStore.submittedImages.map(s => s.imgId));

  const syncURL = () => {
    scheduleURLSync();
  };

  const searchController = createSearchController({
    api: visioneAPI,
    recentSearches,
    toasts,
    transformSearchResults,
    tick,

    getTextareas: () => textareas,
    setTextareas: (t) => { textareas = t; },
    getFramesPerRow: () => get(uiStore).resultsPerRow,
    getSubmittedIds,

    setSearchState: ({ loading, error, resultSet, searchTime: st }) => {
      if (loading !== undefined) searchLoading = loading;
      if (error !== undefined) searchError = error;
      if (resultSet !== undefined) {
        searchResultSet = resultSet;
        if (resultSet && resultSet !== lastSearchResultSet) {
          lastSearchResultSet = resultSet;
          resetSearchScroll();
        }
        if (!resultSet) {
          lastSearchResultSet = null;
        }
      }
      if (st !== undefined) searchTime = st;
    },

    setImages: (transformed) => {
      images = appendSubmittedFrames(transformed);
      selectedIndex = 0;
    },

    isRestoringFromHistory: () => isRestoringFromHistory,
    syncURL
  });

  const similarityController = createSimilarityController({
    api: visioneAPI,
    toasts,
    transformSimilarityResults,
    tick,

    getSubmittedIds,

    setSimilarityState: ({ loading, error, resultSet, images: imgs }) => {
      if (loading !== undefined) similarityLoading = loading;
      if (error !== undefined) similarityError = error;
      if (resultSet !== undefined) similarityResultSet = resultSet;
      if (imgs !== undefined) similarityImages = imgs;
    },

    isRestoringFromHistory: () => isRestoringFromHistory,
    syncURL
  });

  const videoController = createVideoController({
    api: visioneAPI,
    transformVideoKeyframes,
    tick,

    getSubmittedIds,

    setVideoState: ({ loading, error, frames, videoId, selectedImgId }) => {
      if (loading !== undefined) view2Loading = loading;
      if (error !== undefined) view2Error = error;
      if (frames !== undefined) view2Frames = frames;
      if (videoId !== undefined) view2VideoId = videoId;
      if (selectedImgId !== undefined) view2SelectedImgId = selectedImgId;
    }
  });

  // DRES submission controller
  const dresCtrl = createDresController({
    sessionStore,
    findFrame: (imgId, fallback) => {
      return images.find(i => i.imgId === imgId)
        || similarityImages.find(i => i.imgId === imgId)
        || (Array.isArray(view2Frames) ? view2Frames.find(f => f.imgId === imgId) : null)
        || (fallback
          ? {
              title: fallback.title ?? fallback.imgId,
              videoId: fallback.videoId ?? String(fallback.imgId).split("-")[0],
              imgId: fallback.imgId,
              url: fallback.url || "",
              submitted: true,
              submissionVerdict: fallback.submissionVerdict,
              raw: fallback.raw ?? null
            }
          : null);
    },
    updateVerdictInViews: (imgId, verdict) => {
      if (Array.isArray(view2Frames)) {
        const fIdx = view2Frames.findIndex(f => f.imgId === imgId);
        if (fIdx !== -1) {
          view2Frames[fIdx] = { ...view2Frames[fIdx], submissionVerdict: verdict };
          view2Frames = [...view2Frames];
        }
      }
      const sIdx = similarityImages.findIndex(i => i.imgId === imgId);
      if (sIdx !== -1) {
        similarityImages[sIdx] = { ...similarityImages[sIdx], submissionVerdict: verdict };
        similarityImages = [...similarityImages];
      }
      const gIdx = images.findIndex(i => i.imgId === imgId);
      if (gIdx !== -1) {
        images[gIdx] = { ...images[gIdx], submissionVerdict: verdict };
        images = [...images];
      }
    },
    markSubmittedInViews: (id) => {
      if (Array.isArray(view2Frames)) {
        const fIdx = view2Frames.findIndex(f => f.imgId === id);
        if (fIdx !== -1) {
          view2Frames[fIdx] = { ...view2Frames[fIdx], submitted: true };
          view2Frames = [...view2Frames];
        }
      }
      const sIdx = similarityImages.findIndex(i => i.imgId === id);
      if (sIdx !== -1) {
        similarityImages[sIdx] = { ...similarityImages[sIdx], submitted: true };
        similarityImages = [...similarityImages];
      }
      const gIdx = images.findIndex(i => i.imgId === id);
      if (gIdx !== -1) {
        images[gIdx] = { ...images[gIdx], submitted: true };
        images = [...images];
      }
    }
  });

  const submitByImgId = (imgId, fallback) => dresCtrl.submitByImgId(imgId, fallback);
  const handleTestDresConnection = (e) => dresCtrl.testConnection(e);

  // Video player controller
  const videoPlayerCtrl = createVideoPlayerController({
    getImages: () => images,
    getSimilarityImages: () => similarityImages,
  });

  // Aggiorna i dataset nei controller quando cambiano
  $: searchModal.setItems(images);
  $: if (!$similarityModal.isOpen) similarityModal.setItems(flatSimilarity());
  $: if (view2Frames) videoModal.setItems(view2Frames);

  // ---------------------------
  // URL restore
  // ---------------------------
  async function restoreFromURLState(urlState) {
    if (urlState.textareas) textareas = urlState.textareas;

    if (urlState.activeTab) {
      uiStore.actions.setLayoutTab(urlState.activeTab);
    }

    await tick();

    if (urlState.textareas?.length > 0 && urlState.textareas[0]?.value) {
      await runSearchImmediate();
    }

    if (urlState.similarityBase) {
      await openSimilarity(urlState.similarityBase);
    }
  }

  onMount(() => {
    const init = async () => {
      uiStore.actions.hydrateFromSettings();
      uiStore.actions.setLayoutTab('View1'); // refresh sempre View1
      await tick();

      const urlState = deserializeFromURL();
      if (Object.keys(urlState).length > 0) {
        isRestoringFromHistory = true;
        await restoreFromURLState(urlState);
        isRestoringFromHistory = false;
      }
    };

    const handlePopState = async () => {
      isRestoringFromHistory = true;
      const urlState = deserializeFromURL();
      await restoreFromURLState(urlState);
      isRestoringFromHistory = false;
    };

    init();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  });

  onDestroy(() => {
    if (urlSyncTimer) {
      clearTimeout(urlSyncTimer);
      urlSyncTimer = null;
    }
    scrollMgr.destroy();
  });

  // ---------------------------
  // Handler UI minimi
  // ---------------------------
  function handleRemovePositive(e) {
    const { imgId, index } = e.detail || {};
    const item = imgId
      ? $sessionStore.rfPositive.find(r => r.imgId === imgId)
      : $sessionStore.rfPositive.find(r => r.index === index);

    if (!item?.imgId) return;
    sessionStore.actions.toggleRFPositive({ imgId: item.imgId, imgObj: item });
  }

  function handleRemoveNegative(e) {
    const { imgId, index } = e.detail || {};
    const item = imgId
      ? $sessionStore.rfNegative.find(r => r.imgId === imgId)
      : $sessionStore.rfNegative.find(r => r.index === index);

    if (!item?.imgId) return;
    sessionStore.actions.toggleRFNegative({ imgId: item.imgId, imgObj: item });
  }

  function handleUpdateImages(e) {
    const { index, images } = e.detail || {};
    textareaImages = { ...textareaImages, [index]: images };
  }

  function handleUpdateURLRequest() {
    scheduleURLSync();
  }

  function handleZoomIn() {
    const { contentScale } = get(uiStore);
    uiStore.actions.setContentScale(Math.min(2, +(contentScale + 0.1).toFixed(2)));
  }

  function handleZoomOut() {
    const { contentScale } = get(uiStore);
    uiStore.actions.setContentScale(Math.max(0.5, +(contentScale - 0.1).toFixed(2)));
  }

  function applySettings(e) {
    uiStore.actions.applySettings(e.detail);
  }

  // ---------------------------
  // Video player helpers
  // ---------------------------
  async function openVideoPlayerBy(imgId, videoId, startAt) {
    videoPlayer = await videoPlayerCtrl.buildPlayerData(imgId, videoId, startAt);
    isVideoPlayerOpen = true;
  }

  function handleSubmitFrameFromPlayer(e) {
    const { imgId, videoId, dataUrl, currentTime } = e.detail || {};
    submitByImgId(imgId, {
      imgId,
      videoId,
      url: dataUrl || "",
      title: imgId,
      raw: { source: "video-modal", currentTime }
    });
  }

  // ---------------------------
  // Modal navigation
  // ---------------------------
  function openModal(index) {
    const item = images[index];
    if (item) {
      searchModal.open(item);
      lastViewedSearchIndex = index;
      tick().then(() => ui.scrollToImage(imagesContainer, index));
    }
  }

  const closeModal = () => searchModal.close({ keepSelection: true });

  function navigateImage(offset, toFirstOfRow = false) {
    if (toFirstOfRow) {
      const currentIndex = $searchModal.selected?.index ?? lastViewedSearchIndex;
      const targetIndex = getFirstOfNextRow(currentIndex, offset);
      if (targetIndex >= 0 && targetIndex < images.length) {
        const targetItem = images[targetIndex];
        searchModal.open(targetItem);
        lastViewedSearchIndex = targetIndex;
        tick().then(() => ui.scrollToImage(imagesContainer, targetIndex));
      }
    } else {
      searchModal.navigate(offset);
      const current = $searchModal.selected;
      if (current) {
        lastViewedSearchIndex = current.index;
        tick().then(() => ui.scrollToImage(imagesContainer, current.index));
      }
    }
  }

  function openSimilarityModalByImg(img) {
    similarityModal.open(img);
    lastViewedSimilarityIndex = img.index ?? 0;
  }

  function closeSimilarityModal() {
    similarityModal.close({ keepSelection: true });
  }

  function moveSimilarityBy(offset, toFirstOfRow = false) {
    const items = flatSimilarity();

    if (toFirstOfRow) {
      const currentIndex = $similarityModal.selected?.index ?? lastViewedSimilarityIndex;
      const targetIndex = getFirstOfNextRow(currentIndex, offset);
      if (targetIndex >= 0 && targetIndex < items.length) {
        const targetItem = items[targetIndex];
        similarityModal.open(targetItem);
        lastViewedSimilarityIndex = targetIndex;
        tick().then(() => ui.scrollToImage(similarityContainer, targetIndex));
      }
    } else {
      if (items.length > 0 && $similarityModal.selected) similarityModal.setItems(items);
      similarityModal.navigate(offset);
      const current = $similarityModal.selected;
      if (current) {
        lastViewedSimilarityIndex = current.index ?? 0;
        tick().then(() => ui.scrollToImage(similarityContainer, current.index));
      }
    }
  }

  function openFrameModal(frame) {
    if (!frame) return;
    videoModal.open(frame);
    view2SelectedImgId = frame.imgId;
    lastViewedVideoIndex = frame.index ?? 0;
    tick().then(() => ui.scrollToImage(view2Container, frame.imgId));
  }

  function closeFrameModal() {
    videoModal.close({ keepSelection: true });
  }

  function navigateFrame(offset, toFirstOfRow = false) {
    if (toFirstOfRow) {
      const currentIndex = $videoModal.selected?.index ?? lastViewedVideoIndex;
      const targetIndex = getFirstOfNextRow(currentIndex, offset);

      if (targetIndex >= 0 && targetIndex < (view2Frames?.length ?? 0)) {
        const targetFrame = view2Frames[targetIndex];
        videoModal.open(targetFrame);
        view2SelectedImgId = targetFrame.imgId;
        lastViewedVideoIndex = targetIndex;
        tick().then(() => ui.scrollToImage(view2Container, targetFrame.imgId));
      }
    } else {
      videoModal.navigate(offset);
      const current = $videoModal.selected;
      if (current) {
        view2SelectedImgId = current.imgId;
        lastViewedVideoIndex = current.index ?? 0;
        tick().then(() => ui.scrollToImage(view2Container, current.index));
      }
    }
  }

  // Quick actions dalla status bar
function handleViewSubmitted() {
    if (!get(uiStore).dresEnabled) return;
    if (!get(uiStore).isSidebarRightOpen) uiStore.actions.toggleRightSidebar();
    uiStore.actions.focusRightTab("Submitted");
    toasts.info("Viewing submitted frames");
  }

  function handleViewRF() {
    if (!get(uiStore).isSidebarRightOpen) uiStore.actions.toggleRightSidebar();
    uiStore.actions.focusRightTab("RF");
    toasts.info("Viewing relevance feedback");
  }

  // ---------------------------
  // Open by imgId (tab-aware)
  // ---------------------------
  function openByImgId(imgId) {
    if (!imgId) return;
    const { layoutTab } = get(uiStore);

    if (layoutTab === "View1") {
      const idx = ui.indexOfImgId(images, imgId);
      if (idx >= 0) openModal(idx);
      return;
    }

    if (layoutTab === "Similarity") {
      const item = similarityImages[ui.indexOfImgId(similarityImages, imgId)];
      if (item) similarityModal.open(item);
      return;
    }

    if (layoutTab === "View2") {
      view2SelectedImgId = String(imgId).replace(/\.jpg$/i, "");
      tick().then(() => ui.scrollToImage(view2Container, view2SelectedImgId));
    }
  }

  // ---------------------------
  // RF helpers
  // ---------------------------
  function addRFPositiveByImg(imgId, fallback = null) {
    const fromSim = similarityImages.find(i => i.imgId === imgId);
    const fromSearch = images.find(i => i.imgId === imgId);
    const imgObj = fromSim || fromSearch || ui.ensureImgObj(imgId, fallback);
    if (!imgObj) return;

    sessionStore.actions.toggleRFPositive({ imgId, imgObj });
  }

  function addRFNegativeByImg(imgId, fallback = null) {
    const fromSim = similarityImages.find(i => i.imgId === imgId);
    const fromSearch = images.find(i => i.imgId === imgId);
    const imgObj = fromSim || fromSearch || ui.ensureImgObj(imgId, fallback);
    if (!imgObj) return;

    sessionStore.actions.toggleRFNegative({ imgId, imgObj });
  }


  function updateImagesFromResult(resultset) {
    const submittedIds = getSubmittedIds();
    const transformed = transformSearchResults(resultset, submittedIds);
    images = appendSubmittedFrames(transformed);
    selectedIndex = 0;
  }


  // ---------------------------
  // Navigazione selection (keyboard)
  // ---------------------------
  function moveSelection(delta) {
    if (!images || images.length === 0) return;
    let next = selectedIndex + delta;
    if (next < 0) next = 0;
    if (next > images.length - 1) next = images.length - 1;

    if (next !== selectedIndex) {
      selectedIndex = next;
      ui.scrollToImage(imagesContainer, selectedIndex);
    }
  }

  function moveSelectionRows(deltaRows) {
    const cols = get(uiStore).resultsPerRow || 5;
    moveSelection(deltaRows * cols);
  }

  function getSelectedItemForShortcuts() {
    const { layoutTab } = get(uiStore);

    if (layoutTab === "View1") {
      return images[lastViewedSearchIndex] || images[selectedIndex] || null;
    }

    if (layoutTab === "View2") {
      if (!Array.isArray(view2Frames) || view2Frames.length === 0) return null;
      const byId = view2SelectedImgId
        ? view2Frames.find((f) => f.imgId === view2SelectedImgId)
        : null;
      return byId || view2Frames[lastViewedVideoIndex] || view2Frames[0] || null;
    }

    if (layoutTab === "Similarity") {
      if (!Array.isArray(similarityImages) || similarityImages.length === 0) return null;
      return similarityImages[lastViewedSimilarityIndex] || similarityImages[0] || null;
    }

    return null;
  }

  async function focusSearchBox() {
    uiStore.actions.setLayoutTab("View1");
    if (!get(uiStore).isSidebarOpen) uiStore.actions.toggleSidebar();
    await tick();
    focusSearchInputHandler?.();
  }

  // ---------------------------
  // Search
  // ---------------------------
  async function runSearch() {
    return searchController.runSearch();
  }

  async function runSearchImmediate() {
    return searchController.runSearchImmediate();
  }


  async function handleRestoreFromURL() {
    const urlState = deserializeFromURL();

    if (urlState.textareas && urlState.textareas.length > 0) {
      textareas = urlState.textareas;
    }

    if (urlState.activeTab) uiStore.actions.setLayoutTab(urlState.activeTab);

    await tick();
    await runSearchImmediate();
  }

  async function openVideoSummary(videoId, highlightImgId = null) {
    scrollMgr.suppressRestore('View2');
    uiStore.actions.setLayoutTab("View2");
    if (!highlightImgId) lastViewedVideoIndex = 0;

    await videoController.openVideoSummary(videoId, highlightImgId);

    // La parte DOM resta qui (perché è legata a view2Container)
    await tick();

    if (view2SelectedImgId) {
      setTimeout(() => {
        const found = view2Container?.querySelector(
          `[data-frame-id="${CSS.escape(view2SelectedImgId)}"]`
        );
        if (found) ui.scrollToImage(view2Container, view2SelectedImgId);
      }, 300);
    } else if (view2Container) {
      view2Container.scrollTop = 0;
    }
  }


  // ---------------------------
  // Similarity
  // ---------------------------
  async function runSimilaritySearch(baseImgId) {
    return similarityController.runSimilaritySearch(baseImgId);
  }


  async function openSimilarity(baseImgId) {
    similarityBaseImgId = baseImgId;
    scrollMgr.suppressRestore('Similarity');
    uiStore.actions.setLayoutTab("Similarity");
    lastViewedSimilarityIndex = 0;

    await runSimilaritySearch(baseImgId);
    tick().then(() => similarityContainer?.scrollTo?.({ top: 0 }));
  }


  // ---------------------------
  // Textareas ops (delegated to textareaController)
  // ---------------------------
  function addTextarea(index) {
    textareas = _addTextarea(textareas, index);
    toasts.info("New query step added");
  }

  function removeTextarea(index) {
    const result = _removeTextarea(textareas, index);
    textareas = result.textareas;
    if (result.shouldSearch) {
      toasts.info("Query step removed, updating results...");
      setTimeout(() => runSearchImmediate(), 0);
    } else if (result.textareas !== textareas) {
      toasts.info("Query step removed");
    }
  }

  function toggleTextarea(index) {
    const next = _toggleTextarea(textareas, index);
    const status = next[index].enabled ? "enabled" : "disabled";
    textareas = next;
    toasts.info(`Query step ${index + 1} ${status}`);
  }

  function swapTextareas(indexA, indexB, mode = "swap") {
    const result = _swapTextareas(textareas, textareaImages, indexA, indexB, mode);
    if (!result) return;
    textareas = result.textareas;
    textareaImages = result.textareaImages;
    toasts.info("Queries reordered, updating results...");
  }

  // ---------------------------
  // Row navigation helper (DOM-based)
  // ---------------------------
  function getFirstOfNextRow(currentIndex, direction) {
    const layoutTab = get(uiStore).layoutTab;

    if (layoutTab === "View1") {
      return getFirstOfNextRowDOM({
        currentIndex,
        direction,
        container: imagesContainer,
        items: images
      });
    }

    if (layoutTab === "View2") {
      return getFirstOfNextRowDOM({
        currentIndex,
        direction,
        container: view2Container,
        items: view2Frames || []
      });
    }

    if (layoutTab === "Similarity") {
      return getFirstOfNextRowDOM({
        currentIndex,
        direction,
        container: similarityContainer,
        items: flatSimilarity()
      });
    }

    return currentIndex;
  }

  // ---------------------------
  // Reset search session (preserva settings utente)
  // ---------------------------
  function resetApp() {
    const ok = window.confirm(
      "Reset current search session? This will clear queries, results, RF and submitted items, but keep your app settings."
    );
    if (!ok) return;

    uiStore.actions.setLayoutTab('View1');

    textareas = [{ value: "", enabled: true }];
    textareaImages = {};

    images = [];
    searchResultSet = null;
    searchError = null;
    searchLoading = false;

    view2Frames = null;
    view2VideoId = null;
    view2SelectedImgId = null;
    view2Loading = false;
    view2Error = null;

    similarityImages = [];
    similarityResultSet = null;
    similarityBaseImgId = null;
    similarityLoading = false;
    similarityError = null;

    searchModal.close();
    similarityModal.close();
    videoModal.close();
    isVideoPlayerOpen = false;

    lastViewedSearchIndex = 0;
    lastViewedVideoIndex = 0;
    lastViewedSimilarityIndex = 0;
    selectedIndex = 0;

    scrollMgr.resetAllScrollPositions();
    prevLayoutTab = null;

    if (typeof window !== "undefined") {
      window.history.pushState({}, "", window.location.pathname);
    }

    sessionStore.actions.clearAll();
    toasts.success("🔄 Search session cleared (settings preserved)");
  }

  // ---------------------------
  // Rows derivation (UI store driven)
  // ---------------------------
  $: displayRows = buildRows(images, {
    viewMode: $uiStore.viewMode,
    resultsPerRow: $uiStore.resultsPerRow,
    resultsAutoFit: $uiStore.resultsAutoFit
  });


  $: similarityDisplayRows = buildRows(similarityImages, {
    viewMode: $uiStore.viewMode,
    resultsPerRow: $uiStore.resultsPerRow,
    resultsAutoFit: $uiStore.resultsAutoFit
  });


  // Se vuoi auto-run di query esempio
  function loadExampleQuery(queries) {
    textareas = _loadExampleQuery(queries);
    toasts.info("Example loaded! Running search...");
    setTimeout(() => runSearchImmediate(), 300);
  }

</script>

<!-- Template invariato -->
<Keybindings
  isModalOpen={$searchModal.isOpen || $similarityModal.isOpen || $videoModal.isOpen}
  isVideoPlayerOpen={isVideoPlayerOpen}
  onFocusSearch={focusSearchBox}
  onSwitchTab={(tab) => uiStore.actions.setLayoutTab(tab)}
  onSubmitSelected={() => {
    const item = getSelectedItemForShortcuts();
    if (item?.imgId) submitByImgId(item.imgId, item);
  }}
  onToggleSidebar={() => uiStore.actions.toggleSidebar()}
  onOpenSettings={() => (isSettingsOpen = true)}
  onRFPositiveSelected={() => {
    const item = getSelectedItemForShortcuts();
    if (item?.imgId) addRFPositiveByImg(item.imgId, item);
  }}
  onRFNegativeSelected={() => {
    const item = getSelectedItemForShortcuts();
    if (item?.imgId) addRFNegativeByImg(item.imgId, item);
  }}
  onSimilaritySelected={() => {
    const item = getSelectedItemForShortcuts();
    if (item?.imgId) openSimilarity(item.imgId);
  }}
  onVideoSummarySelected={() => {
    const item = getSelectedItemForShortcuts();
    if (!item?.imgId) return;
    const videoId = item.videoId ?? String(item.imgId).split("-")[0];
    openVideoSummary(videoId, item.imgId);
  }}
  onOpenAtSelected={() => {
    if ($searchModal.isOpen || $videoModal.isOpen || $similarityModal.isOpen) return;

    const { layoutTab } = get(uiStore);

    if (layoutTab === "View1") {
      openModal(lastViewedSearchIndex);
    } else if (layoutTab === "View2" && view2Frames?.length > 0) {
      openFrameModal(view2Frames[lastViewedVideoIndex]);
    } else if (layoutTab === "Similarity" && similarityImages?.length > 0) {
      openSimilarityModalByImg(similarityImages[lastViewedSimilarityIndex]);
    }
  }}
  onNavigateImage={(offset, toFirstOfRow = false) => {
    if ($videoModal.isOpen) navigateFrame(offset, toFirstOfRow);
    else if ($similarityModal.isOpen) moveSimilarityBy(offset, toFirstOfRow);
    else navigateImage(offset, toFirstOfRow);
  }}
  onCloseModal={() => {
    if ($videoModal.isOpen) closeFrameModal();
    else if ($similarityModal.isOpen) closeSimilarityModal();
    else closeModal();
  }}
/>

<VideoPlayerModal
  isOpen={isVideoPlayerOpen}
  videoUrl={videoPlayer.url}
  startTime={videoPlayer.startTime}
  title={videoPlayer.title}
  videoId={videoPlayer.videoId}
  highlightedKeyframes={videoPlayer.highlightedKeyframes || []}
  showSubmitUI={$uiStore.dresEnabled}
  on:submitFrame={handleSubmitFrameFromPlayer}
  on:close={() => { isVideoPlayerOpen = false; }}
/>

<SettingsModal
  isOpen={isSettingsOpen}
  theme={$uiStore.theme}
  keyframeSize={$uiStore.keyframeSize}
  resultsPerRow={$uiStore.resultsPerRow}
  resultsAutoFit={$uiStore.resultsAutoFit}
  videoBadgeOrientation={$uiStore.videoBadgeOrientation}
  virtualizationEnabled={$uiStore.virtualizationEnabled}
  virtualizationThreshold={$uiStore.virtualizationThreshold}
  dresEnabled={$uiStore.dresEnabled}
  dresSubmitServer={$uiStore.dresSubmitServer}
  dresUsername={$uiStore.dresUsername}
  dresPassword={$uiStore.dresPassword}
  dresMemberId={$uiStore.dresMemberId}
  on:close={() => (isSettingsOpen = false)}
  on:save={applySettings}
  on:testDres={handleTestDresConnection}
/>

<AdaptiveTabLayout
  active={$uiStore.layoutTab}
  tabs={["View1","View2","Similarity"]}
  isSidebarOpen={$uiStore.isSidebarOpen}
  isSidebarRightOpen={$uiStore.isSidebarRightOpen}
  viewMode={$uiStore.viewMode}
  keyframeSize={$uiStore.keyframeSize}
  showViewModeRadios={$uiStore.layoutTab === "View1" || $uiStore.layoutTab === "Similarity"}
  on:change={(e) => uiStore.actions.setLayoutTab(e.detail.tab)}
  on:toggleSidebar={() => uiStore.actions.toggleSidebar()}
  on:toggleRightSidebar={() => uiStore.actions.toggleRightSidebar()}
  on:changeViewMode={(e) => uiStore.actions.setViewMode(e.detail.mode)}
  on:adjustKeyframeSize={(e) => {
    const delta = Number(e?.detail?.delta) || 0;
    const next = $uiStore.keyframeSize + delta;
    uiStore.actions.setKeyframeSize(next);
  }}
  on:openSettings={() => (isSettingsOpen = true)}
  on:reset={resetApp}
>
  <div
    class="views-wrapper w-full"
    style="height: {$tabsPosition === 'top' ? 'calc(100vh - 39px)' : '100vh'};"
  >
    {#if $uiStore.layoutTab === "View1"}
      <SearchView
        registerContainer={registerContainer}
        isSidebarOpen={$uiStore.isSidebarOpen}
        isSidebarRightOpen={$uiStore.isSidebarRightOpen}
        sidebarRightTab={$uiStore.sidebarRightTab}
        {textareas}
        {textareaImages}
        {searchLoading}
        {searchError}
        {searchResultSet}
        {rfPositive}
        {rfNegative}
        {submittedImages}
        viewMode={$uiStore.viewMode}
        contentScale={$uiStore.contentScale}
        selectedImage={$searchModal.selected}
        isModalOpen={$searchModal.isOpen}
        totalImages={totalImages}
        rows={displayRows}
        images={images}
        virtualizationEnabled={$uiStore.virtualizationEnabled}
        virtualizationThreshold={$uiStore.virtualizationThreshold}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}

        on:selectRightTab={(e) => uiStore.actions.focusRightTab(e.detail.tab)}

        on:loadCachedResults={(e) => {
          searchResultSet = e.detail.cachedResults;
          updateImagesFromResult(searchResultSet);
          resetSearchScroll();
          toasts.success(`📦 Loaded ${images.length} cached results!`);
        }}

        on:restoreFromURL={handleRestoreFromURL}
        on:updateURL={handleUpdateURLRequest}

        onToggleSidebar={() => uiStore.actions.toggleSidebar()}
        registerFocusSearchHandler={(fn) => {
          focusSearchInputHandler = typeof fn === "function" ? fn : () => {};
        }}
        sidebarLeftWidth={$uiStore.sidebarLeftWidth}
        sidebarRightWidth={$uiStore.sidebarRightWidth}
        onResizeLeftSidebar={(width) => uiStore.actions.setSidebarLeftWidth(width)}
        onResizeRightSidebar={(width) => uiStore.actions.setSidebarRightWidth(width)}
        onToggleRightSidebar={() => uiStore.actions.toggleRightSidebar()}

        openVideoPlayerBy={openVideoPlayerBy}
        onAddTextarea={addTextarea}
        onRemoveTextarea={removeTextarea}
        onToggleTextarea={toggleTextarea}
        onUpdateTextarea={(i, v) => {
          textareas = textareas.map((t, idx) => (idx === i ? { ...t, value: v } : t));
        }}
        onRunSearch={runSearch}
        onClearResults={() => {
          searchResultSet = null;
          searchError = null;
          images = [];
          selectedIndex = 0;
        }}

        onRemovePositive={handleRemovePositive}
        onRemoveNegative={handleRemoveNegative}

        onOpenFromRF={(idx) => {
          uiStore.actions.setLayoutTab("View1");
          tick().then(() => {
            ui.scrollToImage(imagesContainer, idx);
            openModal(idx);
          });
        }}
        onOpenFromSubmitted={(idx) => {
          uiStore.actions.setLayoutTab("View1");
          tick().then(() => {
            ui.scrollToImage(imagesContainer, idx);
            openModal(idx);
          });
        }}

        openByImgId={openByImgId}
        addRFPositiveByImg={addRFPositiveByImg}
        addRFNegativeByImg={addRFNegativeByImg}
        submitByImgId={submitByImgId}
        onVideoSummary={(vid, imgId) => openVideoSummary(vid, imgId)}
        onSimilarity={(imgId) => openSimilarity(imgId)}
        onCloseModal={closeModal}
        onPrev={() => navigateImage(-1)}
        onNext={() => navigateImage(1)}

        on:swapTextarea={(e) => swapTextareas(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap')}
        onLoadExample={(queries) => loadExampleQuery(queries)}
        on:updateImages={handleUpdateImages}
        on:clearQueryInputs={() => {
          textareas = [{ value: "", enabled: true }];
          textareaImages = {};
          toasts.info("Query inputs cleared");
        }}
      />

    {:else if $uiStore.layoutTab === "View2"}
      <VideoSummaryView
        registerContainer={registerView2Container}
        isSidebarOpen={$uiStore.isSidebarOpen}
        contentScale={$uiStore.contentScale}
        frames={view2Frames}
        loading={view2Loading}
        error={view2Error}
        selectedFrameId={view2SelectedImgId}
        virtualizationEnabled={$uiStore.virtualizationEnabled}
        virtualizationThreshold={$uiStore.virtualizationThreshold}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}

        onToggleSidebar={() => uiStore.actions.toggleSidebar()}

        onOpenFrame={(frame) => openFrameModal(frame)}
        onSimilarity={(imgId) => openSimilarity(imgId)}
        addRFPositiveByImg={addRFPositiveByImg}
        addRFNegativeByImg={addRFNegativeByImg}
        submitByImgId={submitByImgId}
        frameIsModalOpen={$videoModal.isOpen}
        selectedFrame={$videoModal.selected}
        totalFrames={(view2Frames?.length ?? 0)}
        onCloseFrameModal={closeFrameModal}
        onPrevFrame={() => navigateFrame(-1)}
        onNextFrame={() => navigateFrame(1)}
        openVideoPlayerBy={openVideoPlayerBy}
      />

    {:else if $uiStore.layoutTab === "Similarity"}
      <SimilarityView
        registerContainer={registerSimilarityContainer}
        isSidebarOpen={$uiStore.isSidebarOpen}
        contentScale={$uiStore.contentScale}
        viewMode={$uiStore.viewMode}
        rows={similarityDisplayRows}
        loading={similarityLoading}
        error={similarityError}
        simSelected={$similarityModal.selected}
        simIsModalOpen={$similarityModal.isOpen}
        virtualizationEnabled={$uiStore.virtualizationEnabled}
        virtualizationThreshold={$uiStore.virtualizationThreshold}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}

        onToggleSidebar={() => uiStore.actions.toggleSidebar()}

        openVideoPlayerBy={openVideoPlayerBy}
        openByImgId={openByImgId}
        addRFPositiveByImg={addRFPositiveByImg}
        addRFNegativeByImg={addRFNegativeByImg}
        submitByImgId={submitByImgId}
        onVideoSummary={(vid, imgId) => openVideoSummary(vid, imgId)}
        onSimilarity={(imgId) => openSimilarity(imgId)}
        onCloseSimModal={closeSimilarityModal}
        onPrevSim={() => moveSimilarityBy(-1)}
        onNextSim={() => moveSimilarityBy(1)}
      />
    {/if}
  </div>

  <ToastContainer />

  <StatusBar
    totalImages={totalImages}
    submittedCount={submittedImages.length}
    rfPositiveCount={rfPositive.length}
    rfNegativeCount={rfNegative.length}
    currentView={$uiStore.layoutTab}
    viewMode={$uiStore.viewMode}
    searchTime={searchTime}
    isLoading={searchLoading || similarityLoading || view2Loading}
    showSubmitted={$uiStore.dresEnabled}
    onViewSubmitted={handleViewSubmitted}
    onViewRF={handleViewRF}
  />
</AdaptiveTabLayout>
