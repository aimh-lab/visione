<script>
  import * as ui from '../utils/ui';
  import { createModalController } from '../stores/modalController.js';
  import SearchView from "../views/SearchView.svelte";
  import VideoSummaryView from "../views/VideoSummaryView.svelte";
  import SimilarityView from "../views/SimilarityView.svelte";
  import AdaptiveTabLayout from "../components/AdaptiveTabLayout.svelte";

  import SettingsModal from "../components/SettingsModal.svelte";
  import InputModal from "../components/InputModal.svelte";
  import Keybindings from "../components/Keybindings.svelte";
  import { visioneAPI } from '../services/api.js';
  import { transformSearchResults, transformSimilarityResults, transformVideoKeyframes } from '../services/transformers.js';
  import VideoPlayerModal from "../components/VideoPlayerModal.svelte";
  import SlideshowModal from "../components/SlideshowModal.svelte";
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
  import { createVbsLogger } from '../services/vbsLogger.js';
  import { resolveRuntimeProfile } from '$lib/runtimeProfile.js';
  import { resolveViewMode } from '$lib/groupByConfig.js';
  import { addTextarea as _addTextarea, removeTextarea as _removeTextarea, toggleTextarea as _toggleTextarea, swapTextareas as _swapTextareas, loadExampleQuery as _loadExampleQuery } from '$lib/controllers/textareaController.js';
  import { buildRows } from '$lib/ui/buildRows.js';
  import { getFirstOfNextRowDOM } from '$lib/ui/domRowNav.js';

  import { onMount, onDestroy, tick } from "svelte";

  // ---------------------------
  // Non-UI local state
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
            
            // Add the step and trigger search
            addSimilarityAsSearchStep(dataUrl, frame);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    
    // Fallback: check whether a URL was dropped
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
  let isSlideshowOpen = false;
  let videoPlayer = {
    url: "",
    startTime: 0,
    title: "",
    videoId: "",
    highlightedKeyframes: []
  };
  let slideshowPlayer = {
    videoId: "",
    selectedImgId: "",
    title: "",
    highlightedKeyframes: []
  };

  // Settings modal (open/close state only)
  let isSettingsOpen = false;
  let isVideoSummaryModalOpen = false;
  let dresEvaluationOptions = [];
  let selectedDresEvaluationLabel = '';
  let dresEvaluationLoadKey = '';
  let isLoadingDresEvaluationOptions = false;
  let isQaAnswerModalOpen = false;
  let qaAnswerContext = { imgId: '', source: '', title: '' };
  let qaAgentStream = { isStreaming: false, events: [], finalAnswer: '', error: '' };
  let qaAgentSubmitCandidate = '';
  let qaAgentAbortController = null;
  let qaAgentRequestId = '';
  let sessionResetKey = 0;
  let pinnedVideoSummaries = [];
  let activeVideoSummaryContext = { videoId: null, highlightImgId: null, label: '' };
  let activePinnedSummaryKey = '';
  let activeCollectionName = 'default';
  let runtimeProfile = resolveRuntimeProfile(activeCollectionName, $uiStore.dresChallengeType || 'default');
  let lastDiscoveryPayload = null;
  let discoveryMetadataFields = [];

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
  $: runtimeProfile = resolveRuntimeProfile(activeCollectionName, $uiStore.dresChallengeType || 'default');
  $: discoveryMetadataFields = extractMetadataFieldsFromDiscovery(lastDiscoveryPayload, activeCollectionName);
  $: {
    const challengeType = String($uiStore.dresChallengeType || 'KIS');
    const selectedId = String($uiStore.dresEvaluationIdByChallenge?.[challengeType] || '').trim();
    const match = dresEvaluationOptions.find((item) => item.id === selectedId);
    selectedDresEvaluationLabel = String(match?.displayName || match?.name || '').trim();
  }
  $: {
    const safeViewMode = resolveViewMode($uiStore.viewMode, runtimeProfile);
    if (safeViewMode !== $uiStore.viewMode) {
      uiStore.actions.setViewMode(safeViewMode);
    }
  }
  $: visioneAPI.defaultTextModel = getGlobalDefaultTextModel();
  $: visioneAPI.defaultImageModel = getGlobalDefaultImageModel();
  $: visioneAPI.setDataserverHost($uiStore.dataserverHost);
  $: visioneAPI.setActiveCollectionName(activeCollectionName);

  // ---------------------------
  // CSS vars (driven only by uiStore)
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

  // submittedImages: currently in-session (Commit 2: sessionStore)
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
  const DEFAULT_RF_MODEL = 'qwen_embedding_8B';
  let textareas = [{ value: "", enabled: true, textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL }];
  let availableModels = [];
  let textareaImages = {};
  $: rfPositive = $sessionStore.rfPositive;
  $: rfNegative = $sessionStore.rfNegative;
  let rfEnabled = true;
  let rfMethod = 'svm';
  let selectedIndex = 0;

  // View2 state
  let view2Frames = null;
  let view2VideoId = null;
  let view2Loading = false;
  let view2Error = null;
  let view2SelectedImgId = null;

  // Similarity state
  let similarityLoading = false;
  let similarityError = null;
  let similarityResultSet = null;
  let similarityImages = [];
  let similarityBaseImgId = null;

  // Similarity UI
  let similarityDisplayRows = [];
  let focusSearchInputHandler = () => {};

  // Separate variables for each view
  let lastViewedSearchIndex = 0;
  let lastViewedVideoIndex = 0;
  let lastViewedSimilarityIndex = 0;

  let searchTime = 0;
  let translatedQueryHints = {};
  let logCount = 0;
    function normalizeTranslationHints(rawHints, steps) {
      const source = rawHints && typeof rawHints === 'object' ? rawHints : {};
      const out = {};

      Object.entries(source).forEach(([key, hint]) => {
        const idx = Number(key);
        if (!Number.isInteger(idx) || idx < 0) return;

        const from = String(hint?.from || '').trim();
        const to = String(hint?.to || '').trim();
        if (!from || !to || from === to) return;

        const current = String(steps?.[idx]?.value || '').trim();
        if (!current) return;
        if (current !== from && current !== to) return;

        out[idx] = { from, to };
      });

      return out;
    }

    function hintsEqual(a, b) {
      const aa = JSON.stringify(a || {});
      const bb = JSON.stringify(b || {});
      return aa === bb;
    }

    $: {
      const normalized = normalizeTranslationHints(translatedQueryHints, textareas);
      if (!hintsEqual(normalized, translatedQueryHints)) {
        translatedQueryHints = normalized;
      }
    }

  let logUserFolder = 'unknown-user';
  let isExportingLogs = false;
  let isDeletingLogs = false;
  let logResultsLimit = 10000;
  const STATUS_BAR_HEIGHT_PX = 34;
  const URL_SYNC_DEBOUNCE_MS = 180;
  let urlSyncTimer = null;
  let lastSearchResultSet = null;

  function getSearchImageIdFromTextareas() {
    const similarityStep = textareas.find((t) => String(t?.similarityImgId || '').trim());
    return String(similarityStep?.similarityImgId || '').trim() || null;
  }

  function getGlobalDefaultTextModel() {
    const configured = String(get(uiStore).defaultTextModel || '').trim();
    const discovered = getDiscoveredModelNames('text');

    if (configured && (discovered.length === 0 || discovered.includes(configured))) {
      return configured;
    }

    return discovered[0] || DEFAULT_TEXT_MODEL;
  }

  function getGlobalDefaultImageModel() {
    const configured = String(get(uiStore).defaultImageModel || '').trim();
    const discovered = getDiscoveredModelNames('image');

    if (configured && (discovered.length === 0 || discovered.includes(configured))) {
      return configured;
    }

    return discovered[0] || DEFAULT_IMAGE_MODEL;
  }

  function normalizeAvailableModelEntry(input) {
    if (typeof input === 'string') {
      const name = input.trim();
      if (!name) return null;
      return { name, modalities: ['text', 'image'] };
    }

    if (!input || typeof input !== 'object') return null;

    const name = String(input?.name || '').trim();
    if (!name) return null;

    const modalities = Array.isArray(input?.modalities)
      ? input.modalities.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
      : [];

    return {
      name,
      modalities: modalities.length > 0 ? Array.from(new Set(modalities)) : ['text', 'image']
    };
  }

  function supportsTextModel(entry) {
    return entry.modalities.includes('text') || entry.modalities.includes('image+text');
  }

  function supportsImageModel(entry) {
    return entry.modalities.includes('image') || entry.modalities.includes('image+text');
  }

  function getDiscoveredModelNames(kind = 'text') {
    const entries = (Array.isArray(availableModels) ? availableModels : [])
      .map((m) => normalizeAvailableModelEntry(m))
      .filter((m) => !!m);

    const filtered = kind === 'image'
      ? entries.filter((m) => supportsImageModel(m))
      : entries.filter((m) => supportsTextModel(m));

    return Array.from(new Set(filtered.map((m) => m.name).filter(Boolean)));
  }

  function normalizeTextareaModels(textarea) {
    const legacyModel = String(textarea?.model || '').trim();
    const rawTextModel = String(textarea?.textModel || legacyModel || getGlobalDefaultTextModel()).trim();
    const rawImageModel = String(textarea?.imageModel || legacyModel || getGlobalDefaultImageModel()).trim();

    const discoveredText = getDiscoveredModelNames('text');
    const discoveredImage = getDiscoveredModelNames('image');

    const textModel = rawTextModel && (discoveredText.length === 0 || discoveredText.includes(rawTextModel))
      ? rawTextModel
      : getGlobalDefaultTextModel();

    const imageModel = rawImageModel && (discoveredImage.length === 0 || discoveredImage.includes(rawImageModel))
      ? rawImageModel
      : getGlobalDefaultImageModel();

    return {
      ...textarea,
      textModel,
      imageModel
    };
  }

  function alignModelDefaultsFromDiscovery() {
    const discoveredText = getDiscoveredModelNames('text');
    const discoveredImage = getDiscoveredModelNames('image');
    if (discoveredText.length === 0 && discoveredImage.length === 0) return;

    const ui = get(uiStore);
    const configuredText = String(ui?.defaultTextModel || '').trim();
    const configuredImage = String(ui?.defaultImageModel || '').trim();

    const shouldAutoSetText = !configuredText || configuredText === DEFAULT_TEXT_MODEL;
    const shouldAutoSetImage = !configuredImage || configuredImage === DEFAULT_IMAGE_MODEL;

    const fallbackText = discoveredText[0] || configuredText || DEFAULT_TEXT_MODEL;
    const fallbackImage = discoveredImage[0] || configuredImage || DEFAULT_IMAGE_MODEL;

    const nextText = shouldAutoSetText ? fallbackText : configuredText;
    const nextImage = shouldAutoSetImage ? fallbackImage : configuredImage;

    if (nextText !== configuredText || nextImage !== configuredImage) {
      uiStore.actions.applySettings({
        defaultTextModel: nextText,
        defaultImageModel: nextImage
      });
    }

    const normalized = textareas.map((t) => normalizeTextareaModels(t));
    const changed = normalized.some((n, idx) =>
      n.textModel !== textareas[idx]?.textModel || n.imageModel !== textareas[idx]?.imageModel
    );
    if (changed) {
      textareas = normalized;
    }
  }

  function getInlineQueryImagesForURL() {
    const out = [];

    textareas.forEach((t, idx) => {
      // Keep inline image state separate from similarity-step semantics.
      if (String(t?.similarityImgId || '').trim()) return;

      const imagesForStep = Array.isArray(textareaImages[idx]) ? textareaImages[idx] : [];
      const primaryResultImage = imagesForStep.find((img) => {
        const imgId = String(img?.imgId || '').trim();
        return img?.type === 'result' && imgId.length > 0;
      });

      const imgId = String(primaryResultImage?.imgId || '').trim();
      if (!imgId) return;

      out.push({ index: idx, imgId });
    });

    return out;
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

      const currentImages = nextTextareaImages[idx] || [];
      const alreadyHasQueryImage = currentImages.some(
        (img) => String(img?.imgId || '').trim() === rawImgId
      );
      if (alreadyHasQueryImage) return;

      const hourMatch = rawImgId.match(/^(\d{8}_\d{2})\d{4}_\d{3}(?:\.[^./]+)?$/i);
      const videoId = hourMatch?.[1] || rawImgId.split('-')[0] || '';
      if (!videoId) return;

      nextTextareaImages[idx] = [
        {
          url: '',
          name: rawImgId,
          type: 'result',
          imgId: rawImgId
        }
      ];
      changed = true;
      pendingResolves.push({ idx, rawImgId });
    });

    if (changed) {
      textareaImages = nextTextareaImages;
    }

    await Promise.allSettled(
      pendingResolves.map(async ({ idx, rawImgId }) => {
        try {
          const urls = await visioneAPI.getElementUrls(rawImgId, ['thumbnails', 'images']);

          const resolvedUrl = String(urls?.thumbnails || urls?.images || '').trim();
          if (!resolvedUrl) return;

          const activeSimilarity = String(textareas[idx]?.similarityImgId || '').trim();
          if (activeSimilarity !== rawImgId) return;

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
                imgId: rawImgId
              }
            ]
          };
        } catch {
          // Keep synthesized fallback URL when metadata lookup fails.
        }
      })
    );
  }

  async function hydrateInlineTextareaImagesFromState(urlState) {
    const entries = Array.isArray(urlState?.inlineQueryImages)
      ? urlState.inlineQueryImages
      : [];
    if (entries.length === 0) return;

    const nextTextareaImages = { ...textareaImages };
    let changed = false;

    for (const entry of entries) {
      const index = Number(entry?.index);
      const rawImgId = String(entry?.imgId || '').trim();
      if (!Number.isInteger(index) || index < 0 || !rawImgId) continue;
      if (index >= textareas.length) continue;

      // Do not inject inline images into explicit similarity steps (different semantics).
      if (String(textareas[index]?.similarityImgId || '').trim()) continue;

      const currentImages = Array.isArray(nextTextareaImages[index]) ? nextTextareaImages[index] : [];
      const alreadyThere = currentImages.some(
        (img) => String(img?.imgId || '').trim() === rawImgId
      );
      if (alreadyThere) continue;

      nextTextareaImages[index] = [
        {
          url: '',
          name: rawImgId,
          type: 'result',
          imgId: rawImgId
        }
      ];
      changed = true;
    }

    if (changed) textareaImages = nextTextareaImages;

    await Promise.allSettled(
      entries.map(async (entry) => {
        const index = Number(entry?.index);
        const rawImgId = String(entry?.imgId || '').trim();
        if (!Number.isInteger(index) || index < 0 || !rawImgId) return;
        if (index >= textareas.length) return;
        if (String(textareas[index]?.similarityImgId || '').trim()) return;

        try {
          const urls = await visioneAPI.getElementUrls(rawImgId, ['thumbnails', 'images']);

          const resolvedUrl = String(urls?.thumbnails || urls?.images || '').trim();
          if (!resolvedUrl) return;

          // Guard against stale async updates.
          if (String(textareas[index]?.similarityImgId || '').trim()) return;
          const currentImages = Array.isArray(textareaImages[index]) ? textareaImages[index] : [];
          if (currentImages.length === 0) return;

          const primary = currentImages[0] || {};
          textareaImages = {
            ...textareaImages,
            [index]: [
              {
                ...primary,
                url: resolvedUrl,
                name: String(primary?.name || rawImgId),
                type: 'result',
                imgId: rawImgId
              }
            ]
          };
        } catch {
          // Keep placeholder metadata if URL resolution fails.
        }
      })
    );
  }

  function scheduleURLSync(textareasOverride = null) {
    if (isRestoringFromHistory || !browser) return;

    if (urlSyncTimer) {
      clearTimeout(urlSyncTimer);
      urlSyncTimer = null;
    }

    const effectiveTextareas = Array.isArray(textareasOverride) ? textareasOverride : textareas;

    urlSyncTimer = setTimeout(() => {
      urlSyncTimer = null;
      updateURL(
        {
          textareas: effectiveTextareas,
          activeTab: get(uiStore).layoutTab,
          imageId: getSearchImageIdFromTextareas(),
          inlineQueryImages: getInlineQueryImagesForURL()
        },
        false
      );
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

  const syncURL = (searchTextareas = null) => {
    scheduleURLSync(searchTextareas);
  };

  function getTextareasForSearch(rawTextareas = textareas) {
    const source = Array.isArray(rawTextareas) ? rawTextareas : [];
    const modelSelectionPerStepEnabled = !!get(uiStore).modelSelectionPerStepEnabled;
    const globalTextModel = getGlobalDefaultTextModel();
    const globalImageModel = getGlobalDefaultImageModel();

    return source.map((t, idx) => {
      const explicitSimilarity = String(t?.similarityImgId || '').trim();
      const baseStep = modelSelectionPerStepEnabled
        ? t
        : {
            ...t,
            textModel: globalTextModel,
            imageModel: globalImageModel
          };

      if (explicitSimilarity) return baseStep;

      const attached = Array.isArray(textareaImages[idx]) ? textareaImages[idx] : [];
      const resultImage = attached.find((img) => {
        const imgId = String(img?.imgId || '').trim();
        return img?.type === 'result' && imgId.length > 0;
      });

      if (!resultImage) return baseStep;

      const imgId = String(resultImage.imgId || '').trim();
      if (!imgId) return baseStep;

      return {
        ...baseStep,
        similarityImgId: imgId
      };
    });
  }

  const vbsLogger = createVbsLogger();

  $: vbsLogger.setOptions({ resultLimit: logResultsLimit });

  function getLoggerContext() {
    const ui = get(uiStore);
    const username = String(ui?.dresUsername || '').trim();
    const memberId = String(ui?.dresMemberId || '').trim();
    return {
      sessionId: `visione-${Date.now()}`,
      username,
      memberId,
      challengeType: ui?.dresChallengeType || 'KIS',
      teamId: '',
      userFolder: username || memberId || 'unknown-user'
    };
  }

  async function refreshLogCount() {
    logUserFolder = String(vbsLogger.getUserFolder() || 'unknown-user');
    try {
      logCount = await vbsLogger.countForCurrentUser();
    } catch {
      logCount = 0;
    }
  }

  function logBrowsingLight(type, value) {
    vbsLogger.logInteractionEvent({
      category: 'BROWSING',
      type,
      value
    }).catch(() => {});
  }

  function logRankedList(action, payload = '') {
    const view = String(get(uiStore)?.layoutTab || 'View1');
    const value = `view:${view} action:${action}${payload ? ` ${payload}` : ''}`;
    logBrowsingLight('rankedList', value);
  }

  function logVideoPlayer(action, payload = '') {
    const vid = String(videoPlayer?.videoId || '').trim();
    const value = `action:${action}${vid ? ` video:${vid}` : ''}${payload ? ` ${payload}` : ''}`;
    logBrowsingLight('videoPlayer', value);
  }

  const searchController = createSearchController({
    api: visioneAPI,
    recentSearches,
    toasts,
    transformSearchResults,
    tick,

    getTextareas: () => textareas,
    getSearchTextareas: getTextareasForSearch,
    setTextareas: (t) => { textareas = t; },
    getFramesPerRow: () => get(uiStore).resultsPerRow,
    getCacheEnabled: () => get(uiStore).cacheEnabled,
    getDedupeResultsEnabled: () => get(uiStore).dedupeResults,
    getAutoTranslateEnabled: () => !!get(uiStore).autoTranslateQueries,
    getTemporalWindowSeconds: () => Number(get(uiStore).temporalWindowSeconds) || 50,
    getSubmittedIds,
    getSimilarityPreview: getRecentSimilarityPreview,
    getRelevanceFeedback: () => {
      if (!rfEnabled) {
        return null;
      }

      const positiveIds = (rfPositive || []).map((r) => String(r?.imgId || '').trim()).filter(Boolean);
      const negativeIds = (rfNegative || []).map((r) => String(r?.imgId || '').trim()).filter(Boolean);

      if (positiveIds.length === 0 && negativeIds.length === 0) {
        return null;
      }

      return {
        positiveIds,
        negativeIds,
        method: rfMethod,
        model: DEFAULT_RF_MODEL,
        numAdditionalNegatives: negativeIds.length === 0 ? 4 : 0
      };
    },

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

    onTranslatedTextareas: ({ textareas: translatedTextareas }) => {
      const translated = Array.isArray(translatedTextareas) ? translatedTextareas : [];
      const nextHints = { ...translatedQueryHints };

      textareas = textareas.map((t, idx) => {
        const candidate = translated[idx];
        const from = String(candidate?.translatedFrom || '').trim();
        const to = String(candidate?.value || '').trim();
        const current = String(t?.value || '').trim();

        if (!from || !to || from === to) {
          return t;
        }

        nextHints[idx] = { from, to };

        if (current !== from) {
          return t;
        }

        return {
          ...t,
          value: to
        };
      });

      translatedQueryHints = normalizeTranslationHints(nextHints, textareas);
    },

    onSearchSnapshot: ({ source, textareas: queryTextareas, relevanceFeedback, resultSet, searchTime: elapsed, translation }) => {
      const hints = { ...translatedQueryHints };
      (Array.isArray(queryTextareas) ? queryTextareas : []).forEach((t, idx) => {
        const from = String(t?.translatedFrom || '').trim();
        const to = String(t?.value || '').trim();
        if (from && to && from !== to) {
          hints[idx] = { from, to };
        }
      });
      translatedQueryHints = normalizeTranslationHints(hints, textareas);

      vbsLogger.logResultSet({
        textareas: queryTextareas,
        relevanceFeedback,
        resultSet,
        source: source === 'cache' ? 'displayModel' : 'rankingModel',
        sortType: 'feedbackModel',
        resultSetAvailability: 'all',
        maxResults: logResultsLimit,
        metadata: {
          elapsedMs: Number(elapsed) || 0,
          activeTab: get(uiStore).layoutTab,
          viewMode: get(uiStore).viewMode,
          translationEnabled: !!translation?.enabled,
          translatedSteps: Number(translation?.translatedCount) || 0
        }
      }).then(refreshLogCount).catch(() => {});
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
    getRuntimeProfile: () => runtimeProfile,
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
    },
    onFrameSubmitEvent: ({ imgId, challengeType, accepted, verdict, description, reason, evaluationId }) => {
      const payload = [
        `imgId:${String(imgId || '')}`,
        `challenge:${String(challengeType || get(uiStore).dresChallengeType || 'KIS')}`,
        `evaluationId:${String(evaluationId || '')}`,
        `accepted:${accepted ? 'true' : 'false'}`,
        `verdict:${String(verdict || '')}`,
        `reason:${String(reason || '')}`,
        `desc:${String(description || '')}`
      ].join(' | ');
      vbsLogger.logInteractionEvent({
        category: 'COOPERATION',
        type: 'submitFrame',
        value: payload
      }).then(refreshLogCount).catch(() => {});
    },
    onTextSubmitEvent: ({ text, challengeType, accepted, verdict, description, evaluationId }) => {
      const payload = [
        `challenge:${String(challengeType || 'Q&A')}`,
        `evaluationId:${String(evaluationId || '')}`,
        `accepted:${accepted ? 'true' : 'false'}`,
        `verdict:${String(verdict || '')}`,
        `desc:${String(description || '')}`,
        `text:${String(text || '')}`
      ].join(' | ');
      vbsLogger.logInteractionEvent({
        category: 'COOPERATION',
        type: 'submitText',
        value: payload
      }).then(refreshLogCount).catch(() => {});
    }
  });

  const submitByImgIdRaw = (imgId, fallback) => dresCtrl.submitByImgId(imgId, fallback);
  const submitTextAnswer = (text) => dresCtrl.submitTextAnswer(text);
  const handleTestDresConnection = (e) => dresCtrl.testConnection(e);

  function normalizeEvaluationOptions(entries) {
    if (!Array.isArray(entries)) return [];

    return entries
      .map((item) => {
        const id = String(item?.id ?? '').trim();
        if (!id) return null;

        return {
          id,
          name: String(item?.name ?? '').trim(),
          displayName: String(item?.name ?? '').trim() || `Evaluation ${String(item?.status ?? '').trim() || String(item?.type ?? '').trim() || ''}`.trim(),
          status: String(item?.status ?? '').trim(),
          type: String(item?.type ?? '').trim()
        };
      })
      .filter((item) => !!item)
      .sort((a, b) => {
        const aActive = a.status === 'ACTIVE' ? 0 : 1;
        const bActive = b.status === 'ACTIVE' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.id.localeCompare(b.id);
      });
  }

  function canLoadDresEvaluations(settingsLike) {
    const settings = settingsLike && typeof settingsLike === 'object' ? settingsLike : {};
    return !!settings?.dresEnabled
      && !!String(settings?.dresSubmitServer || '').trim()
      && !!String(settings?.dresUsername || '').trim()
      && !!String(settings?.dresPassword || '').trim();
  }

  function computeDresEvaluationLoadKey(settingsLike) {
    const settings = settingsLike && typeof settingsLike === 'object' ? settingsLike : {};
    return [
      String(!!settings?.dresEnabled),
      String(settings?.dresSubmitServer || '').trim(),
      String(settings?.dresUsername || '').trim(),
      String(settings?.dresPassword || '').trim(),
      String(settings?.dresChallengeType || 'KIS').trim()
    ].join('|');
  }

  async function refreshDresEvaluationOptions() {
    const currentSettings = get(uiStore);
    if (!canLoadDresEvaluations(currentSettings)) {
      dresEvaluationOptions = [];
      return;
    }

    isLoadingDresEvaluationOptions = true;
    try {
      const entries = await dresCtrl.listEvaluations();
      dresEvaluationOptions = normalizeEvaluationOptions(entries);

      const challengeType = String(get(uiStore).dresChallengeType || 'KIS');
      const selectedEvaluationId = String(get(uiStore).dresEvaluationIdByChallenge?.[challengeType] || '').trim();
      const firstAvailable = String(dresEvaluationOptions[0]?.id || '').trim();

      if (!firstAvailable) {
        return;
      }

      const selectedStillAvailable = dresEvaluationOptions.some((item) => item.id === selectedEvaluationId);
      if (!selectedEvaluationId || !selectedStillAvailable) {
        uiStore.actions.setDresEvaluationId(challengeType, firstAvailable);
      }
    } catch (error) {
      const message = error?.message || String(error || 'Unknown error while loading evaluations');
      toasts.error(`Unable to load DRES evaluations: ${message}`);
    } finally {
      isLoadingDresEvaluationOptions = false;
    }
  }

  $: {
    if (browser) {
      const settings = $uiStore;
      const nextKey = computeDresEvaluationLoadKey(settings);

      if (nextKey !== dresEvaluationLoadKey) {
        dresEvaluationLoadKey = nextKey;

        if (!canLoadDresEvaluations(settings)) {
          dresEvaluationOptions = [];
        } else {
          refreshDresEvaluationOptions().catch(() => {});
        }
      }
    }
  }

  async function stopQaAgent() {
    const requestIdToCancel = String(qaAgentRequestId || '').trim();
    if (requestIdToCancel) {
      try {
        await visioneAPI.cancelQaRequest(requestIdToCancel);
      } catch {
        // Ignore backend cancel failures and still abort local stream.
      }
    }

    if (qaAgentAbortController) {
      qaAgentAbortController.abort();
      qaAgentAbortController = null;
    }

    qaAgentRequestId = '';
    qaAgentStream = { ...qaAgentStream, isStreaming: false };
  }

  async function askQaAgent(question) {
    const value = String(question || '').trim();
    if (!value) {
      return { answer: '', sources: [] };
    }

    if (qaAgentAbortController) {
      qaAgentAbortController.abort();
    }

    qaAgentAbortController = new AbortController();
    qaAgentRequestId = '';
    qaAgentStream = { isStreaming: true, events: [], finalAnswer: '', error: '' };
    qaAgentSubmitCandidate = '';

    try {
      const result = await visioneAPI.streamQaAgent({
        question: value,
        signal: qaAgentAbortController.signal,
        onRequestId: (requestId) => {
          qaAgentRequestId = String(requestId || '').trim();
        },
        onEvent: (evt) => {
          qaAgentStream = {
            ...qaAgentStream,
            events: [...qaAgentStream.events, evt].slice(-80),
            finalAnswer: evt?.type === 'answer'
              ? String(evt?.data?.content || qaAgentStream.finalAnswer || '')
              : qaAgentStream.finalAnswer,
            error: evt?.type === 'error'
              ? String(evt?.data?.detail || 'QA stream error')
              : qaAgentStream.error
          };
          if (evt?.type === 'answer_submit') {
            qaAgentSubmitCandidate = String(evt?.data?.content || '').trim();
          }
        }
      });

      qaAgentStream = {
        ...qaAgentStream,
        isStreaming: false,
        finalAnswer: String(result?.answer || qaAgentStream.finalAnswer || '')
      };
      if (!qaAgentSubmitCandidate) {
        qaAgentSubmitCandidate = String(result?.submitAnswer || '').trim();
      }
      qaAgentRequestId = '';

      return result;
    } catch (error) {
      const isAbort = String(error?.message || '').toLowerCase().includes('abort');
      qaAgentStream = {
        ...qaAgentStream,
        isStreaming: false,
        error: isAbort ? '' : String(error?.message || 'QA stream failed')
      };
      return { answer: '', sources: [] };
    } finally {
      qaAgentAbortController = null;
      qaAgentRequestId = '';
    }
  }

  function isQaChallengeMode() {
    return String(get(uiStore).dresChallengeType || '').trim().toUpperCase() === 'Q&A';
  }

  function openQaAnswerModal({ imgId = '', source = 'submit', title = '' } = {}) {
    qaAnswerContext = {
      imgId: String(imgId || '').trim(),
      source: String(source || 'submit').trim(),
      title: String(title || '').trim()
    };
    isQaAnswerModalOpen = true;
  }

  async function handleQaAnswerSubmit(event) {
    const answer = String(event?.detail?.answer || '').trim();
    await submitTextAnswer(answer);
    isQaAnswerModalOpen = false;
  }

  function submitByImgId(imgId, fallback = null, source = 'submit') {
    if (isQaChallengeMode()) {
      openQaAnswerModal({ imgId, source, title: fallback?.title || fallback?.imgId || '' });
      return Promise.resolve({ accepted: false, verdict: '', description: 'Q&A answer dialog opened' });
    }
    return submitByImgIdRaw(imgId, fallback);
  }

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
      textareas = urlState.textareas.map((t) => normalizeTextareaModels(t));
    }
    await hydrateInlineTextareaImagesFromState(urlState);
    await hydrateSimilarityTextareaImagesFromState();

    if (urlState.activeTab) {
      uiStore.actions.setLayoutTab(urlState.activeTab);
    }

    await tick();

    const hasTextQuery = (urlState.textareas || []).some((t) => String(t?.value || '').trim());
    const hasImageQuery =
      (urlState.textareas || []).some((t) => String(t?.similarityImgId || '').trim()) ||
      (Array.isArray(urlState.inlineQueryImages) && urlState.inlineQueryImages.length > 0);

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
      // Strict startup: keep video URLs disabled until discovery resolves a profile.
      visioneAPI.setSupportsVideos(false);
      await vbsLogger.initSession(getLoggerContext());
      await refreshLogCount();
      uiStore.actions.setLayoutTab('View1'); // refresh sempre View1
      await tick();
      clearInitialSidebarBootstrap();

      // Load /discovery before any initial search so runtime profile is stable.
      try {
        const data = await visioneAPI.discovery();
        lastDiscoveryPayload = data;

        const discoveredModels = extractAvailableModelsFromDiscovery(data);
        if (discoveredModels.length > 0) {
          availableModels = discoveredModels;
          alignModelDefaultsFromDiscovery();
        }

        const discoveredCollection = extractDiscoveryCollectionName(data, activeCollectionName);
        if (discoveredCollection) {
          activeCollectionName = discoveredCollection;
        }

        const profileForMetadata = resolveRuntimeProfile(
          discoveredCollection,
          get(uiStore).dresChallengeType || 'default'
        );
        visioneAPI.setSupportsVideos(profileForMetadata?.media?.hasVideos !== false);
        configureSearchMetadataFromDiscovery(data, profileForMetadata);
      } catch {
        // Keep strict startup behavior when discovery is unavailable.
      }

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

    const defaultTextModel = getGlobalDefaultTextModel();
    const defaultImageModel = getGlobalDefaultImageModel();

    textareas = textareas.map((t, idx) => {
      if (idx !== index) return t;
      return {
        ...t,
        enabled: true,
        textModel: String(t?.textModel || t?.model || '').trim() || defaultTextModel,
        imageModel: String(t?.imageModel || t?.model || '').trim() || defaultImageModel,
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

    const restoreSimilarityDisabledSteps = (steps) => {
      return steps.map((t) => {
        if (t?._disabledBySimilarity) {
          return {
            ...t,
            enabled: t?._wasEnabledBeforeSimilarity === true,
            _disabledBySimilarity: false,
            _wasEnabledBeforeSimilarity: false
          };
        }

        if (t?._wasEnabledBeforeSimilarity) {
          return {
            ...t,
            _disabledBySimilarity: false,
            _wasEnabledBeforeSimilarity: false
          };
        }

        return t;
      });
    };

    const shouldSearchFrom = (steps) => {
      const searchTextareas = getTextareasForSearch(steps);
      return searchTextareas.some((t) => {
        if (!t?.enabled) return false;
        const text = String(t?.value || '').trim();
        const simId = String(t?.similarityImgId || '').trim();
        return text.length > 0 || simId.length > 0;
      });
    };

    const hasText = String(textareas[index]?.value || '').trim().length > 0;

    if (!hasText) {
      const result = _removeTextarea(textareas, index, textareaImages);
      textareas = restoreSimilarityDisabledSteps(result.textareas);
      textareaImages = result.textareaImages;
      if (shouldSearchFrom(textareas)) {
        setTimeout(() => runSearchImmediate(), 0);
      }
      return;
    }

    const nextTextareas = textareas.map((t, idx) => {
      if (idx !== index) return t;
      return {
        ...t,
        similarityImgId: '',
        enabled: true,
        _disabledBySimilarity: false,
        _wasEnabledBeforeSimilarity: false
      };
    });

    textareas = restoreSimilarityDisabledSteps(nextTextareas);

    if (shouldSearchFrom(textareas)) {
      setTimeout(() => runSearchImmediate(), 0);
    }
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

  $: if (lastDiscoveryPayload) {
    configureSearchMetadataFromDiscovery(lastDiscoveryPayload, runtimeProfile);
  }

  function normalizeDiscoveryEntries(discoveryPayload) {
    if (Array.isArray(discoveryPayload)) return discoveryPayload;
    if (!discoveryPayload || typeof discoveryPayload !== 'object') return [];

    if (Array.isArray(discoveryPayload.collections)) return discoveryPayload.collections;
    if (Array.isArray(discoveryPayload.data)) return discoveryPayload.data;
    if (discoveryPayload.data && typeof discoveryPayload.data === 'object') {
      if (Array.isArray(discoveryPayload.data.collections)) return discoveryPayload.data.collections;
      return [discoveryPayload.data];
    }

    return [discoveryPayload];
  }

  function selectDiscoveryEntry(discoveryPayload, collectionName = '') {
    const entries = normalizeDiscoveryEntries(discoveryPayload);
    const normalizedCollection = String(collectionName || '').trim().toLowerCase();

    const selectedByCollection = entries.find((entry) => {
      const name = String(entry?.name || '').trim().toLowerCase();
      return !!name && !!normalizedCollection && name === normalizedCollection;
    });

    const selectedByLsc26 = entries.find((entry) => String(entry?.name || '').trim().toLowerCase() === 'lsc26');
    const selectedByMetadata = entries.find((entry) => Array.isArray(entry?.metadata) && entry.metadata.length > 0);

    return selectedByCollection || selectedByLsc26 || selectedByMetadata || entries[0] || null;
  }

  function configureSearchMetadataFromDiscovery(data, profile = runtimeProfile) {
    const selectedDiscovery = selectDiscoveryEntry(data, activeCollectionName);
    const available = Array.isArray(selectedDiscovery?.metadata)
      ? selectedDiscovery.metadata.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const availableSet = new Set(available);
    const hasAvailabilityList = availableSet.size > 0;

    const canRequestField = (field) => {
      const normalized = String(field || '').trim();
      if (!normalized) return false;
      return !hasAvailabilityList || availableSet.has(normalized);
    };

    const groupingField = String(selectedDiscovery?.groupby_attribute || 'hour_id').trim() || 'hour_id';
    const requested = [groupingField];

    const configuredGroupByMetadata = Array.isArray(profile?.groupBy?.modes)
      ? profile.groupBy.modes
          .map((entry) => String(entry?.metadata || entry?.field || '').trim())
          .filter(Boolean)
      : [];

    for (const field of configuredGroupByMetadata) {
      if (canRequestField(field)) requested.push(field);
    }

    const configuredTitleFormattingFields = [
      String(profile?.titleFormatting?.imageTitle?.epochField || '').trim(),
      String(profile?.titleFormatting?.imageTitle?.utcOffsetField || '').trim(),
      String(profile?.titleFormatting?.videoGroup?.utcOffsetField || '').trim()
    ].filter(Boolean);

    const optionalFields = [
      'epoch',
      'utc_offset_hours',
      'video_offset_seconds',
      'hour_msb_middletime',
      ...configuredTitleFormattingFields
    ];
    for (const field of optionalFields) {
      if (canRequestField(field)) requested.push(field);
    }

    visioneAPI.defaultMetadataToRetrieve = Array.from(new Set(requested));
  }

  function extractMetadataFieldsFromDiscovery(discoveryPayload, collectionName = '') {
    const selected = selectDiscoveryEntry(discoveryPayload, collectionName);

    return Array.isArray(selected?.metadata)
      ? selected.metadata.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
  }

  function extractDiscoveryCollectionName(discoveryPayload, fallback = '') {
    const selected = selectDiscoveryEntry(discoveryPayload, fallback);
    return String(selected?.name || '').trim().toLowerCase();
  }

  function extractAvailableModelsFromDiscovery(discoveryPayload) {
    const entries = normalizeDiscoveryEntries(discoveryPayload);
    const out = new Map();

    function normalizeModalities(value) {
      const list = Array.isArray(value) ? value : [value];
      return Array.from(new Set(
        list
          .map((m) => String(m || '').trim().toLowerCase())
          .filter(Boolean)
          .map((m) => {
            if (m === 'text' || m === 'image' || m === 'image+text') return m;
            if (m === 'multimodal' || m === 'multi-modal' || m === 'both') return 'image+text';
            return m;
          })
      ));
    }

    function addModel(name, modalities = ['text', 'image']) {
      const modelName = String(name || '').trim();
      if (!modelName) return;

      const normalizedModalities = normalizeModalities(modalities);
      const safeModalities = normalizedModalities.length > 0 ? normalizedModalities : ['text', 'image'];

      if (out.has(modelName)) {
        const merged = Array.from(new Set([...(out.get(modelName).modalities || []), ...safeModalities]));
        out.set(modelName, { name: modelName, modalities: merged });
        return;
      }

      out.set(modelName, { name: modelName, modalities: safeModalities });
    }

    function addFromArray(models, fallbackModality) {
      if (!Array.isArray(models)) return;
      models.forEach((entry) => {
        if (typeof entry === 'string') {
          addModel(entry, fallbackModality ? [fallbackModality] : ['text', 'image']);
          return;
        }

        if (entry && typeof entry === 'object') {
          const name = String(entry.name || entry.model || entry.id || '').trim();
          const modalities = entry.modalities || entry.modality || entry.type || (fallbackModality ? [fallbackModality] : ['text', 'image']);
          addModel(name, modalities);
        }
      });
    }

    entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      addFromArray(entry.available_models, null);
      addFromArray(entry.models, null);
      addFromArray(entry.text_models, 'text');
      addFromArray(entry.image_models, 'image');
      addFromArray(entry.multimodal_models, 'image+text');

      if (entry.discovery && typeof entry.discovery === 'object') {
        addFromArray(entry.discovery.available_models, null);
        addFromArray(entry.discovery.models, null);
      }

      if (entry.data && typeof entry.data === 'object') {
        addFromArray(entry.data.available_models, null);
        addFromArray(entry.data.models, null);
      }
    });

    return Array.from(out.values());
  }

  function applySettings(e) {
    uiStore.actions.applySettings(e.detail);
    const detail = e?.detail || {};
    vbsLogger.logInteractionEvent({
      category: 'OTHER',
      type: 'settingsUpdate',
      value: `challenge:${String(detail.dresChallengeType || get(uiStore).dresChallengeType || 'KIS')} dresEnabled:${detail.dresEnabled ? 'true' : 'false'} autoTranslate:${detail.autoTranslateQueries ? 'true' : 'false'}`
    }).then(refreshLogCount).catch(() => {});
  }

  function adjustImageModalScale(delta = 0) {
    const step = Number(delta) || 0;
    if (!step) return;
    const current = Number(get(uiStore).imageModalScale) || 160;
    uiStore.actions.applySettings({ imageModalScale: Math.max(80, Math.round(current + step)) });
  }

  function adjustSlideshowModalScale(delta = 0) {
    const step = Number(delta) || 0;
    if (!step) return;
    const current = Number(get(uiStore).slideshowModalScale) || 160;
    uiStore.actions.applySettings({ slideshowModalScale: Math.max(80, Math.round(current + step)) });
  }

  function handleChangeChallengeType(e) {
    const nextType = String(e?.detail?.type || 'KIS');
    uiStore.actions.setDresChallengeType(nextType);
    refreshDresEvaluationOptions().catch(() => {});
    vbsLogger.initSession(getLoggerContext()).then(async () => {
      await vbsLogger.logInteractionEvent({
        category: 'OTHER',
        type: 'challengeType',
        value: nextType
      });
      await refreshLogCount();
    }).catch(() => {});
  }

  function handleSetEvaluationId(e) {
    const challengeType = String(e?.detail?.challengeType || get(uiStore).dresChallengeType || 'KIS');
    const evaluationId = String(e?.detail?.evaluationId || '').trim();
    if (!evaluationId) return;

    uiStore.actions.setDresEvaluationId(challengeType, evaluationId);
  }

  function handleToggleAutoTranslate() {
    const current = !!get(uiStore).autoTranslateQueries;
    const next = !current;
    uiStore.actions.setAutoTranslateQueries(next);

    toasts.info(next ? 'Auto-translate enabled.' : 'Auto-translate disabled.');

    vbsLogger.logInteractionEvent({
      category: 'OTHER',
      type: 'autoTranslateToggle',
      value: next ? 'enabled' : 'disabled'
    }).then(refreshLogCount).catch(() => {});
  }

  async function handleExportLogs() {
    if (!get(uiStore).dresEnabled) {
      toasts.info('Enable DRES submit in Settings to export logs.');
      return;
    }

    isExportingLogs = true;
    try {
      const result = await vbsLogger.exportForCurrentUser();
      await refreshLogCount();
      if (!result?.exported) {
        if (result?.mode === 'cancelled') {
          toasts.info('Log export cancelled.');
          return;
        }
        toasts.info('No local logs available to export.');
        return;
      }
      if (result.mode === 'directory') {
        toasts.success(`Exported ${result.exported} log files in folder ${result.userFolder}`);
      } else {
        toasts.warning(`Directory export unavailable. Downloaded fallback file with ${result.exported} logs.`);
      }
    } catch (error) {
      toasts.error(`Log export failed: ${error?.message || String(error)}`);
    } finally {
      isExportingLogs = false;
    }
  }

  async function handleDeleteLogs() {
    if (!get(uiStore).dresEnabled) {
      toasts.info('Enable DRES submit in Settings to manage logs.');
      return;
    }

    if (logCount <= 0) {
      toasts.info('No local logs to delete.');
      return;
    }

    const userFolder = String(vbsLogger.getUserFolder() || 'unknown-user');
    const firstConfirm = window.confirm(
      `Delete ${logCount} local logs for user folder "${userFolder}"? This cannot be undone.`
    );
    if (!firstConfirm) return;

    const safetyCode = `DELETE-${logCount}`;
    const typed = window.prompt(
      `Safe mode: type ${safetyCode} to confirm permanent deletion.`
    );
    if (typed !== safetyCode) {
      toasts.warning('Deletion cancelled: safety code mismatch.');
      return;
    }

    isDeletingLogs = true;
    try {
      const result = await vbsLogger.deleteForCurrentUser();
      await refreshLogCount();
      toasts.success(`Deleted ${result?.deleted || 0} local logs.`);
    } catch (error) {
      toasts.error(`Log deletion failed: ${error?.message || String(error)}`);
    } finally {
      isDeletingLogs = false;
    }
  }

  function handleChangeLogResultsLimit() {
    if (!get(uiStore).dresEnabled) {
      toasts.info('Enable DRES submit in Settings to configure logs.');
      return;
    }

    if (logResultsLimit === 100) {
      logResultsLimit = 1000;
    } else if (logResultsLimit === 1000) {
      logResultsLimit = 10000;
    } else {
      logResultsLimit = 100;
    }
    toasts.info(`VBS logging depth set to top ${logResultsLimit} results.`);
  }

  // ---------------------------
  // Video player helpers
  // ---------------------------
  function normalizeVideoId(value) {
    return String(value || '');
  }

  function extractVideoIdFromImageId(imgId) {
    const raw = String(imgId || '').trim();
    if (!raw) return '';
    const hourMatch = raw.match(/^(\d{8}_\d{2})\d{4}_\d{3}(?:\.[^./]+)?$/i);
    if (hourMatch) return hourMatch[1];
    return raw.split('-')[0] || '';
  }

  function useSlideshowModal() {
    const hasCollectionVideos = runtimeProfile?.media?.hasVideos !== false;
    if (!hasCollectionVideos) return true;

    const overrideMode = String($uiStore.videoPlayerModalMode || 'profile').trim().toLowerCase();
    if (overrideMode === 'slideshow') return true;
    if (overrideMode === 'video') return false;

    const mode = String(runtimeProfile?.videoPlayer?.modal || 'video').trim().toLowerCase();
    return mode === 'slideshow';
  }

  async function openVideoPlayerBy(imgId, videoId, startAt) {
    const normalizedVideoId = normalizeVideoId(videoId || extractVideoIdFromImageId(imgId));
    const normalizedImgId = String(imgId || '');

    // Ensure the dedicated player modal is never layered behind the summary modal.
    if (isVideoSummaryModalOpen) {
      isVideoSummaryModalOpen = false;
      await tick();
    }

    if (useSlideshowModal()) {
      slideshowPlayer = {
        videoId: normalizedVideoId,
        selectedImgId: normalizedImgId,
        title: normalizedVideoId,
        highlightedKeyframes: videoPlayerCtrl.getHighlightedKeyframesForVideo(normalizedVideoId)
      };
      isSlideshowOpen = true;
      logVideoPlayer('openSlideshow', `imgId:${normalizedImgId} video:${normalizedVideoId}`);
      return;
    }

    videoPlayer = await videoPlayerCtrl.buildPlayerData(imgId, videoId, startAt);
    isVideoPlayerOpen = true;
    logVideoPlayer('open', `imgId:${String(imgId || '')} start:${Number(startAt || 0)}`);
  }

  function handleSubmitFrameFromPlayer(e) {
    const { imgId, videoId, dataUrl, currentTime } = e.detail || {};
    logVideoPlayer('submitFrame', `imgId:${String(imgId || '')} t:${Number(currentTime || 0).toFixed(3)}`);
    submitByImgId(imgId, {
      imgId,
      videoId,
      url: dataUrl || "",
      title: imgId,
      raw: { source: "video-modal", currentTime }
    }, 'video-player');
  }

  // ---------------------------
  // Modal navigation
  // ---------------------------
  function openModal(index) {
    const item = images[index];
    if (item) {
      searchModal.open(item);
      lastViewedSearchIndex = index;
      logRankedList('openResult', `index:${index} imgId:${String(item?.imgId || '')}`);
      tick().then(() => ui.scrollToImage(imagesContainer, index));
    }
  }

  const closeModal = () => {
    logRankedList('closeResult');
    searchModal.close({ keepSelection: true });
  };

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
      logRankedList('navigate', `from:${currentIndex} to:${targetIndex} mode:${toFirstOfRow ? 'row' : 'linear'}`);
      tick().then(() => ui.scrollToImage(imagesContainer, targetIndex));
    }
  }

  function openSimilarityModalByImg(img) {
    similarityModal.open(img);
    lastViewedSimilarityIndex = img.index ?? 0;
    logRankedList('openSimilarityResult', `index:${lastViewedSimilarityIndex} imgId:${String(img?.imgId || '')}`);
  }

  function closeSimilarityModal() {
    logRankedList('closeSimilarityResult');
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
      logRankedList('navigateSimilarity', `from:${currentIndex} to:${targetIndex} mode:${toFirstOfRow ? 'row' : 'linear'}`);
      tick().then(() => ui.scrollToImage(similarityContainer, targetIndex));
    }
  }

  function openFrameModal(frame) {
    if (!frame) return;
    videoModal.open(frame);
    view2SelectedImgId = frame.imgId;
    lastViewedVideoIndex = frame.index ?? 0;
    logRankedList('openFrame', `index:${lastViewedVideoIndex} imgId:${String(frame?.imgId || '')}`);
    tick().then(() => ui.scrollToImage(view2Container, frame.imgId));
  }

  function closeFrameModal() {
    logRankedList('closeFrame');
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
      logRankedList('navigateFrame', `from:${currentIndex} to:${targetIndex} mode:${toFirstOfRow ? 'row' : 'linear'}`);
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
  // Selection navigation (keyboard)
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
  async function runSearch(payloadOrEvent = null) {
    const payload = payloadOrEvent && typeof payloadOrEvent === 'object' && 'detail' in payloadOrEvent
      ? payloadOrEvent.detail
      : payloadOrEvent;
    const textareasOverride = Array.isArray(payload?.textareas) ? payload.textareas : null;
    return searchController.runSearch({ textareasOverride });
  }

  async function runSearchImmediate(payloadOrEvent = null) {
    const payload = payloadOrEvent && typeof payloadOrEvent === 'object' && 'detail' in payloadOrEvent
      ? payloadOrEvent.detail
      : payloadOrEvent;
    const textareasOverride = Array.isArray(payload?.textareas) ? payload.textareas : null;
    return searchController.runSearchImmediate({ textareasOverride });
  }


  async function handleRestoreFromURL() {
    const urlState = deserializeFromURL();

    if (urlState.textareas && urlState.textareas.length > 0) {
      textareas = urlState.textareas.map((t) => normalizeTextareaModels(t));
      await hydrateInlineTextareaImagesFromState(urlState);
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
    const normalizedVideoId = String(videoId || '');
    const normalizedHighlight = String(highlightImgId || '') || null;
    activeVideoSummaryContext = {
      videoId: normalizedVideoId,
      highlightImgId: normalizedHighlight,
      label: resolveSummaryLabel(normalizedVideoId, normalizedHighlight)
    };

    if (!highlightImgId) lastViewedVideoIndex = 0;

    await videoController.openVideoSummary(normalizedVideoId, normalizedHighlight);
    vbsLogger.logInteractionEvent({
      category: 'BROWSING',
      type: 'videoSummary',
      value: `${normalizedVideoId}${normalizedHighlight ? `;${normalizedHighlight}` : ''}`
    }).then(refreshLogCount).catch(() => {});
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
    vbsLogger.logInteractionEvent({
      category: 'BROWSING',
      type: 'exploration',
      value: `similarity:${String(baseImgId || '')}`
    }).then(refreshLogCount).catch(() => {});
  }

  function addSimilarityAsSearchStep(baseImgId, frame = null) {
    const imgId = String(baseImgId || "").trim();
    if (!imgId) return;

    const defaultTextModel = getGlobalDefaultTextModel();
    const defaultImageModel = getGlobalDefaultImageModel();

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
            textModel: String(t?.textModel || t?.model || '').trim() || defaultTextModel,
            imageModel: defaultImageModel,
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
        textModel: defaultTextModel,
        imageModel: defaultImageModel,
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

  // ---------------------------
  // Textareas ops (delegated to textareaController)
  // ---------------------------
  function addTextarea(index) {
    textareas = _addTextarea(textareas, index).map((t) => normalizeTextareaModels(t));
    toasts.info("New query step added");
  }

  function removeTextarea(index) {
    const previousTextareas = textareas;
    const result = _removeTextarea(textareas, index, textareaImages);
    textareas = result.textareas;
    textareaImages = result.textareaImages;
    if (result.shouldSearch) {
      toasts.info("Query step removed, updating results...");
      setTimeout(() => runSearchImmediate(), 0);
    } else if (result.textareas !== previousTextareas) {
      toasts.info("Query step removed");
    }
  }

  function toggleTextarea(index) {
    const wasDisabledBySimilarity = !!textareas[index]?._disabledBySimilarity;
    const next = _toggleTextarea(textareas, index);
    const status = next[index].enabled ? "enabled" : "disabled";

    // If user manually re-enables a step that was disabled by similarity,
    // clear similarity-only disable markers.
    if (next[index].enabled && wasDisabledBySimilarity) {
      next[index] = {
        ...next[index],
        _disabledBySimilarity: false,
        _wasEnabledBeforeSimilarity: false
      };
    }

    textareas = next;
    toasts.info(`Query step ${index + 1} ${status}`);

    const searchTextareas = getTextareasForSearch(next);
    const shouldSearch = searchTextareas.some((t) => {
      if (!t?.enabled) return false;
      const text = String(t?.value || '').trim();
      const simId = String(t?.similarityImgId || '').trim();
      return text.length > 0 || simId.length > 0;
    });

    if (shouldSearch) {
      setTimeout(() => runSearchImmediate(), 0);
    }
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
  async function resetApp() {
    const ok = window.confirm(
      "Reset current search session? This will clear queries, results, RF and submitted items, but keep your app settings."
    );
    if (!ok) return;

    try {
      await stopQaAgent();
    } catch {
      // Ignore agent stop errors during full reset.
    }

    qaAgentStream = { isStreaming: false, events: [], finalAnswer: '', error: '' };
    qaAgentSubmitCandidate = '';

    uiStore.actions.setLayoutTab('View1');

    textareas = [{ value: "", enabled: true, textModel: getGlobalDefaultTextModel(), imageModel: getGlobalDefaultImageModel() }];
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
    isSlideshowOpen = false;
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
    sessionResetKey += 1;
    toasts.success("🔄 Search session cleared (settings preserved)");
  }

  // ---------------------------
  // Rows derivation (UI store driven)
  // ---------------------------
  $: displayRows = buildRows(images, {
    viewMode: $uiStore.viewMode,
    resultsPerRow: $uiStore.resultsPerRow,
    resultsAutoFit: $uiStore.resultsAutoFit,
    runtimeProfile
  });


  $: similarityDisplayRows = buildRows(similarityImages, {
    viewMode: $uiStore.viewMode,
    resultsPerRow: $uiStore.resultsPerRow,
    resultsAutoFit: $uiStore.resultsAutoFit,
    runtimeProfile
  });


  // Se vuoi auto-run di query esempio
  function loadExampleQuery(queries) {
    textareas = _loadExampleQuery(queries).map((t) => normalizeTextareaModels(t));
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
  isVideoPlayerOpen={isVideoPlayerOpen || isSlideshowOpen}
  onFocusSearch={focusSearchBox}
  onSwitchTab={(tab) => {
    if (tab !== 'View1') return;
    uiStore.actions.setLayoutTab(tab);
  }}
  onSubmitSelected={() => {
    const item = getSelectedItemForShortcuts();
    if (item?.imgId) submitByImgId(item.imgId, item, 'keyboard-shortcut');
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
    if (isSlideshowOpen) isSlideshowOpen = false;
    else if (isVideoSummaryModalOpen) isVideoSummaryModalOpen = false;
    else if ($videoModal.isOpen) closeFrameModal();
    else if ($similarityModal.isOpen) closeSimilarityModal();
    else closeModal();
  }}
/>

<InputModal
  isOpen={isQaAnswerModalOpen}
  title="Submit Q&A answer"
  icon="default"
  submitLabel="Submit answer"
  cancelLabel="Cancel"
  description={qaAnswerContext.imgId
    ? `Frame ${qaAnswerContext.imgId}${qaAnswerContext.source ? ` · from ${qaAnswerContext.source}` : ''}`
    : 'Type the textual answer to submit to DRES'}
  fields={[
    {
      name: 'answer',
      label: 'Answer',
      type: 'textarea',
      placeholder: 'Type your Q&A answer...',
      value: '',
      rows: 4,
      required: true,
      hint: 'Submitted as DRES text answer for Q&A challenge.'
    }
  ]}
  on:close={() => (isQaAnswerModalOpen = false)}
  on:submit={handleQaAnswerSubmit}
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
  on:playerAction={(e) => {
    const d = e?.detail || {};
    const action = String(d.action || 'unknown');
    const t = Number(d.currentTime || 0);
    const extra = [
      d.targetTime != null ? `target:${Number(d.targetTime).toFixed(3)}` : '',
      d.playbackRate != null ? `speed:${Number(d.playbackRate)}` : ''
    ].filter(Boolean).join(' ');
    logVideoPlayer(action, `t:${t.toFixed(3)} ${extra}`.trim());
  }}
  on:submitFrame={handleSubmitFrameFromPlayer}
  on:captureForSimilarity={(e) => {
    const t = Number(e?.detail?.currentTime || 0);
    logVideoPlayer('captureForSimilarity', `t:${t.toFixed(3)}`);
    isVideoPlayerOpen = false;
    addSimilarityAsSearchStep(e.detail.imgId);
  }}
  on:close={() => {
    logVideoPlayer('close');
    isVideoPlayerOpen = false;
  }}
/>

<SlideshowModal
  isOpen={isSlideshowOpen}
  videoId={slideshowPlayer.videoId}
  selectedImgId={slideshowPlayer.selectedImgId}
  title={slideshowPlayer.title}
  modalScale={$uiStore.slideshowModalScale}
  highlightedKeyframes={slideshowPlayer.highlightedKeyframes}
  showSubmitUI={$uiStore.dresEnabled}
  challengeType={$uiStore.dresChallengeType}
  on:playerAction={(e) => {
    const d = e?.detail || {};
    const action = String(d.action || 'unknown');
    const idx = Number(d.currentIndex ?? -1);
    const ts = Number(d.timestamp ?? 0);
    const img = String(d.imgId || '');
    logVideoPlayer(`slideshow:${action}`, `idx:${idx} ts:${ts.toFixed(3)} imgId:${img}`);
  }}
  on:submitFrame={(e) => {
    const { imgId, videoId, dataUrl, currentTime } = e.detail || {};
    logVideoPlayer('slideshow:submitFrame', `imgId:${String(imgId || '')} t:${Number(currentTime || 0).toFixed(3)}`);
    submitByImgId(imgId, {
      imgId,
      videoId,
      url: dataUrl || "",
      title: imgId,
      raw: { source: "slideshow-modal", currentTime }
    }, 'slideshow');
  }}
  on:captureForSimilarity={(e) => {
    const t = Number(e?.detail?.currentTime || 0);
    logVideoPlayer('slideshow:captureForSimilarity', `t:${t.toFixed(3)}`);
    isSlideshowOpen = false;
    addSimilarityAsSearchStep(e.detail.imgId);
  }}
  on:adjustScale={(e) => adjustSlideshowModalScale(e?.detail?.delta)}
  on:close={() => {
    logVideoPlayer('closeSlideshow');
    isSlideshowOpen = false;
  }}
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
  {rfPositive}
  {rfNegative}
  {runtimeProfile}
  showLocalTimeInTitles={$uiStore.showLocalTimeInTitles}
  resultsetBadgeLabelMode={$uiStore.resultsetBadgeLabelMode}
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
  cacheEnabled={$uiStore.cacheEnabled}
  dedupeResults={$uiStore.dedupeResults}
  dataserverHost={$uiStore.dataserverHost}
  justifyResultRows={$uiStore.justifyResultRows}
  tupleIndicatorMode={$uiStore.tupleIndicatorMode}
  videoBadgeOrientation={$uiStore.videoBadgeOrientation}
  resultsetBadgeLabelMode={$uiStore.resultsetBadgeLabelMode}
  showLocalTimeInTitles={$uiStore.showLocalTimeInTitles}
  virtualizationEnabled={$uiStore.virtualizationEnabled}
  virtualizationThreshold={$uiStore.virtualizationThreshold}
  dresEnabled={$uiStore.dresEnabled}
  dresChallengeType={$uiStore.dresChallengeType}
  dresSubmitServer={$uiStore.dresSubmitServer}
  dresUsername={$uiStore.dresUsername}
  dresPassword={$uiStore.dresPassword}
  dresMemberId={$uiStore.dresMemberId}
  autoTranslateQueries={$uiStore.autoTranslateQueries}
  showAutoTranslateToggle={$uiStore.showAutoTranslateToggle}
  temporalWindowSeconds={$uiStore.temporalWindowSeconds}
  videoPlayerModalMode={$uiStore.videoPlayerModalMode}
  imageModalScale={$uiStore.imageModalScale}
  slideshowModalScale={$uiStore.slideshowModalScale}
  modelSelectionPerStepEnabled={$uiStore.modelSelectionPerStepEnabled}
  defaultTextModel={$uiStore.defaultTextModel}
  defaultImageModel={$uiStore.defaultImageModel}
  {availableModels}
  on:close={() => (isSettingsOpen = false)}
  on:save={applySettings}
  on:testDres={handleTestDresConnection}
/>

<AdaptiveTabLayout
  active={$uiStore.layoutTab}
  tabs={[]}
  isSidebarOpen={$uiStore.isSidebarOpen}
  isSidebarRightOpen={$uiStore.isSidebarRightOpen}
  viewMode={$uiStore.viewMode}
  keyframeSize={$uiStore.keyframeSize}
  showViewModeRadios={$uiStore.layoutTab === "View1" || $uiStore.layoutTab === "Similarity"}
  {runtimeProfile}
  dresEnabled={$uiStore.dresEnabled}
  challengeType={$uiStore.dresChallengeType}
  evaluationOptions={dresEvaluationOptions}
  selectedEvaluationId={$uiStore.dresEvaluationIdByChallenge?.[$uiStore.dresChallengeType] || ''}
  loadingEvaluationOptions={isLoadingDresEvaluationOptions}
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
  on:changeChallengeType={handleChangeChallengeType}
  on:requestEvaluationOptions={refreshDresEvaluationOptions}
  on:setEvaluationId={handleSetEvaluationId}
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
        {translatedQueryHints}
        {availableModels}
        modelSelectionPerStepEnabled={$uiStore.modelSelectionPerStepEnabled}
        showAutoTranslateToggle={$uiStore.showAutoTranslateToggle}
        autoTranslateEnabled={$uiStore.autoTranslateQueries}
        onToggleAutoTranslate={handleToggleAutoTranslate}
        {textareaImages}
        {searchLoading}
        {searchError}
        {searchResultSet}
        {rfPositive}
        {rfNegative}
        {rfEnabled}
        {rfMethod}
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
        tupleIndicatorMode={$uiStore.tupleIndicatorMode}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}
        imageModalScale={$uiStore.imageModalScale}
        {runtimeProfile}
        {discoveryMetadataFields}
        showLocalTimeInTitles={$uiStore.showLocalTimeInTitles}
        resultsetBadgeLabelMode={$uiStore.resultsetBadgeLabelMode}
        submitTextAnswer={submitTextAnswer}
        askQaAgent={askQaAgent}
        stopQaAgent={stopQaAgent}
        {qaAgentStream}
        {qaAgentSubmitCandidate}
        {sessionResetKey}
        qaStreamPanelHeight={$uiStore.qaStreamPanelHeight}
        onUpdateQaAgentPanelPrefs={(patch) => {
          uiStore.actions.applySettings(patch || {});
        }}

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
          if (!$uiStore.modelSelectionPerStepEnabled) return;
          const { index: i, model: m, kind } = e.detail;
          const targetField = kind === 'image' ? 'imageModel' : 'textModel';
          textareas = textareas.map((t, idx) => (idx === i ? { ...t, [targetField]: m } : t));
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
        on:updateRFEnabled={(e) => {
          rfEnabled = !!e?.detail?.enabled;
          setTimeout(() => runSearchImmediate(), 0);
        }}
        on:updateRFMethod={(e) => {
          const next = String(e?.detail?.method || '').trim().toLowerCase();
          rfMethod = next === 'rocchio' ? 'rocchio' : 'svm';
          setTimeout(() => runSearchImmediate(), 0);
        }}

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
        onAdjustImageModalScale={adjustImageModalScale}

        on:swapTextarea={(e) => swapTextareas(e.detail.indexA, e.detail.indexB, e.detail.mode || 'swap')}
        onLoadExample={(queries) => loadExampleQuery(queries)}
        on:updateImages={handleUpdateImages}
        on:replaceSimilarityImage={handleReplaceSimilarityImage}
        on:closeSimilarityStep={handleCloseSimilarityStep}
        on:clearQueryInputs={() => {
          textareas = [{ value: "", enabled: true, textModel: getGlobalDefaultTextModel(), imageModel: getGlobalDefaultImageModel() }];
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
        tupleIndicatorMode={$uiStore.tupleIndicatorMode}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}
        imageModalScale={$uiStore.imageModalScale}
        {runtimeProfile}
        showLocalTimeInTitles={$uiStore.showLocalTimeInTitles}
        resultsetBadgeLabelMode={$uiStore.resultsetBadgeLabelMode}

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
        onAdjustImageModalScale={adjustImageModalScale}
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
        tupleIndicatorMode={$uiStore.tupleIndicatorMode}
        videoBadgeOrientation={$uiStore.videoBadgeOrientation}
        showSubmitUI={$uiStore.dresEnabled}
        challengeType={$uiStore.dresChallengeType}
        imageModalScale={$uiStore.imageModalScale}
        {runtimeProfile}
        showLocalTimeInTitles={$uiStore.showLocalTimeInTitles}
        resultsetBadgeLabelMode={$uiStore.resultsetBadgeLabelMode}

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
        onAdjustImageModalScale={adjustImageModalScale}
      />
    {/if}
  </div>

  <ToastContainer />

  <StatusBar
    totalImages={totalImages}
    submittedCount={submittedImages.length}
    rfPositiveCount={rfPositive.length}
    rfNegativeCount={rfNegative.length}
    challengeType={$uiStore.dresChallengeType}
    viewMode={$uiStore.viewMode}
    searchTime={searchTime}
    isLoading={searchLoading || similarityLoading || view2Loading}
    showSubmitted={$uiStore.dresEnabled}
    dresEnabled={$uiStore.dresEnabled}
    dresUsername={$uiStore.dresUsername}
    dresEvaluationLabel={selectedDresEvaluationLabel}
    onViewSubmitted={handleViewSubmitted}
    onViewRF={handleViewRF}
  />
</AdaptiveTabLayout>
