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
  import VideoSummaryModal from "../components/VideoSummaryModal.svelte";
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
  import { pushState } from '$app/navigation';
  import { createSearchController } from '$lib/controllers/searchController.js';
  import { createSimilarityController } from '$lib/controllers/similarityController.js';
  import { createVideoController } from '$lib/controllers/videoController.js';
  import { createDresController } from '$lib/controllers/dresController.js';
  import { createScrollManager } from '$lib/controllers/scrollManager.js';
  import { createVideoPlayerController } from '$lib/controllers/videoPlayerController.js';
  import { addTextarea as _addTextarea, removeTextarea as _removeTextarea, toggleTextarea as _toggleTextarea, swapTextareas as _swapTextareas, loadExampleQuery as _loadExampleQuery } from '$lib/controllers/textareaController.js';
  import { buildRows } from '$lib/ui/buildRows.js';
  import { getFirstOfNextRowDOM } from '$lib/ui/domRowNav.js';
  import { tinyFrameUrl } from '$lib/urlConfig.js';

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

  // Drag & Drop for Similarity
  let showDropzone = false;
  let dragCounter = 0;

  function onGlobalDragEnter(e) {
    const types = e.dataTransfer?.types;
    if (types && (types.includes ? (types.includes('Files') || types.includes('text/uri-list')) : (types.indexOf('Files') !== -1 || types.indexOf('text/uri-list') !== -1))) {
      e.preventDefault();
      dragCounter++;
      showDropzone = true;
    }
  }

  function onGlobalDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      showDropzone = false;
    }
  }

  function onGlobalDragOver(e) {
    const types = e.dataTransfer?.types;
    if (types && (types.includes ? (types.includes('Files') || types.includes('text/uri-list')) : (types.indexOf('Files') !== -1 || types.indexOf('text/uri-list') !== -1))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!showDropzone) {
         showDropzone = true;
         dragCounter = 1;
      }
    }
  }

  function onGlobalDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    showDropzone = false;
    
    if (e.dataTransfer && e.dataTransfer.files) {
      const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            const MAX_DIM = 512;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compressione leggera a JPEG
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const fakeImgId = `upload-${Date.now()}`;
            const frame = { imgId: fakeImgId, url: dataUrl, title: file.name };
            
            // Aggiungiamo lo step e avviamo la ricerca
            addSimilarityAsSearchStep(dataUrl, frame);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    
    // Fallback: controllo se è stato trascinato un URL
    const url = e.dataTransfer?.getData('URL') || e.dataTransfer?.getData('text/uri-list');
    if (url && url.startsWith('http')) {
       const fakeImgId = `url-${Date.now()}`;
       const frame = { imgId: fakeImgId, url: url, title: "Dropped Image" };
       addSimilarityAsSearchStep(url, frame);
    }
  }

  function resetSearchScroll() {
    lastViewedSearchIndex = 0;
    scrollMgr.resetScroll('View1');
  }

  function resolveSummaryLabel(videoId, highlightImgId = null) {
    const normalizedHighlight = String(highlightImgId || '').trim();
    if (normalizedHighlight) {
      const fromSearch = images.find((i) => i?.imgId === normalizedHighlight);
      const fromSimilarity = similarityImages.find((i) => i?.imgId === normalizedHighlight);
      const fromView2 = (view2Frames || []).find((i) => i?.imgId === normalizedHighlight);
      const source = fromSearch || fromSimilarity || fromView2;
      return source?.title || source?.imgId || normalizedHighlight;
    }
    return String(videoId || '').trim();
  }

  function toPinnedSummaryKey(videoId, highlightImgId = null) {
    const safeVideoId = String(videoId || '').trim();
    const safeHighlight = String(highlightImgId || '').trim();
    return `${safeVideoId}::${safeHighlight}`;
  }

  function pinCurrentVideoSummary() {
    const videoId = String(activeVideoSummaryContext.videoId || '').trim();
    if (!videoId) return;

    const highlightImgId = String(activeVideoSummaryContext.highlightImgId || '').trim() || null;
    const result = sessionStore.actions.pinVideoSummary({
      videoId,
      highlightImgId,
      label: activeVideoSummaryContext.label || videoId
    });

    if (!result?.added) {
      toasts.info('Video summary already pinned');
      return;
    }

    toasts.success('Video summary pinned');
  }

  function openPinnedVideoSummary(item) {
    if (!item?.videoId) return;
    openVideoSummary(item.videoId, item.highlightImgId || null);
  }

  function unpinVideoSummary(item) {
    if (!item?.videoId) return;
    sessionStore.actions.unpinVideoSummary({
      videoId: item.videoId,
      highlightImgId: item.highlightImgId || null
    });
  }

  function clearPinnedVideoSummaries() {
    sessionStore.actions.clearPinnedVideoSummaries();
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
  let isVideoSummaryModalOpen = false;
  let pinnedVideoSummaries = [];
  let activeVideoSummaryContext = { videoId: null, highlightImgId: null, label: '' };
  let activePinnedSummaryKey = '';

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
    const { keyframeSize, theme, dresEnabled } = $uiStore;
    document.documentElement.style.setProperty('--kf-size', `${keyframeSize}px`);
    document.documentElement.style.setProperty('--min-card-w', `${Math.round(keyframeSize * 1.1)}px`);
    document.documentElement.setAttribute('data-theme', theme || 'default');
    document.documentElement.setAttribute('data-dres-enabled', dresEnabled ? 'true' : 'false');
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
  $: submittedAnswers = $sessionStore.submittedAnswers;
  $: pinnedVideoSummaries = $sessionStore.pinnedVideoSummaries || [];
  $: activePinnedSummaryKey = toPinnedSummaryKey(
    activeVideoSummaryContext.videoId,
    activeVideoSummaryContext.highlightImgId
  );

  // Derivate
  $: totalImages = images.length;

  // Query UI
  const DEFAULT_TEXT_MODEL = 'openclip_clip_vit_b_32';
  const DEFAULT_IMAGE_MODEL = 'dinov2_base';
  let textareas = [{ value: "", enabled: true, model: DEFAULT_TEXT_MODEL }];
  let availableModels = [];
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
  const STATUS_BAR_HEIGHT_PX = 34;
  const URL_SYNC_DEBOUNCE_MS = 180;
  let urlSyncTimer = null;
  let lastSearchResultSet = null;

  function getSearchImageIdFromTextareas() {
    const similarityStep = textareas.find((t) => String(t?.similarityImgId || '').trim());
    return String(similarityStep?.similarityImgId || '').trim() || null;
  }

  function getRecentSimilarityPreview(searchTextareas = textareas) {
    const steps = Array.isArray(searchTextareas) ? searchTextareas : [];
    const similarityIndex = steps.findIndex((t) => {
      return !!t?.enabled && !!String(t?.similarityImgId || '').trim();
    });
    if (similarityIndex < 0) return null;

    const similarityImgId = String(steps[similarityIndex]?.similarityImgId || '').trim();
    const imagesForStep = Array.isArray(textareaImages[similarityIndex]) ? textareaImages[similarityIndex] : [];
    const primaryImage = imagesForStep.find((img) => img?.type === 'result') || imagesForStep[0] || null;

    const rawUrl = String(primaryImage?.url || '').trim();
    const safeUrl = rawUrl && !rawUrl.startsWith('data:') && rawUrl.length <= 2048 ? rawUrl : '';
    const fallbackImgId = String(primaryImage?.imgId || '').trim();
    const imgId = similarityImgId || fallbackImgId || null;

    if (!imgId && !safeUrl) return null;

    return {
      imgId,
      url: safeUrl || null,
      name: String(primaryImage?.name || similarityImgId || 'Similarity').trim()
    };
  }

  async function hydrateSimilarityTextareaImagesFromState() {
    const nextTextareaImages = { ...textareaImages };
    let changed = false;
    const pendingResolves = [];

    textareas.forEach((t, idx) => {
      const rawImgId = String(t?.similarityImgId || '').trim();
      if (!rawImgId) return;
      const normalizedImgId = rawImgId.replace(/\.jpg$/i, '');

      const currentImages = nextTextareaImages[idx] || [];
      const alreadyHasQueryImage = currentImages.some(
        (img) => String(img?.imgId || '').trim().replace(/\.jpg$/i, '') === normalizedImgId
      );
      if (alreadyHasQueryImage) return;

      const hourMatch = normalizedImgId.match(/^(\d{8}_\d{2})\d{4}_\d{3}$/i);
      const videoId = hourMatch?.[1] || normalizedImgId.split('-')[0]?.padStart(5, '0') || '';
      if (!videoId) return;

      nextTextareaImages[idx] = [
        {
          url: tinyFrameUrl(videoId, normalizedImgId),
          name: rawImgId,
          type: 'result',
          imgId: normalizedImgId
        }
      ];
      changed = true;
      pendingResolves.push({ idx, rawImgId, normalizedImgId });
    });

    if (changed) {
      textareaImages = nextTextareaImages;
    }

    await Promise.allSettled(
      pendingResolves.map(async ({ idx, rawImgId, normalizedImgId }) => {
        try {
          let urls = null;
          try {
            urls = await visioneAPI.getElementUrls(rawImgId, ['thumbnails', 'images']);
          } catch {
            urls = await visioneAPI.getElementUrls(normalizedImgId, ['thumbnails', 'images']);
          }

          const resolvedUrl = String(urls?.thumbnails || urls?.images || '').trim();
          if (!resolvedUrl) return;

          const activeSimilarity = String(textareas[idx]?.similarityImgId || '').trim().replace(/\.jpg$/i, '');
          if (activeSimilarity !== normalizedImgId) return;

          const currentImages = Array.isArray(textareaImages[idx]) ? textareaImages[idx] : [];
          const primary = currentImages[0] || {};

          textareaImages = {
            ...textareaImages,
            [idx]: [
              {
                ...primary,
                url: resolvedUrl,
                name: String(primary?.name || rawImgId),
                type: 'result',
                imgId: normalizedImgId
              }
            ]
          };
        } catch {
          // Keep synthesized fallback URL when metadata lookup fails.
        }
      })
    );
  }

  function scheduleURLSync() {
    if (isRestoringFromHistory || !browser) return;

    if (urlSyncTimer) {
      clearTimeout(urlSyncTimer);
      urlSyncTimer = null;
    }

    urlSyncTimer = setTimeout(() => {
      urlSyncTimer = null;
      updateURL({ textareas, activeTab: get(uiStore).layoutTab, imageId: getSearchImageIdFromTextareas() }, false);
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

  // Memoized flat lists (recomputed only when display rows change)
  let flatDisplayList = [];
  $: flatDisplayList = displayRows?.flat?.() ?? [];
  let flatSimilarityList = [];
  $: flatSimilarityList = similarityDisplayRows?.flat?.() ?? [];

  const registerContainer = (el) => { scrollMgr.registerContainer('View1', el); imagesContainer = el; };
  const registerSimilarityContainer = (el) => { scrollMgr.registerContainer('Similarity', el); similarityContainer = el; };
  const registerView2Container = (el) => { scrollMgr.registerContainer('View2', el); view2Container = el; };

  let prevLayoutTab = null;
  $: if ($uiStore.layoutTab && $uiStore.layoutTab !== prevLayoutTab) {
    const nextTab = $uiStore.layoutTab;
    scrollMgr.handleTabChange(nextTab);
    prevLayoutTab = nextTab;
  }

  let _submittedIdsSet = new Set();
  $: _submittedIdsSet = new Set(($sessionStore.submittedImages || []).map(s => s.imgId));
  const getSubmittedIds = () => _submittedIdsSet;

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
    getSimilarityPreview: getRecentSimilarityPreview,

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

  // Reactive O(1) lookup indexes for imgId-based operations (DRES, RF, etc.)
  let _imagesIdx = new Map();
  let _simIdx = new Map();
  let _v2Idx = new Map();
  $: _imagesIdx = new Map(images.map((img, i) => [img.imgId, i]));
  $: _simIdx = new Map(similarityImages.map((img, i) => [img.imgId, i]));
  $: _v2Idx = new Map((view2Frames || []).map((f, i) => [f.imgId, i]));

  // DRES submission controller
  const dresCtrl = createDresController({
    sessionStore,
    findFrame: (imgId, fallback) => {
      const gIdx = _imagesIdx.get(imgId);
      if (gIdx !== undefined) return images[gIdx];
      const sIdx = _simIdx.get(imgId);
      if (sIdx !== undefined) return similarityImages[sIdx];
      const fIdx = _v2Idx.get(imgId);
      if (fIdx !== undefined) return view2Frames[fIdx];
      return fallback
        ? {
            title: fallback.title ?? fallback.imgId,
            videoId: fallback.videoId ?? String(fallback.imgId).split("-")[0],
            imgId: fallback.imgId,
            url: fallback.url || "",
            submitted: true,
            submissionVerdict: fallback.submissionVerdict,
            raw: fallback.raw ?? null
          }
        : null;
    },
    updateVerdictInViews: (imgId, verdict) => {
      const fIdx = _v2Idx.get(imgId);
      if (fIdx !== undefined) {
        view2Frames[fIdx] = { ...view2Frames[fIdx], submissionVerdict: verdict };
        view2Frames = [...view2Frames];
      }
      const sIdx = _simIdx.get(imgId);
      if (sIdx !== undefined) {
        similarityImages[sIdx] = { ...similarityImages[sIdx], submissionVerdict: verdict };
        similarityImages = [...similarityImages];
      }
      const gIdx = _imagesIdx.get(imgId);
      if (gIdx !== undefined) {
        images[gIdx] = { ...images[gIdx], submissionVerdict: verdict };
        images = [...images];
      }
    },
    markSubmittedInViews: (id) => {
      const fIdx = _v2Idx.get(id);
      if (fIdx !== undefined) {
        view2Frames[fIdx] = { ...view2Frames[fIdx], submitted: true };
        view2Frames = [...view2Frames];
      }
      const sIdx = _simIdx.get(id);
      if (sIdx !== undefined) {
        similarityImages[sIdx] = { ...similarityImages[sIdx], submitted: true };
        similarityImages = [...similarityImages];
      }
      const gIdx = _imagesIdx.get(id);
      if (gIdx !== undefined) {
        images[gIdx] = { ...images[gIdx], submitted: true };
        images = [...images];
      }
    }
  });

  const submitByImgId = (imgId, fallback) => dresCtrl.submitByImgId(imgId, fallback);
  const submitTextAnswer = (text) => dresCtrl.submitTextAnswer(text);
  const handleTestDresConnection = (e) => dresCtrl.testConnection(e);

  // Video player controller
  const videoPlayerCtrl = createVideoPlayerController({
    getImages: () => images,
    getSimilarityImages: () => similarityImages,
  });

  // Aggiorna i dataset nei controller quando cambiano
  $: searchModal.setItems(images);
  $: if (!$similarityModal.isOpen) similarityModal.setItems(flatSimilarityList);
  $: if (view2Frames) videoModal.setItems(view2Frames);

  // ---------------------------
  // URL restore
  // ---------------------------
  async function restoreFromURLState(urlState) {
    if (urlState.textareas) {
      textareas = urlState.textareas.map((t) => {
        const hasSimilarity = !!String(t?.similarityImgId || '').trim();
        const fallbackModel = hasSimilarity ? DEFAULT_IMAGE_MODEL : DEFAULT_TEXT_MODEL;
        return {
          ...t,
          model: String(t?.model || '').trim() || fallbackModel
        };
      });
    }
    await hydrateSimilarityTextareaImagesFromState();

    if (urlState.activeTab) {
      uiStore.actions.setLayoutTab(urlState.activeTab);
    }

    await tick();

    const hasTextQuery = (urlState.textareas || []).some((t) => String(t?.value || '').trim());
    const hasImageQuery = (urlState.textareas || []).some((t) => String(t?.similarityImgId || '').trim());

    if (urlState.textareas?.length > 0 && (hasTextQuery || hasImageQuery)) {
      await runSearchImmediate();
    }

    if (urlState.similarityBase) {
      await openSimilarity(urlState.similarityBase);
    }
  }

  onMount(() => {
    const clearInitialSidebarBootstrap = () => {
      if (!browser) return;
      const root = document.documentElement;
      root.removeAttribute('data-initial-sidebar-left-open');
      root.removeAttribute('data-initial-sidebar-right-open');
      root.removeAttribute('data-initial-dres-enabled');
      root.style.removeProperty('--initial-sidebar-left-width');
      root.style.removeProperty('--initial-sidebar-right-width');
    };

    const init = async () => {
      uiStore.actions.hydrateFromSettings();
      uiStore.actions.setLayoutTab('View1'); // refresh sempre View1
      await tick();
      clearInitialSidebarBootstrap();

      // Load available models from /discovery (non-blocking)
      visioneAPI.discovery().then((data) => {
        if (Array.isArray(data?.available_models)) {
          availableModels = data.available_models;
        }
      }).catch(() => {});

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
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
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

  function handleReplaceSimilarityImage(e) {
    const { index, imgId, url, name } = e.detail || {};
    if (typeof index !== 'number' || index < 0 || index >= textareas.length) return;

    textareas = textareas.map((t, idx) => {
      if (idx !== index) return t;
      return {
        ...t,
        enabled: true,
        model: String(t?.model || '').trim() || DEFAULT_IMAGE_MODEL,
        similarityImgId: String(imgId || t?.similarityImgId || '').trim()
      };
    });

    textareaImages = {
      ...textareaImages,
      [index]: [
        {
          url,
          name: name || String(imgId || `Similarity ${index + 1}`),
          type: 'result',
          imgId: imgId || null
        }
      ]
    };

    setTimeout(() => runSearchImmediate(), 0);
  }

  function handleCloseSimilarityStep(e) {
    const { index } = e.detail || {};
    if (typeof index !== 'number' || index < 0 || index >= textareas.length) return;

    const hadRestorableSteps = textareas.some((t) => t?._disabledBySimilarity);

    textareas = textareas.map((t, idx) => {
      if (idx !== index) return t;
      return {
        ...t,
        value: '',
        similarityImgId: '',
        enabled: false,
        _disabledBySimilarity: false,
        _wasEnabledBeforeSimilarity: false
      };
    });

    if (hadRestorableSteps) {
      restoreDisabledStepsFromSimilarity();
      return;
    }

    setTimeout(() => runSearchImmediate(), 0);
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
    const currentIndex = $searchModal.selected?.index ?? lastViewedSearchIndex ?? -1;
    let targetIndex = -1;

    if (toFirstOfRow) {
      targetIndex = getFirstOfNextRow(Math.max(0, currentIndex), offset);
    } else {
      // Navigate in display order (respects byvideo/bydate grouping)
      const list = flatDisplayList;
      if (!list || list.length === 0) return;
      const curPos = list.findIndex(item => item.index === currentIndex);
      const nextPos = curPos < 0
        ? 0
        : (curPos + offset + list.length) % list.length;
      targetIndex = list[nextPos]?.index ?? 0;
    }

    if (targetIndex >= 0 && targetIndex < images.length) {
      const targetItem = images[targetIndex];
      searchModal.select(targetItem);
      lastViewedSearchIndex = targetIndex;
      tick().then(() => ui.scrollToImage(imagesContainer, targetIndex));
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
    const items = flatSimilarityList;
    if (!items || items.length === 0) return;

    const currentIndex = $similarityModal.selected?.index ?? lastViewedSimilarityIndex ?? -1;
    let targetIndex = -1;

    if (toFirstOfRow) {
      targetIndex = getFirstOfNextRow(Math.max(0, currentIndex), offset);
    } else {
      // Navigate in display order (respects byvideo/bydate grouping)
      const curPos = items.findIndex(item => item.index === currentIndex);
      const nextPos = curPos < 0
        ? 0
        : (curPos + offset + items.length) % items.length;
      targetIndex = items[nextPos]?.index ?? 0;
    }

    if (targetIndex >= 0 && targetIndex < similarityImages.length) {
      const targetItem = similarityImages[targetIndex];
      similarityModal.select(targetItem);
      lastViewedSimilarityIndex = targetIndex;
      tick().then(() => ui.scrollToImage(similarityContainer, targetIndex));
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
    const items = view2Frames || [];
    if (items.length === 0) return;

    const currentIndex = $videoModal.selected?.index ?? lastViewedVideoIndex ?? -1;
    let targetIndex = -1;

    if (toFirstOfRow) {
      targetIndex = getFirstOfNextRow(Math.max(0, currentIndex), offset);
    } else {
      if (currentIndex === -1) {
        targetIndex = 0;
      } else {
        targetIndex = (currentIndex + offset + items.length) % items.length;
      }
    }

    if (targetIndex >= 0 && targetIndex < items.length) {
      const targetFrame = items[targetIndex];
      videoModal.select(targetFrame);
      view2SelectedImgId = targetFrame.imgId;
      lastViewedVideoIndex = targetIndex;
      tick().then(() => ui.scrollToImage(view2Container, targetFrame.imgId));
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
      view2SelectedImgId = String(imgId);
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
      textareas = urlState.textareas.map((t) => {
        const hasSimilarity = !!String(t?.similarityImgId || '').trim();
        const fallbackModel = hasSimilarity ? DEFAULT_IMAGE_MODEL : DEFAULT_TEXT_MODEL;
        return {
          ...t,
          model: String(t?.model || '').trim() || fallbackModel
        };
      });
      await hydrateSimilarityTextareaImagesFromState();
    }

    if (urlState.activeTab) uiStore.actions.setLayoutTab(urlState.activeTab);

    await tick();
    await runSearchImmediate();
  }

  async function handleRestoreRecentSearch(e) {
    const savedTextareas = Array.isArray(e?.detail?.textareas) ? e.detail.textareas : [];
    if (savedTextareas.length === 0) return;

    textareas = savedTextareas.map((t) => ({ ...t }));
    await hydrateSimilarityTextareaImagesFromState();
    uiStore.actions.setLayoutTab('View1');

    await tick();
    await runSearchImmediate();
  }

  async function openVideoSummary(videoId, highlightImgId = null) {
    isVideoSummaryModalOpen = true;
    const rawVideoId = String(videoId || '').trim().replace(/\.mp4$/i, '');
    const normalizedVideoId = /^\d+$/.test(rawVideoId) ? rawVideoId.padStart(5, '0') : rawVideoId;
    const normalizedHighlight = String(highlightImgId || '').trim() || null;
    activeVideoSummaryContext = {
      videoId: normalizedVideoId,
      highlightImgId: normalizedHighlight,
      label: resolveSummaryLabel(normalizedVideoId, normalizedHighlight)
    };

    if (!highlightImgId) lastViewedVideoIndex = 0;

    await videoController.openVideoSummary(normalizedVideoId, normalizedHighlight);
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

  function addSimilarityAsSearchStep(baseImgId, frame = null) {
    const imgId = String(baseImgId || "").trim();
    if (!imgId) return;

    const existingSimilarityIndex = textareas.findIndex((t) => String(t?.similarityImgId || "").trim());
    let targetIndex = existingSimilarityIndex;
    let nextTextareas;

    if (existingSimilarityIndex >= 0) {
      nextTextareas = textareas.map((t, idx) => {
        if (idx === existingSimilarityIndex) {
          return {
            ...t,
            value: "",
            enabled: true,
            model: DEFAULT_IMAGE_MODEL,
            similarityImgId: imgId
          };
        }
        // Mark non-similarity steps as disabled-by-similarity so "Restore steps" works
        const wasEnabled = t._disabledBySimilarity ? t._wasEnabledBeforeSimilarity : !!t.enabled;
        return {
          ...t,
          enabled: false,
          _wasEnabledBeforeSimilarity: wasEnabled,
          _disabledBySimilarity: wasEnabled
        };
      });
    } else {
      const similarityStep = {
        value: "",
        enabled: true,
        model: DEFAULT_IMAGE_MODEL,
        similarityImgId: imgId
      };
      const disabledExisting = textareas.map((t) => ({
        ...t,
        _wasEnabledBeforeSimilarity: !!t.enabled,
        _disabledBySimilarity: !!t.enabled,
        enabled: false
      }));
      nextTextareas = [...disabledExisting, similarityStep];
      targetIndex = nextTextareas.length - 1;
    }

    const resolvedFrame =
      frame ||
      images.find((i) => i?.imgId === imgId) ||
      similarityImages.find((i) => i?.imgId === imgId) ||
      (view2Frames || []).find((i) => i?.imgId === imgId) ||
      null;

    textareas = nextTextareas;

    if (resolvedFrame?.url) {
      textareaImages = {
        ...textareaImages,
        [targetIndex]: [
          {
            url: resolvedFrame.url,
            name: resolvedFrame.title || resolvedFrame.imgId || `Similarity ${targetIndex + 1}`,
            type: "result",
            imgId: resolvedFrame.imgId || imgId
          }
        ]
      };
    }

    uiStore.actions.setLayoutTab("View1");
    toasts.info(existingSimilarityIndex >= 0 ? "Similarity image replaced in active query step" : "Similarity added as active query step");
    setTimeout(() => runSearchImmediate(), 0);
  }

  function restoreDisabledStepsFromSimilarity() {
    const hadRestorableSteps = textareas.some((t) => t?._disabledBySimilarity);
    if (!hadRestorableSteps) return;

    textareas = textareas.map((t) => {
      if (!t?._disabledBySimilarity) {
        return {
          ...t,
          _disabledBySimilarity: false,
          _wasEnabledBeforeSimilarity: false
        };
      }
      return {
        ...t,
        enabled: t?._wasEnabledBeforeSimilarity === true,
        _disabledBySimilarity: false,
        _wasEnabledBeforeSimilarity: false
      };
    });

    toasts.info("Previously disabled steps restored");
    setTimeout(() => runSearchImmediate(), 0);
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
        items: flatSimilarityList
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

    textareas = [{ value: "", enabled: true, model: DEFAULT_TEXT_MODEL }];
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
    isVideoSummaryModalOpen = false;
    activeVideoSummaryContext = { videoId: null, highlightImgId: null, label: '' };

    lastViewedSearchIndex = 0;
    lastViewedVideoIndex = 0;
    lastViewedSimilarityIndex = 0;
    selectedIndex = 0;

    scrollMgr.resetAllScrollPositions();
    prevLayoutTab = null;

    if (typeof window !== "undefined") {
      pushState(window.location.pathname, {});
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

<svelte:window 
  on:dragenter={onGlobalDragEnter}
  on:dragleave={onGlobalDragLeave}
  on:dragover={onGlobalDragOver}
  on:drop={onGlobalDrop}
/>

{#if showDropzone}
  <div class="fixed inset-0 z-[9999] bg-blue-900/80 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 pointer-events-none">
    <div class="border-4 border-dashed border-blue-300 rounded-3xl p-16 text-center transform scale-105">
      <svg class="w-24 h-24 text-blue-200 mx-auto mb-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <h2 class="text-4xl font-bold text-white mb-3">Drop image here</h2>
      <p class="text-blue-200 text-xl font-medium">Instantly run a visual similarity search</p>
    </div>
  </div>
{/if}

<!-- Template invariato -->
<Keybindings
  isModalOpen={$searchModal.isOpen || $similarityModal.isOpen || $videoModal.isOpen || isVideoSummaryModalOpen}
  isVideoPlayerOpen={isVideoPlayerOpen}
  onFocusSearch={focusSearchBox}
  onSwitchTab={(tab) => uiStore.actions.setLayoutTab(tab)}
  onSubmitSelected={() => {
    if ($uiStore.dresChallengeType === 'Q&A') {
      toasts.info('Q&A mode: submit a text answer from the Submitted panel.');
      return;
    }
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
    if (item?.imgId) addSimilarityAsSearchStep(item.imgId, item);
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
    if (isVideoSummaryModalOpen) isVideoSummaryModalOpen = false;
    else if ($videoModal.isOpen) closeFrameModal();
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
  challengeType={$uiStore.dresChallengeType}
  on:submitFrame={handleSubmitFrameFromPlayer}
  on:captureForSimilarity={(e) => {
    isVideoPlayerOpen = false;
    addSimilarityAsSearchStep(e.detail.imgId);
  }}
  on:close={() => { isVideoPlayerOpen = false; }}
/>

<VideoSummaryModal
  isOpen={isVideoSummaryModalOpen}
  loading={view2Loading}
  error={view2Error}
  frames={view2Frames}
  videoId={view2VideoId || activeVideoSummaryContext.videoId}
  selectedFrameId={view2SelectedImgId}
  pinnedSummaries={pinnedVideoSummaries}
  {activePinnedSummaryKey}
  showSubmitUI={$uiStore.dresEnabled}
  challengeType={$uiStore.dresChallengeType}
  videoBadgeOrientation={$uiStore.videoBadgeOrientation}
  virtualizationEnabled={$uiStore.virtualizationEnabled}
  virtualizationThreshold={$uiStore.virtualizationThreshold}
  justifyResultRows={$uiStore.justifyResultRows}
  onClose={() => { isVideoSummaryModalOpen = false; }}
  onPinCurrent={pinCurrentVideoSummary}
  onOpenPinned={openPinnedVideoSummary}
  onUnpinPinned={unpinVideoSummary}
  onOpenFrame={(frame) => openFrameModal(frame)}
  onSimilarity={(imgId, img) => addSimilarityAsSearchStep(imgId, img)}
  addRFPositiveByImg={addRFPositiveByImg}
  addRFNegativeByImg={addRFNegativeByImg}
  submitByImgId={submitByImgId}
  openVideoPlayerBy={openVideoPlayerBy}
/>

<SettingsModal
  isOpen={isSettingsOpen}
  theme={$uiStore.theme}
  keyframeSize={$uiStore.keyframeSize}
  resultsPerRow={$uiStore.resultsPerRow}
  resultsAutoFit={$uiStore.resultsAutoFit}
  justifyResultRows={$uiStore.justifyResultRows}
  videoBadgeOrientation={$uiStore.videoBadgeOrientation}
  virtualizationEnabled={$uiStore.virtualizationEnabled}
  virtualizationThreshold={$uiStore.virtualizationThreshold}
  dresEnabled={$uiStore.dresEnabled}
  dresChallengeType={$uiStore.dresChallengeType}
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
  dresEnabled={$uiStore.dresEnabled}
  challengeType={$uiStore.dresChallengeType}
  {pinnedVideoSummaries}
  {activePinnedSummaryKey}
  on:change={(e) => uiStore.actions.setLayoutTab(e.detail.tab)}
  on:toggleSidebar={() => uiStore.actions.toggleSidebar()}
  on:toggleRightSidebar={() => uiStore.actions.toggleRightSidebar()}
  on:changeViewMode={(e) => uiStore.actions.setViewMode(e.detail.mode)}
  on:adjustKeyframeSize={(e) => {
    const delta = Number(e?.detail?.delta) || 0;
    const next = $uiStore.keyframeSize + delta;
    const safe = Math.min(400, Math.max(80, Number(next) || 130));
    uiStore.actions.setKeyframeSize(safe);
  }}
  on:openSettings={() => (isSettingsOpen = true)}
  on:changeChallengeType={(e) => uiStore.actions.setDresChallengeType(e.detail.type)}
  on:reset={resetApp}
  on:openPinnedVideoSummary={(e) => openPinnedVideoSummary(e.detail.item)}
  on:unpinVideoSummary={(e) => unpinVideoSummary(e.detail.item)}
  on:clearPinnedVideoSummaries={clearPinnedVideoSummaries}
>
  <div
    class="views-wrapper w-full overflow-x-hidden"
    style="height: {$tabsPosition === 'top' ? `calc(100vh - 39px - ${STATUS_BAR_HEIGHT_PX}px)` : `calc(100vh - ${STATUS_BAR_HEIGHT_PX}px)`};"
  >
    {#if $uiStore.layoutTab === "View1"}
      <SearchView
        registerContainer={registerContainer}
        isSidebarOpen={$uiStore.isSidebarOpen}
        isSidebarRightOpen={$uiStore.isSidebarRightOpen}
        sidebarRightTab={$uiStore.sidebarRightTab}
        {textareas}
        {availableModels}
        {textareaImages}
        {searchLoading}
        {searchError}
        {searchResultSet}
        {rfPositive}
        {rfNegative}
        {submittedImages}
        {submittedAnswers}
        viewMode={$uiStore.viewMode}
        contentScale={$uiStore.contentScale}
        selectedImage={$searchModal.selected}
        isModalOpen={$searchModal.isOpen}
        totalImages={totalImages}
        rows={displayRows}
        images={images}
        virtualizationEnabled={$uiStore.virtualizationEnabled}
        virtualizationThreshold={$uiStore.virtualizationThreshold}
        justifyResultRows={$uiStore.justifyResultRows}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}
        submitTextAnswer={submitTextAnswer}

        on:selectRightTab={(e) => uiStore.actions.focusRightTab(e.detail.tab)}

        on:loadCachedResults={(e) => {
          searchResultSet = e.detail.cachedResults;
          updateImagesFromResult(searchResultSet);
          resetSearchScroll();
          toasts.success(`📦 Loaded ${images.length} cached results!`);
        }}

        on:restoreRecentSearch={handleRestoreRecentSearch}
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
        on:updateModel={(e) => {
          const { index: i, model: m } = e.detail;
          textareas = textareas.map((t, idx) => (idx === i ? { ...t, model: m } : t));
        }}
        onRestoreDisabledSteps={restoreDisabledStepsFromSimilarity}
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
        onSimilarity={(imgId, img) => addSimilarityAsSearchStep(imgId, img)}
        onCloseModal={closeModal}
        onPrev={() => navigateImage(-1)}
        onNext={() => navigateImage(1)}

        on:swapTextarea={(e) => swapTextareas(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap')}
        onLoadExample={(queries) => loadExampleQuery(queries)}
        on:updateImages={handleUpdateImages}
        on:replaceSimilarityImage={handleReplaceSimilarityImage}
        on:closeSimilarityStep={handleCloseSimilarityStep}
        on:clearQueryInputs={() => {
          textareas = [{ value: "", enabled: true, model: DEFAULT_TEXT_MODEL }];
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
        justifyResultRows={$uiStore.justifyResultRows}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}

        onToggleSidebar={() => uiStore.actions.toggleSidebar()}

        onOpenFrame={(frame) => openFrameModal(frame)}
        onSimilarity={(imgId, img) => addSimilarityAsSearchStep(imgId, img)}
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
        justifyResultRows={$uiStore.justifyResultRows}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}

        onToggleSidebar={() => uiStore.actions.toggleSidebar()}

        openVideoPlayerBy={openVideoPlayerBy}
        openByImgId={openByImgId}
        addRFPositiveByImg={addRFPositiveByImg}
        addRFNegativeByImg={addRFNegativeByImg}
        submitByImgId={submitByImgId}
        onVideoSummary={(vid, imgId) => openVideoSummary(vid, imgId)}
        onSimilarity={(imgId, img) => addSimilarityAsSearchStep(imgId, img)}
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
    dresEnabled={$uiStore.dresEnabled}
    dresUsername={$uiStore.dresUsername}
    onViewSubmitted={handleViewSubmitted}
    onViewRF={handleViewRF}
  />
</AdaptiveTabLayout>
