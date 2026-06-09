<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import InputModal from "./InputModal.svelte";
  import { toasts } from "../stores/toastStore.js";

  type QueryTextarea = {
    value: string;
    enabled: boolean;
    model?: string;
    textModel?: string;
    imageModel?: string;
    similarityImgId?: string;
    _disabledBySimilarity?: boolean;
    _wasEnabledBeforeSimilarity?: boolean;
  };

  type AvailableImage = {
    url: string;
    imgId?: string;
    title?: string;
  };

  type AttachedImage = {
    url: string;
    name: string;
    type: "result" | "file" | "url";
    imgId?: string | null;
  };

  type MetadataChip = {
    token: string;
    field: string;
    label: string;
    value: string;
  };

  type ModalOption = { value: string; label: string };
  type ModalField = {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    value?: string | boolean | Record<string, unknown>;
    hint?: string;
    required?: boolean;
    rows?: number;
    min?: number;
    max?: number;
    step?: number;
    options?: ModalOption[];
    computePreview?: (values: ModalSubmitData) => string;
    visibleWhen?: (values: ModalSubmitData) => boolean;
    pinTarget?: string;
    pinHint?: string;
    advanced?: boolean;
  };

  type ModalConfig = {
    isOpen: boolean;
    title: string;
    icon: string;
    fields: ModalField[];
    description: string;
    targetIndex: number | null;
    filterType: "imageUrl" | "metadata" | "metadataDateRange" | "metadataDateHour" | "metadataCountry" | "metadataLocation" | "metadataHeartRate" | "metadataMusic" | "";
  };

  type ModalSubmitData = {
    url?: string;
    name?: string;
    comparator?: string;
    value?: string;
    minBpm?: string;
    maxBpm?: string;
    dateFrom?: string;
    dateTo?: string;
    dateFromParts?: { day?: string; month?: string; year?: string; hour?: string };
    dateToParts?: { day?: string; month?: string; year?: string; hour?: string };
    dateFixed?: {
      year?: Array<{ comparator?: string; value?: string }> | { enabled?: boolean; comparator?: string; value?: string };
      month?: Array<{ comparator?: string; value?: string }> | { enabled?: boolean; comparator?: string; value?: string };
      day?: Array<{ comparator?: string; value?: string }> | { enabled?: boolean; comparator?: string; value?: string };
      hour?: Array<{ comparator?: string; value?: string }> | { enabled?: boolean; comparator?: string; value?: string };
    };
    year?: string;
    month?: string;
    day?: string;
    hour?: string;
    granularity?: string;
    useTimezone?: boolean;
  };

  type DispatchEvents = {
    add: { index: number };
    remove: { index: number };
    toggle: { index: number };
    update: { index: number; value: string };
    updateModel: { index: number; model: string; kind: 'text' | 'image' };
    search: { textareas: QueryTextarea[] };
    swap: { indexA: number; indexB: number; mode?: "swap" | "move" };
    swapTextarea: { indexA: number; indexB: number; mode?: "swap" | "move" };
    startImageSelection: { textareaIndex: number };
    imageSelected: void;
    updateImages: { index: number; images: AttachedImage[] };
    replaceSimilarityImage: { index: number; imgId: string | null; url: string; name: string };
    closeSimilarityStep: { index: number };
  };

  type AvailableModelInput =
    | string
    | {
        name?: string;
        modalities?: string[];
      };

  type ModelDescriptor = {
    name: string;
    modalities: string[];
  };

  export let textareas: QueryTextarea[] = [];
  export let translatedQueryHints: Record<number, { from: string; to: string }> = {};
  export let availableModels: AvailableModelInput[] = [];
  export let modelSelectionPerStepEnabled = true;
  export let runtimeProfile: Record<string, unknown> = {};
  export let discoveryMetadataFields: string[] = [];
  export let availableImages: AvailableImage[] = [];
  export let textareaImages: Record<number, AttachedImage[]> = {};

  let modalConfig: ModalConfig = {
    isOpen: false,
    title: '',
    icon: '',
    fields: [],
    description: '',
    targetIndex: null,
    filterType: ''
  };

  const dispatch = createEventDispatcher<DispatchEvents>();

  let isSelectingImageFor: number | null = null;
  let textareaRefs: Array<HTMLTextAreaElement | null> = [];
  let similarityTextConstraintOpen: Record<number, boolean> = {};
  let previousSimilarityImgIdByIndex: Record<number, string> = {};
  let enabledStepCount = 0;
  let showSequenceChrome = false;

  const DEFAULT_TEXT_MODEL = 'openclip_clip_vit_b_32';
  const DEFAULT_IMAGE_MODEL = 'dinov2_base';
  const MIN_TEXTAREA_ROWS = 1;
  const MAX_TEXTAREA_ROWS = 5;
  const TIMELINE_STOPS = ["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"];
  let normalizedModelEntries: ModelDescriptor[] = [];
  let textModelOptions: string[] = [];
  let imageModelOptions: string[] = [];
  let multiModalModelOptions: string[] = [];
  let metadataFilterFields: string[] = [];
  let displayMetadataFilterFields: string[] = [];
  let discoveryMetadataSet: Set<string> = new Set();
  let runtimeMetadataSet: Set<string> = new Set();
  let metadataTokensByIndex: Record<number, string[]> = {};
  let hasDateFilterSupport = false;
  let hasCountryFilterSupport = false;
  let hasLocationFilterSupport = false;
  let hasMusicFilterSupport = false;
  let hasAnyCustomMetadataFilter = false;
  let modalMetadataField = '';
  let modalMetadataShortcut = '';
  let modalAnchorRect: { left: number; right: number; top: number; bottom: number; width: number; height: number } | null = null;

  const SPECIAL_METADATA_FIELDS = new Set([
    'year',
    'month',
    'day',
    'hour',
    'timezone',
    'location_country',
    'location',
    'music',
    'heart_rate_bpm'
  ]);

  const SHORTCUT_ALIAS_BY_FIELD: Record<string, string> = {
    year: 'y',
    month: 'm',
    day: 'd',
    hour: 'h',
    epoch: 'epoch',
    epoch_from: 'ef',
    epoch_to: 'et',
    timezone: 'tz',
    location_country: 'country',
    location: 'location',
    music: 'music',
    semantic_name: 'semantic',
    heart_rate_bpm: 'hr'
  };

  const NUMERIC_FILTER_FIELDS = new Set(['year', 'month', 'day', 'hour', 'epoch', 'epoch_from', 'epoch_to', 'heart_rate_bpm']);
  const DATE_METADATA_FIELDS = new Set(['date', 'year', 'month', 'day', 'hour', 'epoch', 'epoch_from', 'epoch_to', 'timezone']);
  const DATE_RANGE_FIELDS = new Set(['date', 'epoch', 'epoch_from', 'epoch_to']);
  const DATE_HOUR_METADATA_FIELDS = new Set(['year', 'month', 'day', 'hour']);
  const MULTI_TOKEN_METADATA_FIELDS = new Set([...DATE_METADATA_FIELDS, 'heart_rate_bpm']);

  const METADATA_LABEL_BY_FIELD: Record<string, string> = {
    date: 'Date',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Hour',
    epoch: 'Epoch',
    epoch_from: 'Epoch From',
    epoch_to: 'Epoch To',
    timezone: 'Timezone',
    location_country: 'Country',
    location: 'Location',
    music: 'Music',
    semantic_name: 'Semantic',
    heart_rate_bpm: 'Heart Rate'
  };

  const FIELD_BY_METADATA_KEY: Record<string, string> = (() => {
    const out: Record<string, string> = {
      date: 'date',
      y: 'year',
      year: 'year',
      m: 'month',
      month: 'month',
      d: 'day',
      day: 'day',
      h: 'hour',
      hour: 'hour',
      epoch: 'epoch',
      epoch_from: 'epoch_from',
      ef: 'epoch_from',
      epoch_to: 'epoch_to',
      et: 'epoch_to',
      tz: 'timezone',
      timezone: 'timezone',
      country: 'location_country',
      location_country: 'location_country',
      location: 'location',
      music: 'music',
      semantic: 'semantic_name',
      sem: 'semantic_name',
      semantic_name: 'semantic_name',
      hr: 'heart_rate_bpm',
      heart_rate_bpm: 'heart_rate_bpm'
    };

    Object.entries(SHORTCUT_ALIAS_BY_FIELD).forEach(([field, shortcut]) => {
      const normalizedField = String(field || '').trim().toLowerCase();
      const normalizedShortcut = String(shortcut || '').trim().toLowerCase();
      if (normalizedField) out[normalizedField] = normalizedField;
      if (normalizedField && normalizedShortcut) out[normalizedShortcut] = normalizedField;
    });

    return out;
  })();

  function getTextModelValueForStep(textarea: QueryTextarea) {
    const legacyModel = String(textarea?.model || '').trim();
    const discoveredDefault = textModelOptions[0] || DEFAULT_TEXT_MODEL;
    return String(textarea?.textModel || legacyModel || discoveredDefault).trim() || discoveredDefault;
  }

  function getImageModelValueForStep(textarea: QueryTextarea) {
    const legacyModel = String(textarea?.model || '').trim();
    const discoveredDefault = imageModelOptions[0] || DEFAULT_IMAGE_MODEL;
    return String(textarea?.imageModel || legacyModel || discoveredDefault).trim() || discoveredDefault;
  }

  function normalizeAvailableModelEntry(input: AvailableModelInput): ModelDescriptor | null {
    if (typeof input === 'string') {
      const name = input.trim();
      if (!name) return null;
      // Backward compatibility: legacy string entries were usable for both text/image.
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

  function supportsTextModel(entry: ModelDescriptor) {
    return entry.modalities.includes('text') || entry.modalities.includes('image+text');
  }

  function supportsImageModel(entry: ModelDescriptor) {
    return entry.modalities.includes('image') || entry.modalities.includes('image+text');
  }

  $: normalizedModelEntries = (Array.isArray(availableModels) ? availableModels : [])
    .map((m) => normalizeAvailableModelEntry(m))
    .filter((m): m is ModelDescriptor => !!m);

  $: discoveredTextModels = Array.from(new Set(
    normalizedModelEntries.filter(supportsTextModel).map((m) => m.name).filter(Boolean)
  ));

  $: discoveredImageModels = Array.from(new Set(
    normalizedModelEntries.filter(supportsImageModel).map((m) => m.name).filter(Boolean)
  ));

  $: textModelOptions = discoveredTextModels.length > 0
    ? discoveredTextModels
    : [DEFAULT_TEXT_MODEL];

  $: imageModelOptions = discoveredImageModels.length > 0
    ? discoveredImageModels
    : [DEFAULT_IMAGE_MODEL];

  $: multiModalModelOptions = Array.from(new Set(
    normalizedModelEntries
      .filter((m) => m.modalities.includes('image+text'))
      .map((m) => m.name)
  ));

  $: metadataFilterFields = Array.from(new Set(
    (Array.isArray((runtimeProfile as any)?.queryFilters?.metadataFields)
      ? (runtimeProfile as any).queryFilters.metadataFields
      : [])
      .map((field: unknown) => String(field || '').trim())
      .filter(Boolean)
  ));

  $: discoveryMetadataSet = new Set(
    (Array.isArray(discoveryMetadataFields) ? discoveryMetadataFields : [])
      .map((field) => String(field || '').trim().toLowerCase())
      .filter(Boolean)
  );

  $: runtimeMetadataSet = new Set(
    (Array.isArray(metadataFilterFields) ? metadataFilterFields : [])
      .map((field) => String(field || '').trim().toLowerCase())
      .filter(Boolean)
  );

  function hasMetadataField(field: string) {
    const normalized = String(field || '').trim().toLowerCase();
    if (!normalized) return false;

    if (discoveryMetadataSet.size > 0) {
      return discoveryMetadataSet.has(normalized);
    }

    return runtimeMetadataSet.has(normalized);
  }

  function hasSpecialMetadataField(field: string) {
    const normalized = String(field || '').trim().toLowerCase();
    if (!normalized) return false;
    return discoveryMetadataSet.has(normalized) || runtimeMetadataSet.has(normalized);
  }

  $: hasDateFilterSupport = ['year', 'month', 'day', 'hour'].some((f) => hasSpecialMetadataField(f));
  $: hasCountryFilterSupport = hasSpecialMetadataField('location_country');
  $: hasLocationFilterSupport = hasSpecialMetadataField('location');
  // Keep the dedicated Music filter discoverable even when discovery metadata is delayed/unavailable.
  $: hasMusicFilterSupport = true;
  // Keep the dedicated Heart Rate filter discoverable even when discovery metadata is delayed/unavailable.
  $: hasHeartRateFilterSupport = true;
  // Keep these filters always available in UI even when discovery metadata is delayed/unavailable.
  $: hasAnyCustomMetadataFilter = true;

  $: displayMetadataFilterFields = metadataFilterFields.filter((field) => {
    const normalized = String(field || '').trim().toLowerCase();
    return normalized && !SPECIAL_METADATA_FIELDS.has(normalized) && hasMetadataField(normalized);
  });

  function getShortcutForField(field: string) {
    const normalized = String(field || '').trim().toLowerCase();
    return normalized;
  }

  function getDefaultComparatorForField(field: string) {
    return NUMERIC_FILTER_FIELDS.has(String(field || '').trim().toLowerCase()) ? 'eq' : 'fts';
  }

  function getMetadataFieldHint(field: string) {
    const shortcut = getShortcutForField(field);
    if (NUMERIC_FILTER_FIELDS.has(String(field || '').trim().toLowerCase())) {
      return `${shortcut}:42 or ${shortcut}:>42`;
    }
    return `${shortcut}:dublin or ${shortcut}:~dublin`;
  }

  function toComparatorSymbol(comparator: string, fallback: string) {
    const normalized = String(comparator || '').trim().toLowerCase();
    if (normalized === 'gte') return '>=';
    if (normalized === 'lte') return '<=';
    if (normalized === 'gt') return '>';
    if (normalized === 'lt') return '<';
    if (normalized === 'eq') return '=';
    if (normalized === 'ne') return '!=';
    if (normalized === 'fts') return '~';

    const normalizedFallback = String(fallback || '').trim().toLowerCase();
    if (normalizedFallback === 'gte') return '>=';
    if (normalizedFallback === 'lte') return '<=';
    if (normalizedFallback === 'gt') return '>';
    if (normalizedFallback === 'lt') return '<';
    if (normalizedFallback === 'ne') return '!=';
    if (normalizedFallback === 'fts') return '~';
    return '=';
  }

  function hexToRgb(hex: string) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;

    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  }

  function getStepColor(index: number) {
    const paletteColor = TIMELINE_STOPS[index % TIMELINE_STOPS.length] || TIMELINE_STOPS[0];
    const { r, g, b } = hexToRgb(paletteColor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function withAlpha(color: string, alpha: number) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (!match) return color;
    const [, r, g, b] = match;
    const clamped = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }

  function getStepPhaseLabel(index: number) {
    const enabledIndexes = textareas
      .map((t, idx) => (t?.enabled === true ? idx : -1))
      .filter((idx) => idx >= 0);

    if (enabledIndexes.length <= 1) return '';
    if (!textareas[index]?.enabled) return '';

    const enabledPos = enabledIndexes.indexOf(index);
    if (enabledPos === 0) return 'First';
    if (enabledPos === enabledIndexes.length - 1) return 'Finally';
    return 'Then';
  }

  function getEnabledIndexes() {
    return textareas
      .map((t, idx) => (t?.enabled === true ? idx : -1))
      .filter((idx) => idx >= 0);
  }

  function getEnabledStepNumber(index: number) {
    const enabledIndexes = getEnabledIndexes();
    const enabledPos = enabledIndexes.indexOf(index);
    return enabledPos >= 0 ? enabledPos + 1 : null;
  }

  function isSimilarityStep(index: number) {
    const simId = String(textareas[index]?.similarityImgId || '').trim();
    return !!simId;
  }

  function hasImageQueryForStep(index: number) {
    const step = textareas[index] || {};
    const similarityImgId = String(step?.similarityImgId || '').trim();
    if (similarityImgId) return true;

    const raw = String(step?.value || '').trim().toLowerCase();
    if (raw.startsWith('image:') || raw.startsWith('similarity:')) return true;

    const attached = Array.isArray(textareaImages[index]) ? textareaImages[index] : [];
    return attached.some((img) => img?.type === 'result' && String(img?.imgId || '').trim().length > 0);
  }

  function getPrimarySimilarityImage(index: number) {
    const images = textareaImages[index] || [];
    return images.find((img) => img?.type === 'result') || images[0] || null;
  }

  function getPrimarySimilarityImageIndex(index: number) {
    const images = textareaImages[index] || [];
    const resultIndex = images.findIndex((img) => img?.type === 'result');
    if (resultIndex >= 0) return resultIndex;
    return images.length > 0 ? 0 : -1;
  }

  function shouldShowSimilarityTextConstraint(index: number) {
    if (!isSimilarityStep(index)) return true;
    return true;
  }

  async function enableSimilarityTextConstraint(index: number) {
    if (!textareas[index]?.enabled) {
      dispatch('toggle', { index });
    }

    similarityTextConstraintOpen = {
      ...similarityTextConstraintOpen,
      [index]: true
    };
    closeMenu();
    await tick();
    textareaRefs[index]?.focus();
    autoResizeTextarea(index);
  }

  function getStepContextLabel(index: number) {
    const phase = getStepPhaseLabel(index);
    if (phase) return phase;
    return '';
  }

  function getTranslationHint(index: number) {
    const hint = translatedQueryHints?.[index];
    if (!hint || typeof hint !== 'object') return null;
    const from = String(hint.from || '').trim();
    const to = String(hint.to || '').trim();
    if (!from || !to || from === to) return null;

    const current = String(textareas[index]?.value || '').trim();
    if (!current) return null;
    if (current !== from && current !== to) return null;

    return { from, to };
  }

  function getStepPlaceholder(index: number) {
    if (!textareas[index]?.enabled) return 'Enable this step to edit';

    if (isSimilarityStep(index)) {
      return 'Optional: refine similarity with text...';
    }

    const enabledIndexes = getEnabledIndexes();
    const hasImg = (textareaImages[index] || []).length > 0;

    if (enabledIndexes.length <= 1) {
      return hasImg ? 'Describe what happens in the scene (image attached)' : 'Describe what happens in the scene';
    }

    const enabledPos = enabledIndexes.indexOf(index);
    if (enabledPos <= 0) return 'Describe what happens in the scene';
    return 'Describe a scene appearing after the previous one';
  }

  $: enabledStepCount = textareas.filter((t) => t?.enabled === true).length;
  $: showSequenceChrome = enabledStepCount > 1;

  $: {
    const nextPrev: Record<number, string> = {};
    let nextOpen = similarityTextConstraintOpen;
    let changed = false;

    textareas.forEach((t, idx) => {
      const currentSimId = String(t?.similarityImgId || '').trim();
      const prevSimId = previousSimilarityImgIdByIndex[idx] || '';
      nextPrev[idx] = currentSimId;

      if (currentSimId && prevSimId && currentSimId !== prevSimId && similarityTextConstraintOpen[idx]) {
        if (nextOpen === similarityTextConstraintOpen) nextOpen = { ...similarityTextConstraintOpen };
        nextOpen[idx] = false;
        changed = true;
      }

      if (!currentSimId && similarityTextConstraintOpen[idx]) {
        if (nextOpen === similarityTextConstraintOpen) nextOpen = { ...similarityTextConstraintOpen };
        nextOpen[idx] = false;
        changed = true;
      }
    });

    if (changed) {
      similarityTextConstraintOpen = nextOpen;
    }
    previousSimilarityImgIdByIndex = nextPrev;
  }

  function resizeTextareaNode(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;

    textarea.style.height = "auto";

    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 16;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = parseFloat(computed.borderBottomWidth) || 0;

    const verticalChrome = paddingTop + paddingBottom + borderTop + borderBottom;
    const minHeight = lineHeight * MIN_TEXTAREA_ROWS + verticalChrome;
    const maxHeight = lineHeight * MAX_TEXTAREA_ROWS + verticalChrome;
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function autoResizeTextarea(index: number) {
    resizeTextareaNode(textareaRefs[index]);
  }

  function autoResizeAction(node: HTMLTextAreaElement, _value: string) {
    resizeTextareaNode(node);
    return {
      update(nextValue: string) {
        void nextValue;
        resizeTextareaNode(node);
      }
    };
  }

  export function focusPrimaryTextarea() {
    const first = textareaRefs[0];
    first?.focus({ preventScroll: true });
  }
  
  const add = (i: number) => dispatch("add", { index: i });

  function reindexMetadataTokensAfterRemove(removedIndex: number) {
    const next: Record<number, string[]> = {};

    Object.entries(metadataTokensByIndex).forEach(([key, tokens]) => {
      const idx = Number(key);
      if (!Number.isFinite(idx)) return;
      if (idx === removedIndex) return;

      const targetIndex = idx > removedIndex ? idx - 1 : idx;
      next[targetIndex] = normalizeMetadataTokens(Array.isArray(tokens) ? tokens : []);
    });

    metadataTokensByIndex = next;
  }

  function reindexMetadataTokensAfterReorder(indexA: number, indexB: number, mode: "swap" | "move" = "swap") {
    if (indexA < 0 || indexA >= textareas.length) return;
    if (indexB < 0 || indexB >= textareas.length) return;
    if (indexA === indexB) return;

    const entries = Array.from(
      { length: textareas.length },
      (_, i) => normalizeMetadataTokens(Array.isArray(metadataTokensByIndex[i]) ? metadataTokensByIndex[i] : [])
    );

    if (mode === "move") {
      const [moved] = entries.splice(indexA, 1);
      entries.splice(indexB, 0, moved || []);
    } else {
      const temp = entries[indexA] || [];
      entries[indexA] = entries[indexB] || [];
      entries[indexB] = temp;
    }

    metadataTokensByIndex = Object.fromEntries(
      entries.map((tokens, i) => [i, tokens])
    );
  }

  const remove = (i: number) => {
    reindexMetadataTokensAfterRemove(i);
    dispatch("remove", { index: i });
  };
  let openStepActionsIndex: number | null = null;

  function toggleStepActions(index: number) {
    closeMenu();
    openStepActionsIndex = openStepActionsIndex === index ? null : index;
  }

  function closeStepActions() {
    openStepActionsIndex = null;
  }

  function removeStepFromMenu(index: number) {
    remove(index);
    closeStepActions();
  }

  let draggedStepIndex: number | null = null;
  let dropStepIndex: number | null = null;
  let imageDropIndex: number | null = null;
  let stepRefs: Array<HTMLElement | null> = [];
  const FRAME_DRAG_MIME = "application/x-visione-frame";

  function isFrameDragEvent(event: DragEvent) {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes(FRAME_DRAG_MIME);
  }

  function startStepDrag(index: number, event: DragEvent) {
    if (textareas.length <= 1) return;
    draggedStepIndex = index;
    dropStepIndex = index;

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleStepDragOver(index: number, event: DragEvent) {
    if (draggedStepIndex === null) return;
    event.preventDefault();

    dropStepIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function getNearestStepIndex(clientY: number) {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < stepRefs.length; i += 1) {
      const el = stepRefs[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  function handleStepsListDragOver(event: DragEvent) {
    if (draggedStepIndex === null) return;
    event.preventDefault();

    const nearestIndex = getNearestStepIndex(event.clientY);
    if (nearestIndex < 0) return;

    dropStepIndex = nearestIndex;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleStepsListDrop(event: DragEvent) {
    if (draggedStepIndex === null) return;
    event.preventDefault();

    const fallbackIndex = getNearestStepIndex(event.clientY);
    const index = dropStepIndex ?? fallbackIndex;
    if (index < 0) {
      handleStepDragEnd();
      return;
    }

    handleStepDrop(index, event);
  }

  function handleStepDrop(index: number, event: DragEvent) {
    if (draggedStepIndex === null) return;
    event.preventDefault();

    const sourceIndex = draggedStepIndex;
    const targetIndex = index;

    draggedStepIndex = null;
    dropStepIndex = null;

    if (sourceIndex !== targetIndex) {
      reindexMetadataTokensAfterReorder(sourceIndex, targetIndex, "move");
      dispatch("swapTextarea", { indexA: sourceIndex, indexB: targetIndex, mode: "move" });
      setTimeout(() => dispatchSearchWithMetadata(), 100);
    }
  }

  function handleStepDragEnd() {
    draggedStepIndex = null;
    dropStepIndex = null;
  }

  function handleTextareaDragOver(index: number, event: DragEvent) {
    if (draggedStepIndex !== null) return;
    if (!isFrameDragEvent(event)) return;

    event.preventDefault();
    event.stopPropagation();
    imageDropIndex = index;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleTextareaDrop(index: number, event: DragEvent) {
    if (draggedStepIndex !== null) return;
    if (!isFrameDragEvent(event)) return;

    event.preventDefault();
    event.stopPropagation();

    const raw = event.dataTransfer?.getData(FRAME_DRAG_MIME);
    imageDropIndex = null;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.url) return;

      if (isSimilarityStep(index)) {
        const nextName = parsed.title || parsed.imgId || `Similarity ${index + 1}`;
        dispatch('replaceSimilarityImage', {
          index,
          imgId: parsed.imgId || null,
          url: parsed.url,
          name: nextName
        });
        toasts.success(`Similarity image replaced on step ${index + 1}`);
        return;
      }

      addImageToTextarea(
        index,
        parsed.url,
        parsed.title || parsed.imgId || `Result ${index + 1}`,
        "result",
        parsed.imgId || null
      );

      toasts.success(`Frame added to step ${index + 1}`);
    } catch {
      // Ignore malformed drag payloads
    }
  }

  function handleTextareaDragLeave(index: number, event: DragEvent) {
    if (imageDropIndex !== index) return;
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) return;
    imageDropIndex = null;
  }

  const toggle = (index: number) => {
    const nextTextareas = textareas.map((t, i) =>
      i === index ? { ...t, enabled: !t.enabled } : t
    );
    const hasActiveQuery = nextTextareas.some(t => t.enabled && t.value?.trim());

    dispatch("toggle", { index });

    if (hasActiveQuery) {
      setTimeout(() => dispatchSearchWithMetadata(), 0);
    }
  };
  const update = (i: number, value: string) => dispatch("update", { index: i, value });

  function finalizeMetadataTokensForIndex(index: number) {
    const currentValue = String(textareas[index]?.value || '');
    const { cleanText, tokens } = parseMetadataTokensFromText(currentValue, { extractTrailingToken: true });

    if (tokens.length > 0) {
      const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
      setMetadataTokens(index, [...existing, ...tokens]);
    }

    if (cleanText !== currentValue) {
      update(index, cleanText);
    }
  }

  function finalizeMetadataTokensForAll() {
    textareas.forEach((_, index) => {
      finalizeMetadataTokensForIndex(index);
    });
  }

  function buildEffectiveTextareasForSearch() {
    return textareas.map((textarea, index) => {
      const rawValue = String(textarea?.value || '');
      const { cleanText, tokens: inlineTokens } = parseMetadataTokensFromText(rawValue, { extractTrailingToken: true });
      const cleanValue = String(cleanText || '').trim();
      const existingTokens = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
      const tokens = normalizeMetadataTokens([...existingTokens, ...inlineTokens]);
      const mergedValue = tokens.length > 0
        ? (cleanValue ? `${cleanValue} ${tokens.join(' ')}` : tokens.join(' '))
        : cleanValue;

      return {
        ...textarea,
        value: mergedValue
      };
    });
  }

  export function getEffectiveTextareasSnapshot() {
    return buildEffectiveTextareasForSearch();
  }

  export function getEffectiveQueriesSnapshot() {
    return buildEffectiveTextareasForSearch()
      .filter((step) => step?.enabled)
      .map((step) => String(step?.value ?? '').trim())
      .filter(Boolean);
  }

  function dispatchSearchWithMetadata() {
    finalizeMetadataTokensForAll();
    dispatch("search", { textareas: buildEffectiveTextareasForSearch() });
  }

  export function triggerSearchWithMetadata() {
    dispatchSearchWithMetadata();
  }

  export function clearMetadataFilters() {
    metadataTokensByIndex = {};
    modalConfig.isOpen = false;
    modalMetadataField = '';
    modalMetadataShortcut = '';
  }
  
  function swapQueries(indexA: number, indexB: number) {
    if (indexB < 0 || indexB >= textareas.length) return;

    reindexMetadataTokensAfterReorder(indexA, indexB, "swap");
    dispatch("swapTextarea", { indexA, indexB, mode: "swap" });
    setTimeout(() => dispatchSearchWithMetadata(), 100);
  }


  const handleKeyDown = (e: KeyboardEvent, textareaIndex: number) => {
    if (e.key === "Enter" && !e.shiftKey && textareas[textareaIndex]?.enabled) {
      e.preventDefault();
      dispatchSearchWithMetadata();
    }
  };

  const handleTextareaInput = (index: number, e: Event) => {
    const rawValue = (e.currentTarget as HTMLTextAreaElement | null)?.value ?? "";
    const { cleanText, tokens } = parseMetadataTokensFromText(rawValue);

    if (tokens.length > 0) {
      const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
      setMetadataTokens(index, [...existing, ...tokens]);
    }

    update(index, cleanText);
  };

  function clearTextareaValue(index: number) {
    update(index, "");
    setTimeout(() => dispatchSearchWithMetadata(), 0);
  }

  function handleModelSelectionChange(index: number, model: string, kind: 'text' | 'image') {
    dispatch('updateModel', { index, model, kind });
    // Keep metadata filters in the effective query when re-running after model changes.
    setTimeout(() => dispatchSearchWithMetadata(), 0);
  }

  // Gestione menu dropdown
  let openMenuIndex: number | null = null;
  let openImageSubmenuIndex: number | null = null;
  let openTranslationHintIndex: number | null = null;
  let menuTriggerRefs: Array<HTMLButtonElement | null> = [];
  let menuPanelRefs: Array<HTMLDivElement | null> = [];
  let menuPlacementByIndex: Record<number, "top" | "bottom"> = {};
  let fileInput: HTMLInputElement | null = null;

  function setModalAnchorFromIndex(index: number) {
    const trigger = menuTriggerRefs[index];
    if (!trigger) {
      modalAnchorRect = null;
      return;
    }
    const rect = trigger.getBoundingClientRect();
    modalAnchorRect = {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function toggleTranslationHint(index: number) {
    if (!getTranslationHint(index)) {
      openTranslationHintIndex = null;
      return;
    }
    openTranslationHintIndex = openTranslationHintIndex === index ? null : index;
  }

  function closeTranslationHint() {
    openTranslationHintIndex = null;
  }

  function applyTranslationVariant(index: number, variant: 'original' | 'english') {
    const hint = getTranslationHint(index);
    if (!hint) return;

    const nextValue = variant === 'original' ? hint.from : hint.to;
    update(index, nextValue);
    closeTranslationHint();
    setTimeout(() => autoResizeTextarea(index), 0);
  }

  async function toggleMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index;
    openImageSubmenuIndex = null;

    if (openMenuIndex === index) {
      await tick();
      updateMenuPlacement(index);
    }
  }

  function closeMenu() {
    openMenuIndex = null;
    openImageSubmenuIndex = null;
  }

  function openImageSubmenu(index: number) {
    openImageSubmenuIndex = index;
  }

  function closeImageSubmenu() {
    openImageSubmenuIndex = null;
  }

  $: if (openTranslationHintIndex !== null && !getTranslationHint(openTranslationHintIndex)) {
    openTranslationHintIndex = null;
  }

  function updateMenuPlacement(index: number) {
    const trigger = menuTriggerRefs[index];
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuPanel = menuPanelRefs[index];
    const menuHeight = Math.ceil(menuPanel?.getBoundingClientRect?.().height || 360);
    const gap = 8;
    const topSafeArea = 72;
    const bottomSafeArea = 12;
    const spaceAbove = Math.max(0, rect.top - topSafeArea - gap);
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - bottomSafeArea - gap);
    const fitsAbove = spaceAbove >= menuHeight;
    const fitsBelow = spaceBelow >= menuHeight;

    menuPlacementByIndex[index] =
      fitsAbove && (!fitsBelow || spaceAbove > spaceBelow) ? "top" : "bottom";
  }

  function refreshOpenMenuPlacement() {
    if (openMenuIndex === null) return;
    updateMenuPlacement(openMenuIndex);
  }

  // Gestione immagini

  function insertShortcut(index: number, shortcut: string) {
    const currentValue = textareas[index].value || '';
    update(index, currentValue + shortcut);
    closeMenu();
  }

  function handleImageFromFile(index: number) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e: Event) => {
      const target = e.currentTarget as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          const dataUrl = event.target?.result;
          if (typeof dataUrl === "string") {
            addImageToTextarea(index, dataUrl, file.name, 'file');
          }
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
    closeMenu();
  }

  function handleImageFromURL(index: number) {
    const url = prompt('Enter image URL:');
    if (url) {
      addImageToTextarea(index, url, 'Image from URL', 'url');
    }
    closeMenu();
  }

  function openImagePicker(index: number) {
    isSelectingImageFor = index;
    closeMenu();
    // Dispatch event to activate selection mode
    dispatch('startImageSelection', { textareaIndex: index });
  }

  export function handleImageSelected(image: AvailableImage) {
    if (isSelectingImageFor === null) return;
    
    addImageToTextarea(
      isSelectingImageFor,
      image.url,
      `${image.imgId || image.title}`,
      'result',
      image.imgId
    );
    
    isSelectingImageFor = null;
    dispatch('imageSelected');
  }

  export function cancelSelection() {
    isSelectingImageFor = null;
  }


  // addImageToTextarea accetta imgId opzionale
  function addImageToTextarea(index: number, url: string, name: string, type: AttachedImage["type"], imgId: string | null = null) {
    // Keep only one image per textarea: newest selection replaces previous one.
    textareaImages[index] = [{ url, name, type, imgId }];
    
    // Notifica il padre del cambiamento
    dispatch('updateImages', { index, images: textareaImages[index] });
  }

  function removeImageFromTextarea(textareaIndex: number, imageIndex: number) {
    textareaImages[textareaIndex] = textareaImages[textareaIndex].filter((_, i) => i !== imageIndex);

    
    // Notifica il padre
    dispatch('updateImages', { index: textareaIndex, images: textareaImages[textareaIndex] });
  }

  function removePrimarySimilarityImage(textareaIndex: number, imageIndex: number) {
    removeImageFromTextarea(textareaIndex, imageIndex);
    const hasText = String(textareas[textareaIndex]?.value || '').trim().length > 0;
    if (!hasText) {
      similarityTextConstraintOpen = {
        ...similarityTextConstraintOpen,
        [textareaIndex]: false
      };
      dispatch('closeSimilarityStep', { index: textareaIndex });
    }
  }

  // Click outside to close menus
  function handleClickOutside(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (openMenuIndex !== null && !target.closest('.menu-container')) {
      closeMenu();
    }
    if (openStepActionsIndex !== null && !target.closest('.step-actions-menu')) {
      closeStepActions();
    }
    if (openTranslationHintIndex !== null && !target.closest('.translation-hint-popover')) {
      closeTranslationHint();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    closeMenu();
    closeStepActions();
    closeTranslationHint();
  }

  function openUrlModal(index: number) {

    modalConfig = {
      isOpen: true,
      title: 'Add Image from URL',
      icon: 'link',
      description: 'Paste an image URL',
      targetIndex: index,
      filterType: 'imageUrl',
      fields: [
        {
          name: 'url',
          label: 'Image URL',
          type: 'url',
          placeholder: 'https://example.com/image.webp',
          value: '',
          required: true,
          hint: 'Must be a valid image URL'
        },
        {
          name: 'name',
          label: 'Image Name (optional)',
          type: 'text',
          placeholder: 'My image',
          value: ''
        }
      ]
    };

    closeMenu();
  }
  
  function openMetadataFilterModal(index: number, field: string) {
    return openMetadataFilterModalWithPrefill(index, field);
  }

  function openMetadataFilterModalWithPrefill(
    index: number,
    field: string,
    prefill?: { comparator?: string; value?: string }
  ) {
    const normalizedField = String(field || '').trim();
    if (!normalizedField) return;

    modalMetadataField = normalizedField;
    modalMetadataShortcut = getShortcutForField(normalizedField);
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: `Add ${normalizedField} Filter`,
      icon: 'filter',
      description: `Insert ${modalMetadataShortcut}:... for metadata filtering`,
      targetIndex: index,
      filterType: 'metadata',
      fields: [
        {
          name: 'comparator',
          label: 'Comparator',
          type: 'select',
          value: String(prefill?.comparator || getDefaultComparatorForField(normalizedField)).trim().toLowerCase(),
          options: [
            { value: 'eq', label: '= (equal)' },
            { value: 'ne', label: '!= (not equal)' },
            { value: 'gte', label: '>= (equal greater than)' },
            { value: 'lte', label: '<= (equal less than)' },
            { value: 'lt', label: '< (less than)' },
            { value: 'gt', label: '> (greater than)' },
            { value: 'fts', label: '~ (full-text search)' }
          ]
        },
        {
          name: 'value',
          label: 'Value',
          type: 'text',
          value: String(prefill?.value ?? ''),
          placeholder: 'Filter value',
          required: true,
          hint: getMetadataFieldHint(normalizedField)
        }
      ]
    };

    closeMenu();
  }

  function openDateRangeFilterModal(index: number) {
    modalMetadataField = 'date';
    modalMetadataShortcut = 'date';
    const prefill = getDateMetadataPrefill(index);
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Date Range',
      icon: 'calendar',
      description: 'Search within a temporal interval. Use From, To, or both; partial dates such as YYYY/MM/DD:HH are supported.',
      targetIndex: index,
      filterType: 'metadataDateRange',
      fields: [
        {
          name: 'dateFromParts',
          label: 'From',
          type: 'dateParts',
          value: prefill.dateFromParts || { day: '', month: '', year: '', hour: '' }
        },
        {
          name: 'dateToParts',
          label: 'To',
          type: 'dateParts',
          value: prefill.dateToParts || { day: '', month: '', year: '', hour: '' }
        },
        {
          name: 'datePreview',
          label: 'Query preview',
          type: 'preview',
          computePreview: (values: ModalSubmitData) => {
            const tokens = buildDateRangeFilterTokens(values);
            return tokens.length > 0 ? tokens.join(' ') : 'No date tokens yet';
          }
        }
      ]
    };

    closeMenu();
  }

  function normalizeDateHourMetadataFixEntry(raw: unknown) {
    const source = raw && typeof raw === 'object' ? raw as { comparator?: unknown; value?: unknown } : {};
    return {
      comparator: String(source.comparator || 'eq').trim().toLowerCase() || 'eq',
      value: String(source.value || '')
    };
  }

  function getDefaultDateHourMetadataFixes(dateFixed: unknown) {
    const source = dateFixed && typeof dateFixed === 'object'
      ? dateFixed as Record<'year' | 'month' | 'day' | 'hour', unknown>
      : {} as Record<'year' | 'month' | 'day' | 'hour', unknown>;
    const normalizeEntries = (key: 'year' | 'month' | 'day' | 'hour') => {
      const raw = source[key];

      if (Array.isArray(raw)) {
        return raw.length > 0
          ? raw.map((entry) => normalizeDateHourMetadataFixEntry(entry))
          : [{ comparator: 'eq', value: '' }];
      }

      if (raw && typeof raw === 'object' && !!(raw as { enabled?: unknown }).enabled) {
        return [normalizeDateHourMetadataFixEntry(raw)];
      }

      return [{ comparator: 'eq', value: '' }];
    };

    return {
      year: normalizeEntries('year'),
      month: normalizeEntries('month'),
      day: normalizeEntries('day'),
      hour: normalizeEntries('hour')
    };
  }

  function openDateHourMetadataFilterModal(index: number) {
    modalMetadataField = 'date';
    modalMetadataShortcut = 'date';
    const prefill = getDateMetadataPrefill(index);
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Date/Hour',
      icon: 'filter',
      description: 'Add exact Year, Month, Day, or Hour metadata constraints. Constraints are combined with AND and are not a date range.',
      targetIndex: index,
      filterType: 'metadataDateHour',
      fields: [
        {
          name: 'dateFixed',
          label: 'Metadata constraints',
          type: 'dateFixes',
          value: getDefaultDateHourMetadataFixes(prefill.dateFixed),
          hint: 'Use these for exact temporal metadata conditions, not intervals.'
        },
        {
          name: 'datePreview',
          label: 'Query preview',
          type: 'preview',
          computePreview: (values: ModalSubmitData) => {
            const tokens = buildDateHourMetadataFilterTokens(values);
            return tokens.length > 0 ? tokens.join(' ') : 'No metadata constraints yet';
          }
        }
      ]
    };

    closeMenu();
  }

  function openCountryMetadataFilterModal(index: number) {
    return openCountryMetadataFilterModalWithPrefill(index);
  }

  function openCountryMetadataFilterModalWithPrefill(
    index: number,
    prefill?: { comparator?: string; value?: string }
  ) {
    modalMetadataField = 'location_country';
    modalMetadataShortcut = 'country';
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Add Country Filter',
      icon: 'filter',
      description: `Filter by capture country (${modalMetadataField}).`,
      targetIndex: index,
      filterType: 'metadataCountry',
      fields: [
        {
          name: 'value',
          label: 'Country',
          type: 'text',
          value: String(prefill?.value ?? ''),
          placeholder: 'e.g. Ireland',
          required: true
        },
        {
          name: 'comparator',
          label: 'Comparator',
          type: 'select',
          advanced: true,
          value: String(prefill?.comparator || 'fts').trim().toLowerCase(),
          options: [
            { value: 'eq', label: '= (equal)' },
            { value: 'ne', label: '!= (not equal)' },
            { value: 'fts', label: '~ (full-text search)' }
          ]
        }
      ]
    };

    closeMenu();
  }

  function openLocationMetadataFilterModal(index: number) {
    return openLocationMetadataFilterModalWithPrefill(index);
  }

  function openLocationMetadataFilterModalWithPrefill(
    index: number,
    prefill?: { comparator?: string; value?: string }
  ) {
    modalMetadataField = 'location';
    modalMetadataShortcut = 'location';
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Add Location Filter',
      icon: 'filter',
      description: 'Filter by capture location (location).',
      targetIndex: index,
      filterType: 'metadataLocation',
      fields: [
        {
          name: 'value',
          label: 'Location',
          type: 'text',
          value: String(prefill?.value ?? ''),
          placeholder: 'e.g. Dublin',
          required: true
        },
        {
          name: 'comparator',
          label: 'Comparator',
          type: 'select',
          advanced: true,
          value: String(prefill?.comparator || 'fts').trim().toLowerCase(),
          options: [
            { value: 'eq', label: '= (equal)' },
            { value: 'ne', label: '!= (not equal)' },
            { value: 'fts', label: '~ (full-text search)' }
          ]
        }
      ]
    };

    closeMenu();
  }

  function openMusicMetadataFilterModal(index: number) {
    return openMusicMetadataFilterModalWithPrefill(index);
  }

  function openMusicMetadataFilterModalWithPrefill(
    index: number,
    prefill?: { comparator?: string; value?: string }
  ) {
    modalMetadataField = 'music';
    modalMetadataShortcut = 'music';
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Add Music Filter',
      icon: 'filter',
      description: 'Filter by music metadata (music).',
      targetIndex: index,
      filterType: 'metadataMusic',
      fields: [
        {
          name: 'value',
          label: 'Music',
          type: 'text',
          value: String(prefill?.value ?? ''),
          placeholder: 'e.g. piano',
          required: true
        },
        {
          name: 'comparator',
          label: 'Comparator',
          type: 'select',
          advanced: true,
          value: String(prefill?.comparator || 'fts').trim().toLowerCase(),
          options: [
            { value: 'eq', label: '= (equal)' },
            { value: 'ne', label: '!= (not equal)' },
            { value: 'fts', label: '~ (full-text search)' }
          ]
        }
      ]
    };

    closeMenu();
  }

  function getHeartRateMetadataPrefill(index: number) {
    const snapshot = getMetadataTokensSnapshotForIndex(index);
    let minBpm = '';
    let maxBpm = '';

    snapshot
      .filter((token) => getFieldFromMetadataToken(token) === 'heart_rate_bpm')
      .forEach((token) => {
        const parsed = parseComparatorValue(unquoteMetadataValue(getMetadataTokenValuePart(token)), 'eq');
        const comparator = String(parsed.comparator || 'eq').trim().toLowerCase();
        const value = String(parsed.value || '').trim();
        if (!value) return;

        if (comparator === 'gte' || comparator === 'gt') {
          minBpm = value;
        } else if (comparator === 'lte' || comparator === 'lt') {
          maxBpm = value;
        } else if (comparator === 'eq') {
          minBpm = value;
          maxBpm = value;
        }
      });

    return { minBpm, maxBpm };
  }

  function openHeartRateMetadataFilterModal(index: number) {
    modalMetadataField = 'heart_rate_bpm';
    modalMetadataShortcut = 'heart_rate_bpm';
    const prefill = getHeartRateMetadataPrefill(index);
    setModalAnchorFromIndex(index);

    modalConfig = {
      isOpen: true,
      title: 'Heart Rate',
      icon: 'filter',
      description: 'Search frames where heart rate is within this BPM range.',
      targetIndex: index,
      filterType: 'metadataHeartRate',
      fields: [
        {
          name: 'minBpm',
          label: 'Min BPM',
          type: 'number',
          value: prefill.minBpm,
          placeholder: 'e.g. 60',
          min: 0,
          step: 1
        },
        {
          name: 'maxBpm',
          label: 'Max BPM',
          type: 'number',
          value: prefill.maxBpm,
          placeholder: 'e.g. 120',
          min: 0,
          step: 1
        },
        {
          name: 'heartRatePreview',
          label: 'Query preview',
          type: 'preview',
          computePreview: (values: ModalSubmitData) => {
            const tokens = buildHeartRateMetadataFilterTokens(values);
            return tokens.length > 0 ? tokens.join(' ') : 'No heart rate range yet';
          }
        }
      ]
    };

    closeMenu();
  }

  function appendTokensToTextarea(index: number, tokens: string[]) {
    const safeTokens = tokens.map((token) => String(token || '').trim()).filter(Boolean);
    if (safeTokens.length === 0) return;

    const currentValue = textareas[index].value || '';
    const sep = currentValue.trim().length > 0 ? ' ' : '';
    update(index, `${currentValue}${sep}${safeTokens.join(' ')}`.trim());
  }

  function getFieldFromMetadataToken(token: string) {
    const raw = String(token || '').trim();
    const match = raw.match(/^([a-z_]+):/i);
    if (!match) return '';
    const key = String(match[1] || '').trim().toLowerCase();
    return FIELD_BY_METADATA_KEY[key] || '';
  }

  function normalizeMetadataTokens(tokens: string[]) {
    const out: string[] = [];
    const indexByField = new Map<string, number>();
    const seenMultiTokens = new Set<string>();

    (Array.isArray(tokens) ? tokens : []).forEach((token) => {
      const raw = String(token || '').trim();
      if (!raw) return;
      const field = getFieldFromMetadataToken(raw);
      if (!field) return;

      // Temporal and range filters can appear multiple times for the same field.
      // Keep all, only skip exact duplicates.
      if (MULTI_TOKEN_METADATA_FIELDS.has(field)) {
        if (seenMultiTokens.has(raw)) return;
        seenMultiTokens.add(raw);
        out.push(raw);
        return;
      }

      const existingIndex = indexByField.get(field);
      if (existingIndex === undefined) {
        indexByField.set(field, out.length);
        out.push(raw);
        return;
      }

      out[existingIndex] = raw;
    });

    return out;
  }

  function parseMetadataTokensFromText(text: string, options?: { extractTrailingToken?: boolean }) {
    const source = String(text || '');
    const tokenRegex = /(?:^|\s)([a-z_]+):("(?:\\.|[^"])*"|\S+)/gi;
    const extracted: string[] = [];
    let foundMetadataToken = false;
    const extractTrailingToken = options?.extractTrailingToken === true;

    const cleaned = source.replace(tokenRegex, (full, rawKey, rawValue, offset, str) => {
      const key = String(rawKey || '').trim().toLowerCase();
      const field = FIELD_BY_METADATA_KEY[key] || '';
      if (!field) return full;

      const tokenCore = `${String(rawKey || '').trim()}:${String(rawValue || '').trim()}`;
      const tokenStart = offset + (full.length - tokenCore.length);
      const tokenEnd = tokenStart + tokenCore.length;
      const trailingChar = str[tokenEnd] ?? '';
      const isTrailingToken = tokenEnd >= str.length;

      // While typing, keep the last token in the textarea until user closes it
      // (e.g., by adding whitespace), so inputs such as `y:20` are not interrupted.
      if (isTrailingToken && !extractTrailingToken) {
        return full;
      }

      if (!isTrailingToken && trailingChar && !/\s/.test(trailingChar)) {
        return full;
      }

      foundMetadataToken = true;
      extracted.push(`${key}:${String(rawValue || '').trim()}`);
      const prev = offset > 0 ? str[offset - 1] : '';
      return prev && /\s/.test(prev) ? ' ' : '';
    });

    if (!foundMetadataToken) {
      return {
        cleanText: source,
        tokens: []
      };
    }

    const normalizedClean = cleaned
      // Collapse only runs of 3+ spaces created by token removal, keep normal typing spaces intact.
      .replace(/ {3,}/g, '  ')
      // Remove one leading space only when produced by token stripping at string start.
      .replace(/^\s/, '');

    return {
      cleanText: normalizedClean,
      tokens: normalizeMetadataTokens(extracted)
    };
  }

  function setMetadataTokens(index: number, tokens: string[]) {
    const normalized = normalizeMetadataTokens(tokens);
    metadataTokensByIndex = {
      ...metadataTokensByIndex,
      [index]: normalized
    };
  }

  $: {
    textareas.forEach((textarea, index) => {
      const currentValue = String(textarea?.value || '');
      const hasDOM = typeof document !== 'undefined';
      const isFocusedTextarea = hasDOM && textareaRefs[index] && document.activeElement === textareaRefs[index];
      const { cleanText, tokens } = parseMetadataTokensFromText(currentValue, {
        extractTrailingToken: !isFocusedTextarea
      });
      if (tokens.length > 0) {
        const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
        setMetadataTokens(index, [...existing, ...tokens]);
      }
      if (cleanText !== currentValue) {
        update(index, cleanText);
      }
    });
  }

  function unquoteMetadataValue(rawValue: string) {
    const raw = String(rawValue || '').trim();
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
      return raw.slice(1, -1).replace(/\\"/g, '"').trim();
    }
    return raw;
  }

  function formatEpochBadgeValue(field: string, rawValue: string) {
    const normalizedField = String(field || '').trim().toLowerCase();
    if (!['epoch', 'epoch_from', 'epoch_to'].includes(normalizedField)) {
      return rawValue;
    }

    const parsed = parseComparatorValue(rawValue, 'eq');
    const comparator = String(parsed.comparator || 'eq').trim().toLowerCase();
    const numeric = Number(String(parsed.value || '').trim());
    if (!Number.isFinite(numeric)) return rawValue;

    // Backward compatible: accept both seconds and legacy milliseconds.
    const epochSeconds = Math.abs(numeric) > 1e11 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    const date = new Date(epochSeconds * 1000);
    if (Number.isNaN(date.getTime())) return rawValue;

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;

    const symbol = toComparatorSymbol(comparator, 'eq');
    const prefix = comparator === 'eq' ? '' : `${symbol} `;
    return `${prefix}${formatted}`;
  }

  function getMetadataChipsForTokens(tokens: string[]): MetadataChip[] {
    const source = Array.isArray(tokens) ? tokens.join(' ') : '';
    const tokenRegex = /(?:^|\s)([a-z_]+):("(?:\\.|[^"])*"|\S+)/gi;
    const chips: MetadataChip[] = [];
    let match: RegExpExecArray | null = null;

    while ((match = tokenRegex.exec(source)) !== null) {
      const key = String(match[1] || '').trim().toLowerCase();
      const rawValue = String(match[2] || '').trim();
      const field = FIELD_BY_METADATA_KEY[key] || '';
      if (!field) continue;

      const token = `${key}:${rawValue}`;
      const value = formatEpochBadgeValue(field, unquoteMetadataValue(rawValue));
      chips.push({
        token,
        field,
        label: METADATA_LABEL_BY_FIELD[field] || field,
        value
      });
    }

    return chips;
  }

  function getMetadataChipsForIndex(index: number): MetadataChip[] {
    const tokens = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    return getMetadataChipsForTokens(tokens);
  }

  function removeMetadataTokenFromTextarea(index: number, token: string) {
    const rawToken = String(token || '').trim();
    if (!rawToken) return;

    const currentTokens = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const nextTokens = currentTokens.filter((entry) => entry !== rawToken);
    if (nextTokens.length === currentTokens.length) return;

    setMetadataTokens(index, nextTokens);
    setTimeout(() => dispatchSearchWithMetadata(), 0);
  }

  function clearMetadataTokensForIndex(index: number) {
    if (!Array.isArray(metadataTokensByIndex[index]) || metadataTokensByIndex[index].length === 0) return;

    const next = { ...metadataTokensByIndex };
    delete next[index];
    metadataTokensByIndex = next;
  }

  function hasTextareaQueryContent(index: number) {
    const hasText = String(textareas[index]?.value || '').trim().length > 0;
    const hasMetadataTokens = Array.isArray(metadataTokensByIndex[index]) && metadataTokensByIndex[index].length > 0;
    return hasText || hasMetadataTokens;
  }

  function hasTextareaTextContent(index: number) {
    return String(textareas[index]?.value || '').trim().length > 0;
  }

  function escapeRegex(text: string) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function removeShortcutTokensFromText(text: string, shortcuts: string[]) {
    const source = String(text || '');
    const uniqueShortcuts = Array.from(new Set(
      (Array.isArray(shortcuts) ? shortcuts : [])
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean)
    ));

    if (uniqueShortcuts.length === 0) return source;

    const alternation = uniqueShortcuts.map((s) => escapeRegex(s)).join('|');
    // Match tokens such as key:value and key:"value with spaces".
    const tokenRegex = new RegExp(`(^|\\s)(?:${alternation}):(?:"(?:\\\\.|[^"])*"|\\S+)`, 'gi');

    const stripped = source.replace(tokenRegex, (match, leading) => {
      return leading ? ' ' : '';
    });

    return stripped.replace(/\s{2,}/g, ' ').trim();
  }

  function upsertMetadataTokens(index: number, tokens: string[], shortcutsToReplace: string[]) {
    const safeTokens = tokens.map((token) => String(token || '').trim()).filter(Boolean);
    if (safeTokens.length === 0) return;

    const currentValue = String(textareas[index]?.value || '');
    const baseValue = removeShortcutTokensFromText(currentValue, shortcutsToReplace);
    if (baseValue !== currentValue) {
      update(index, baseValue);
    }

    const normalizedShortcuts = new Set(
      (Array.isArray(shortcutsToReplace) ? shortcutsToReplace : [])
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const existingTokens = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const keptTokens = existingTokens.filter((existingToken) => {
      const match = String(existingToken || '').trim().match(/^([a-z_]+):/i);
      if (!match) return false;
      const key = String(match[1] || '').trim().toLowerCase();
      const field = FIELD_BY_METADATA_KEY[key] || '';
      return !normalizedShortcuts.has(key) && (!field || !normalizedShortcuts.has(field));
    });

    setMetadataTokens(index, [...keptTokens, ...safeTokens]);
  }

  function normalizeOptionalNumber(value: unknown, min: number, max: number) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    const floored = Math.floor(parsed);
    if (floored < min || floored > max) return null;
    return floored;
  }

  function normalizeOptionalYear(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;

    const floored = Math.floor(parsed);
    if (floored >= 0 && floored <= 99) {
      return 2000 + floored;
    }
    if (floored < 1900 || floored > 9999) return null;
    return floored;
  }

  function parseYearPart(raw: string) {
    const trimmed = String(raw || '').trim();
    if (!/^\d{2,4}$/.test(trimmed)) return null;
    return normalizeOptionalYear(trimmed);
  }

  function parseDateExpression(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return { year: null as number | null, month: null as number | null, day: null as number | null, hour: null as number | null };
    }

    const compact = raw.replace(/T/g, ' ').replace(/\s+/g, ' ').trim();

    // DD/MM/YYYY or DD-MM-YYYY with optional HH
    const dmy = compact.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+([01]?\d|2[0-3]))?$/);
    if (dmy) {
      const parsedDay = normalizeOptionalNumber(dmy[1], 1, 31);
      const parsedMonth = normalizeOptionalNumber(dmy[2], 1, 12);
      const parsedYear = parseYearPart(dmy[3]);
      const parsedHour = dmy[4] ? normalizeOptionalNumber(dmy[4], 0, 23) : null;
      if (parsedDay !== null && parsedMonth !== null && parsedYear !== null) {
        return { year: parsedYear, month: parsedMonth, day: parsedDay, hour: parsedHour };
      }
    }

    const normalized = compact.replace(/\//g, '-');

    // HH (hour only)
    const hourOnly = normalized.match(/^([01]?\d|2[0-3])$/);
    if (hourOnly) {
      return { year: null, month: null, day: null, hour: Number(hourOnly[1]) };
    }

    // YYYY
    const y = normalized.match(/^(\d{4})$/);
    if (y) {
      return { year: Number(y[1]), month: null, day: null, hour: null };
    }

    // YYYY-MM or YY-MM
    const ym = normalized.match(/^(\d{2,4})-(\d{1,2})$/);
    if (ym) {
      const parsedYear = parseYearPart(ym[1]);
      const parsedMonth = normalizeOptionalNumber(ym[2], 1, 12);
      return { year: parsedYear, month: parsedMonth, day: null, hour: null };
    }

    // YYYY-MM-DD or YY-MM-DD
    const ymd = normalized.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const parsedYear = parseYearPart(ymd[1]);
      const parsedMonth = normalizeOptionalNumber(ymd[2], 1, 12);
      const parsedDay = normalizeOptionalNumber(ymd[3], 1, 31);
      return { year: parsedYear, month: parsedMonth, day: parsedDay, hour: null };
    }

    // YYYY-MM-DD HH or YY-MM-DD HH
    const ymdh = normalized.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})\s+([01]?\d|2[0-3])$/);
    if (ymdh) {
      const parsedYear = parseYearPart(ymdh[1]);
      const parsedMonth = normalizeOptionalNumber(ymdh[2], 1, 12);
      const parsedDay = normalizeOptionalNumber(ymdh[3], 1, 31);
      const parsedHour = normalizeOptionalNumber(ymdh[4], 0, 23);
      return { year: parsedYear, month: parsedMonth, day: parsedDay, hour: parsedHour };
    }

    return { year: null, month: null, day: null, hour: null };
  }

  function buildDateExprFromParts(parts: { year: number | null; month: number | null; day: number | null; hour: number | null }) {
    const pad2 = (value: number) => String(value).padStart(2, '0');
    if (parts.year !== null) {
      let dateExpr = String(parts.year);
      if (parts.month !== null) {
        dateExpr += `-${pad2(parts.month)}`;
        if (parts.day !== null) {
          dateExpr += `-${pad2(parts.day)}`;
        }
      }
      if (parts.hour !== null) {
        dateExpr += ` ${pad2(parts.hour)}`;
      }
      return dateExpr;
    }

    if (parts.hour !== null) {
      return String(parts.hour);
    }

    return '';
  }

  function getMetadataTokenValuePart(token: string) {
    const raw = String(token || '').trim();
    const idx = raw.indexOf(':');
    if (idx < 0) return '';
    return raw.slice(idx + 1).trim();
  }

  function stripComparatorPrefix(value: string) {
    return String(value || '').trim().replace(/^(>=|<=|!=|>|<|=|~)/, '').trim();
  }

  function parseComparatorValue(value: string, fallbackComparator = 'eq') {
    const raw = String(value || '').trim();
    const fallback = String(fallbackComparator || 'eq').trim().toLowerCase();

    if (raw.startsWith('>=')) return { comparator: 'gte', value: raw.slice(2).trim() };
    if (raw.startsWith('<=')) return { comparator: 'lte', value: raw.slice(2).trim() };
    if (raw.startsWith('!=')) return { comparator: 'ne', value: raw.slice(2).trim() };
    if (raw.startsWith('>')) return { comparator: 'gt', value: raw.slice(1).trim() };
    if (raw.startsWith('<')) return { comparator: 'lt', value: raw.slice(1).trim() };
    if (raw.startsWith('=')) return { comparator: 'eq', value: raw.slice(1).trim() };
    if (raw.startsWith('~')) {
      return { comparator: 'fts', value: raw.slice(1).trim() };
    }

    return { comparator: fallback, value: raw };
  }

  function getComparatorAndValueFromToken(token: string, field: string) {
    const rawValue = unquoteMetadataValue(getMetadataTokenValuePart(token));
    const fallbackComparator = getDefaultComparatorForField(field);
    const parsed = parseComparatorValue(rawValue, fallbackComparator);
    return {
      comparator: parsed.comparator,
      value: stripComparatorPrefix(parsed.value)
    };
  }

  function editMetadataChip(index: number, chip: MetadataChip) {
    const field = String(chip?.field || '').trim().toLowerCase();
    if (!field) return;

    if (DATE_RANGE_FIELDS.has(field)) {
      openDateRangeFilterModal(index);
      return;
    }

    if (DATE_HOUR_METADATA_FIELDS.has(field)) {
      openDateHourMetadataFilterModal(index);
      return;
    }

    const parsed = getComparatorAndValueFromToken(chip.token, field);

    if (field === 'location_country') {
      openCountryMetadataFilterModalWithPrefill(index, parsed);
      return;
    }

    if (field === 'location') {
      openLocationMetadataFilterModalWithPrefill(index, parsed);
      return;
    }

    if (field === 'music') {
      openMusicMetadataFilterModalWithPrefill(index, parsed);
      return;
    }

    if (field === 'heart_rate_bpm') {
      openHeartRateMetadataFilterModal(index);
      return;
    }

    openMetadataFilterModalWithPrefill(index, field, parsed);
  }

  function getMetadataTokensSnapshotForIndex(index: number) {
    const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const rawValue = String(textareas[index]?.value || '');
    const { tokens: inlineTokens } = parseMetadataTokensFromText(rawValue, { extractTrailingToken: true });
    return normalizeMetadataTokens([...existing, ...inlineTokens]);
  }

  function getDateMetadataPrefill(index: number) {
    const snapshot = getMetadataTokensSnapshotForIndex(index);
    const padPart = (value: number | null, kind: 'month' | 'day' | 'hour') => {
      if (value == null) return '';
      const min = kind === 'month' ? 1 : kind === 'day' ? 1 : 0;
      const max = kind === 'month' ? 12 : kind === 'day' ? 31 : 23;
      const normalized = normalizeOptionalNumber(value, min, max);
      return normalized == null ? '' : String(normalized).padStart(2, '0');
    };

    const getFixedValuesForField = (field: string) => {
      return snapshot
        .filter((entry) => {
          const mapped = getFieldFromMetadataToken(entry);
          return mapped === field;
        })
        .map((token) => {
          const parsed = parseComparatorValue(unquoteMetadataValue(getMetadataTokenValuePart(token)), 'eq');
          const comparator = String(parsed.comparator || 'eq').toLowerCase();
          if (!['eq', 'ne', 'lt', 'gt', 'gte', 'lte'].includes(comparator)) return null;

          let normalized: number | null = null;
          if (field === 'year') normalized = normalizeOptionalYear(parsed.value);
          else if (field === 'month') normalized = normalizeOptionalNumber(parsed.value, 1, 12);
          else if (field === 'day') normalized = normalizeOptionalNumber(parsed.value, 1, 31);
          else if (field === 'hour') normalized = normalizeOptionalNumber(parsed.value, 0, 23);

          if (normalized === null) return null;
          if (field === 'month') return { comparator, value: padPart(normalized, 'month') };
          if (field === 'day') return { comparator, value: padPart(normalized, 'day') };
          if (field === 'hour') return { comparator, value: padPart(normalized, 'hour') };
          return { comparator, value: String(normalized) };
        })
        .filter(Boolean);
    };

    const dateFixed = {
      year: getFixedValuesForField('year'),
      month: getFixedValuesForField('month'),
      day: getFixedValuesForField('day'),
      hour: getFixedValuesForField('hour')
    };

    const parseComparator = (raw: string) => {
      const source = String(raw || '').trim();
      const operators: Array<[string, string]> = [
        ['>=', 'gte'],
        ['<=', 'lte'],
        ['!=', 'ne'],
        ['>', 'gt'],
        ['<', 'lt'],
        ['=', 'eq']
      ];
      for (const [symbol, code] of operators) {
        if (source.startsWith(symbol)) {
          return { comparator: code, value: source.slice(symbol.length).trim() };
        }
      }
      return { comparator: 'eq', value: source };
    };

    const epochToParts = (epochValue: string) => {
      const parsedEpoch = Number(String(epochValue || '').trim());
      if (!Number.isFinite(parsedEpoch)) return null;
      const asMs = Math.abs(parsedEpoch) > 1e11 ? parsedEpoch : parsedEpoch * 1000;
      const date = new Date(asMs);
      if (Number.isNaN(date.getTime())) return null;
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours()
      };
    };

    const explicitEpochFromToken = snapshot.find((token) => getFieldFromMetadataToken(token) === 'epoch_from');
    const explicitEpochToToken = snapshot.find((token) => getFieldFromMetadataToken(token) === 'epoch_to');
    if (explicitEpochFromToken || explicitEpochToToken) {
      const fromParsed = explicitEpochFromToken
        ? parseComparator(unquoteMetadataValue(getMetadataTokenValuePart(explicitEpochFromToken)))
        : null;
      const toParsed = explicitEpochToToken
        ? parseComparator(unquoteMetadataValue(getMetadataTokenValuePart(explicitEpochToToken)))
        : null;
      const fromParts = fromParsed ? epochToParts(fromParsed.value) : null;
      const toParts = toParsed ? epochToParts(toParsed.value) : null;

      const comparator = (!toParts && fromParsed?.comparator)
        ? String(fromParsed.comparator || 'gte').toLowerCase()
        : 'gte';

      return {
        dateFrom: '',
        dateTo: '',
        comparator,
        dateFixed,
        dateFromParts: {
          day: padPart(fromParts?.day ?? null, 'day'),
          month: padPart(fromParts?.month ?? null, 'month'),
          year: fromParts?.year != null ? String(fromParts.year) : '',
          hour: padPart(fromParts?.hour ?? null, 'hour')
        },
        dateToParts: {
          day: padPart(toParts?.day ?? null, 'day'),
          month: padPart(toParts?.month ?? null, 'month'),
          year: toParts?.year != null ? String(toParts.year) : '',
          hour: padPart(toParts?.hour ?? null, 'hour')
        },
        year: fromParts?.year != null ? String(fromParts.year) : '',
        month: padPart(fromParts?.month ?? null, 'month'),
        day: padPart(fromParts?.day ?? null, 'day'),
        hour: padPart(fromParts?.hour ?? null, 'hour')
      };
    }

    const explicitDateToken = snapshot.find((token) => getFieldFromMetadataToken(token) === 'date');
    if (explicitDateToken) {
      const rawValue = unquoteMetadataValue(getMetadataTokenValuePart(explicitDateToken));
      const parsed = parseComparator(rawValue);
      const parsedComparator = String(parsed.comparator || 'eq').toLowerCase();
      const parsedParts = parseDateExpression(parsed.value);
      return {
        dateFrom: parsedComparator === 'lte' || parsedComparator === 'lt' ? '' : parsed.value,
        dateTo: parsedComparator === 'lte' || parsedComparator === 'lt' ? parsed.value : '',
        comparator: parsedComparator,
        dateFixed,
        dateFromParts: parsedComparator === 'lte' || parsedComparator === 'lt'
          ? { day: '', month: '', year: '', hour: '' }
          : {
              day: padPart(parsedParts.day, 'day'),
              month: padPart(parsedParts.month, 'month'),
              year: parsedParts.year != null ? String(parsedParts.year) : '',
              hour: padPart(parsedParts.hour, 'hour')
            },
        dateToParts: parsedComparator === 'lte' || parsedComparator === 'lt'
          ? {
              day: padPart(parsedParts.day, 'day'),
              month: padPart(parsedParts.month, 'month'),
              year: parsedParts.year != null ? String(parsedParts.year) : '',
              hour: padPart(parsedParts.hour, 'hour')
            }
          : { day: '', month: '', year: '', hour: '' },
        year: parsedParts.year != null ? String(parsedParts.year) : '',
        month: padPart(parsedParts.month, 'month'),
        day: padPart(parsedParts.day, 'day'),
        hour: padPart(parsedParts.hour, 'hour')
      };
    }

    return {
      dateFrom: '',
      dateTo: '',
      comparator: 'eq',
      dateFixed,
      dateFromParts: { day: '', month: '', year: '', hour: '' },
      dateToParts: { day: '', month: '', year: '', hour: '' },
      year: '',
      month: '',
      day: '',
      hour: ''
    };
  }

  function upsertDateRangeTokens(index: number, tokens: string[]) {
    const incomingTokens = normalizeMetadataTokens(tokens);
    const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const keptTokens = existing.filter((token) => {
      const field = getFieldFromMetadataToken(token);
      return !field || !DATE_RANGE_FIELDS.has(field);
    });

    setMetadataTokens(index, [...keptTokens, ...incomingTokens]);
  }

  function upsertDateHourMetadataTokens(index: number, tokens: string[]) {
    const incomingTokens = normalizeMetadataTokens(tokens);
    const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const keptTokens = existing.filter((token) => {
      const field = getFieldFromMetadataToken(token);
      return !field || !DATE_HOUR_METADATA_FIELDS.has(field);
    });

    setMetadataTokens(index, [...keptTokens, ...incomingTokens]);
  }

  function upsertHeartRateMetadataTokens(index: number, tokens: string[]) {
    const incomingTokens = normalizeMetadataTokens(tokens);
    const existing = Array.isArray(metadataTokensByIndex[index]) ? metadataTokensByIndex[index] : [];
    const keptTokens = existing.filter((token) => getFieldFromMetadataToken(token) !== 'heart_rate_bpm');

    setMetadataTokens(index, [...keptTokens, ...incomingTokens]);
  }

  function normalizeBpmInput(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  }

  function buildHeartRateMetadataFilterTokens(data: ModalSubmitData) {
    const minBpm = normalizeBpmInput(data.minBpm);
    const maxBpm = normalizeBpmInput(data.maxBpm);
    const tokens: string[] = [];

    if (minBpm !== null) tokens.push(`heart_rate_bpm:>=${quoteFilterTokenValue(minBpm)}`);
    if (maxBpm !== null) tokens.push(`heart_rate_bpm:<=${quoteFilterTokenValue(maxBpm)}`);

    return normalizeMetadataTokens(tokens);
  }

  function buildDateFilterTokens(data: ModalSubmitData) {
    const readFixedParts = (parts: unknown, key: 'year' | 'month' | 'day' | 'hour') => {
      if (!parts || typeof parts !== 'object') return [];
      const raw = (parts as Record<string, unknown>)[key];

      if (Array.isArray(raw)) {
        return raw.map((entry) => ({
          comparator: String((entry as Record<string, unknown>)?.comparator || 'eq').trim().toLowerCase() || 'eq',
          value: String((entry as Record<string, unknown>)?.value || '').trim()
        }));
      }

      // Backward compatibility with old single-entry shape.
      if (raw && typeof raw === 'object' && !!(raw as Record<string, unknown>).enabled) {
        return [{
          comparator: String((raw as Record<string, unknown>).comparator || 'eq').trim().toLowerCase() || 'eq',
          value: String((raw as Record<string, unknown>).value || '').trim()
        }];
      }

      return [];
    };

    const buildFixedTokens = () => {
      const fixed = {
        year: readFixedParts(data.dateFixed, 'year'),
        month: readFixedParts(data.dateFixed, 'month'),
        day: readFixedParts(data.dateFixed, 'day'),
        hour: readFixedParts(data.dateFixed, 'hour')
      };

      const out: string[] = [];
      const append = (field: 'year' | 'month' | 'day' | 'hour', entries: Array<{ comparator: string; value: string }>) => {
        entries.forEach((entry) => {
          const cmp = ['eq', 'ne', 'gte', 'lte', 'gt', 'lt'].includes(entry.comparator)
            ? entry.comparator
            : 'eq';

          let normalized: number | null = null;
          if (field === 'year') normalized = normalizeOptionalYear(entry.value);
          else if (field === 'month') normalized = normalizeOptionalNumber(entry.value, 1, 12);
          else if (field === 'day') normalized = normalizeOptionalNumber(entry.value, 1, 31);
          else if (field === 'hour') normalized = normalizeOptionalNumber(entry.value, 0, 23);
          if (normalized === null) return;

          const symbol = toComparatorSymbol(cmp, 'eq');
          const prefix = cmp === 'eq' ? '' : symbol;
          out.push(`${field}:${prefix}${quoteFilterTokenValue(normalized)}`);
        });
      };

      append('year', fixed.year);
      append('month', fixed.month);
      append('day', fixed.day);
      append('hour', fixed.hour);
      return normalizeMetadataTokens(out);
    };

    const normalizeDateParts = (parts: unknown) => {
      const source = (parts && typeof parts === 'object') ? (parts as Record<string, unknown>) : {};
      return {
        day: String(source.day ?? '').trim(),
        month: String(source.month ?? '').trim(),
        year: String(source.year ?? '').trim(),
        hour: String(source.hour ?? '').trim()
      };
    };

    const toEpochFromParts = (
      parts: { day: string; month: string; year: string; hour: string },
      boundary: 'start' | 'end'
    ) => {
      const hasYear = parts.year.length > 0;
      const hasMonth = parts.month.length > 0;
      const hasDay = parts.day.length > 0;
      const hasHour = parts.hour.length > 0;

      const yearValue = normalizeOptionalYear(parts.year);
      const monthValue = normalizeOptionalNumber(parts.month, 1, 12);
      const dayValue = normalizeOptionalNumber(parts.day, 1, 31);
      const hourValue = normalizeOptionalNumber(parts.hour, 0, 23);

      // Epoch partials are allowed, but must be structurally coherent.
      if (!hasYear || yearValue === null) return null;
      if (hasMonth && monthValue === null) return null;
      if (hasDay && dayValue === null) return null;
      if (hasHour && hourValue === null) return null;
      if (hasDay && !hasMonth) return null;

      const month = monthValue ?? (boundary === 'start' ? 1 : 12);
      const daysInMonth = new Date(Date.UTC(yearValue, month, 0)).getUTCDate();
      if (hasDay && dayValue !== null && dayValue > daysInMonth) return null;
      const day = dayValue ?? (boundary === 'start' ? 1 : daysInMonth);
      const hour = hourValue ?? (boundary === 'start' ? 0 : 23);
      const minute = boundary === 'start' ? 0 : 59;
      const second = boundary === 'start' ? 0 : 59;
      const millisecond = boundary === 'start' ? 0 : 999;

      const epochMs = Date.UTC(yearValue, month - 1, day, hour, minute, second, millisecond);
      if (!Number.isFinite(epochMs)) return null;
      return Math.floor(epochMs / 1000);
    };

    const fromParts = normalizeDateParts(data.dateFromParts);
    const toParts = normalizeDateParts(data.dateToParts);

    const hasAnyPart = (parts: { day: string; month: string; year: string; hour: string }) =>
      !!(parts.day || parts.month || parts.year || parts.hour);

    const hasFrom = hasAnyPart(fromParts);
    const hasTo = hasAnyPart(toParts);
    const fixedTokens = buildFixedTokens();

    if (!hasFrom && !hasTo) return fixedTokens;

    if (hasFrom && !hasTo) {
      const fromEpochStart = toEpochFromParts(fromParts, 'start');
      if (fromEpochStart !== null) {
        return normalizeMetadataTokens([
          ...fixedTokens,
          `epoch_from:${quoteFilterTokenValue(fromEpochStart)}`
        ]);
      }

      return normalizeMetadataTokens([...fixedTokens]);
    }

    const fromEpoch = hasFrom ? toEpochFromParts(fromParts, 'start') : null;
    const toEpoch = hasTo ? toEpochFromParts(toParts, 'end') : null;
    const fromTokens = hasFrom
      ? (fromEpoch !== null
        ? [`epoch_from:${quoteFilterTokenValue(fromEpoch)}`]
        : [])
      : [];
    const toTokens = hasTo
      ? (toEpoch !== null
        ? [`epoch_to:${quoteFilterTokenValue(toEpoch)}`]
        : [])
      : [];
    return normalizeMetadataTokens([...fixedTokens, ...fromTokens, ...toTokens]);
  }

  function buildDateRangeFilterTokens(data: ModalSubmitData) {
    return buildDateFilterTokens({
      ...data,
      dateFixed: {
        year: [],
        month: [],
        day: [],
        hour: []
      }
    });
  }

  function buildDateHourMetadataFilterTokens(data: ModalSubmitData) {
    return buildDateFilterTokens({
      ...data,
      dateFromParts: { day: '', month: '', year: '', hour: '' },
      dateToParts: { day: '', month: '', year: '', hour: '' }
    });
  }

  function hasInvalidEpochParts(parts: { day?: string; month?: string; year?: string; hour?: string } | undefined) {
    const safe = parts || {};
    const day = String(safe.day ?? '').trim();
    const month = String(safe.month ?? '').trim();
    const year = String(safe.year ?? '').trim();
    const hour = String(safe.hour ?? '').trim();
    const hasAny = !!(day || month || year || hour);
    if (!hasAny) return false;

    const yearValue = normalizeOptionalYear(year);
    const monthValue = normalizeOptionalNumber(month, 1, 12);
    const dayValue = normalizeOptionalNumber(day, 1, 31);
    const hourValue = normalizeOptionalNumber(hour, 0, 23);

    if (!year || yearValue === null) return true;
    if (month && monthValue === null) return true;
    if (day && dayValue === null) return true;
    if (hour && hourValue === null) return true;
    if (day && !month) return true;

    if (monthValue !== null && dayValue !== null) {
      const daysInMonth = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
      if (dayValue > daysInMonth) return true;
    }

    return false;
  }

  function quoteFilterTokenValue(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    if (/\s/.test(raw) || raw.includes(':')) {
      const escaped = raw.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }

    return raw;
  }
  
  function handleModalSubmit(event: CustomEvent<ModalSubmitData>) {

    const data = event.detail;
    const { targetIndex, filterType } = modalConfig;
    let shouldTriggerSearch = false;
    if (targetIndex === null) {
      modalConfig.isOpen = false;
      return;
    }
    
    if (filterType === 'imageUrl') {
      if (data.url) {
        addImageToTextarea(
          targetIndex,
          data.url,
          data.name || 'Image from URL',
          'url'
        );
      }
    } else if (filterType === 'metadataDateRange') {
      if (hasInvalidEpochParts(data.dateFromParts) || hasInvalidEpochParts(data.dateToParts)) {
        toasts.error('Date Range: provide at least year. Month/day/hour are optional; day requires month.');
        return;
      }

      const tokens = buildDateRangeFilterTokens(data);
      const readPart = (parts: unknown, key: 'day' | 'month' | 'year' | 'hour') => {
        if (!parts || typeof parts !== 'object') return '';
        return String((parts as Record<string, unknown>)[key] ?? '').trim();
      };
      const hasDateInput = ['day', 'month', 'year', 'hour'].some((key) =>
        readPart(data.dateFromParts, key as 'day' | 'month' | 'year' | 'hour')
        || readPart(data.dateToParts, key as 'day' | 'month' | 'year' | 'hour')
      );
      if (hasDateInput && tokens.length === 0) {
        toasts.error('Invalid date range. Check year/month/day/hour values.');
        return;
      }
      upsertDateRangeTokens(targetIndex, tokens);
      shouldTriggerSearch = tokens.length > 0;
    } else if (filterType === 'metadataDateHour') {
      const tokens = buildDateHourMetadataFilterTokens(data);
      const readFixedPart = (parts: unknown, key: 'year' | 'month' | 'day' | 'hour') => {
        if (!parts || typeof parts !== 'object') return '';
        const raw = (parts as Record<string, unknown>)[key];
        if (Array.isArray(raw)) {
          return raw
            .map((entry) => String((entry as Record<string, unknown>)?.value ?? '').trim())
            .find(Boolean) || '';
        }
        if (!raw || typeof raw !== 'object') return '';
        const enabled = !!(raw as Record<string, unknown>).enabled;
        if (!enabled) return '';
        return String((raw as Record<string, unknown>).value ?? '').trim();
      };
      const hasDateInput = ['day', 'month', 'year', 'hour'].some((key) =>
        readFixedPart(data.dateFixed, key as 'year' | 'month' | 'day' | 'hour')
      );
      if (hasDateInput && tokens.length === 0) {
        toasts.error('Invalid metadata constraint. Check Year, Month, Day, or Hour values.');
        return;
      }
      upsertDateHourMetadataTokens(targetIndex, tokens);
      shouldTriggerSearch = tokens.length > 0;
    } else if (filterType === 'metadataHeartRate') {
      const minRaw = String(data.minBpm ?? '').trim();
      const maxRaw = String(data.maxBpm ?? '').trim();
      const minBpm = normalizeBpmInput(minRaw);
      const maxBpm = normalizeBpmInput(maxRaw);

      if (!minRaw && !maxRaw) {
        toasts.error('Heart Rate: provide Min BPM, Max BPM, or both.');
        return;
      }

      if ((minRaw && minBpm === null) || (maxRaw && maxBpm === null)) {
        toasts.error('Heart Rate: BPM values must be valid non-negative numbers.');
        return;
      }

      if (minBpm !== null && maxBpm !== null && minBpm > maxBpm) {
        toasts.error('Heart Rate: Min BPM must be less than or equal to Max BPM.');
        return;
      }

      const tokens = buildHeartRateMetadataFilterTokens(data);
      upsertHeartRateMetadataTokens(targetIndex, tokens);
      shouldTriggerSearch = tokens.length > 0;
    } else if (filterType === 'metadataCountry' || filterType === 'metadataLocation' || filterType === 'metadataMusic') {
      const rawValue = String(data.value ?? '').trim();
      if (rawValue) {
        const comparator = String(data.comparator || 'fts').trim().toLowerCase();
        const shortcut = filterType === 'metadataCountry'
          ? 'location_country'
          : filterType === 'metadataMusic'
            ? 'music'
            : 'location';
        const defaultComparator = 'fts';
        const symbol = toComparatorSymbol(comparator, defaultComparator);
        const tokenValue = quoteFilterTokenValue(rawValue);
        const token = comparator === defaultComparator
          ? `${shortcut}:${tokenValue}`
          : `${shortcut}:${symbol}${tokenValue}`;

        const shortcutsToReplace = filterType === 'metadataCountry'
          ? ['country', 'location_country']
          : filterType === 'metadataMusic'
            ? ['music']
            : ['location'];

        upsertMetadataTokens(targetIndex, [token], shortcutsToReplace);
        shouldTriggerSearch = true;
      }
    } else if (filterType === 'metadata') {
      const rawValue = String(data.value ?? '').trim();
      if (rawValue) {
        const comparator = String(data.comparator || getDefaultComparatorForField(modalMetadataField)).trim().toLowerCase();
        const defaultComparator = getDefaultComparatorForField(modalMetadataField);
        const shortcut = modalMetadataShortcut || getShortcutForField(modalMetadataField);
        const symbol = toComparatorSymbol(comparator, defaultComparator);
        const token = comparator === defaultComparator
          ? `${shortcut}:${rawValue}`
          : `${shortcut}:${symbol}${rawValue}`;

        upsertMetadataTokens(targetIndex, [token], [shortcut, modalMetadataField]);
        shouldTriggerSearch = true;
      }
    }
    
    modalConfig.isOpen = false;
    modalMetadataField = '';
    modalMetadataShortcut = '';
    modalAnchorRect = null;

    if (shouldTriggerSearch) {
      setTimeout(() => dispatchSearchWithMetadata(), 0);
    }
  }
  
  function handleModalClose() {

    modalConfig.isOpen = false;
    modalMetadataField = '';
    modalMetadataShortcut = '';
    modalAnchorRect = null;
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleWindowKeydown} on:resize={refreshOpenMenuPlacement} on:scroll={refreshOpenMenuPlacement} />

<div class="space-y-1.5">
  <!-- Query cards -->
  <div
    class="relative space-y-1.5 {showSequenceChrome ? 'pl-8' : ''}"
    role="list"
    aria-label="Query steps"
    on:dragover={handleStepsListDragOver}
    on:drop={handleStepsListDrop}
  >
    {#if showSequenceChrome}
      <div class="ui-query-timeline-line pointer-events-none absolute left-[11px] top-2 bottom-2 w-px bg-cyan-400/45"></div>
    {/if}

    {#each textareas as textarea, i}
      {@const stepColor = getStepColor(i)}
      {@const isVisualQueryStep = isSimilarityStep(i)}
      {@const isStepDisabled = !textarea.enabled}
      {@const isDisabledBySimilarity = !textarea.enabled && textarea?._disabledBySimilarity === true}
      {@const translationHint = getTranslationHint(i)}
      <div
        bind:this={stepRefs[i]}
        class="group relative transition-all rounded-xl {draggedStepIndex !== null && dropStepIndex === i && draggedStepIndex !== i ? 'ring-2 ring-cyan-400/40 bg-cyan-900/10' : ''}"
        role="group"
        aria-label={`Query step ${i + 1}`}
      >
        {#if showSequenceChrome && textareas.length > 1}
          <button
            type="button"
            draggable="true"
            on:dragstart={(e) => startStepDrag(i, e)}
            on:dragend={handleStepDragEnd}
            title="Drag from left border to reorder"
            aria-label="Drag step from left border to reorder"
            class="absolute -left-8 top-0 bottom-0 w-8 rounded-lg z-20 cursor-grab active:cursor-grabbing"
          >
            <span class="sr-only">Drag step</span>
          </button>
        {/if}

        {#if showSequenceChrome && textarea.enabled}
          <div
            class="ui-query-step-index absolute -left-8 top-2 z-30 w-6 h-6 rounded-full border-2 bg-slate-950 shadow-[0_0_0_3px_rgba(2,6,23,0.7)] flex items-center justify-center"
            style={`border-color: ${withAlpha(stepColor, 0.95)}; color: ${withAlpha(stepColor, 0.95)};`}
          >
            <span class="text-[10px] font-semibold leading-none">{getEnabledStepNumber(i)}</span>
          </div>
        {/if}
        <div
          class="ui-query-step-card relative rounded-xl border transition-all overflow-visible {isStepDisabled ? 'ui-query-step-card--disabled' : ''} {isDisabledBySimilarity
            ? 'bg-slate-950/80 border-amber-600/60 ring-1 ring-amber-500/35'
            : textarea.enabled
              ? 'bg-slate-800/75 border-slate-600/55 shadow-[0_10px_30px_rgba(2,6,23,0.45)]'
              : 'bg-slate-900/50 border-slate-700/70 opacity-95'} {imageDropIndex === i ? 'ring-2 ring-cyan-400/50 bg-cyan-900/10' : ''}"
          style={`box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(2,6,23,0.45), inset 2px 0 0 ${isDisabledBySimilarity ? 'rgba(245, 158, 11, 0.85)' : isVisualQueryStep ? 'rgba(251, 191, 36, 0.7)' : withAlpha(stepColor, textarea.enabled ? 0.85 : 0.35)};`}
          role="group"
          aria-label={`Drop frame on step ${i + 1}`}
          on:dragover={(e) => handleTextareaDragOver(i, e)}
          on:drop={(e) => handleTextareaDrop(i, e)}
          on:dragleave={(e) => handleTextareaDragLeave(i, e)}
        >
          <div
            class="flex items-center justify-between gap-1.5 px-1.5 py-1 border-b border-slate-700/45 {showSequenceChrome && textareas.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}"
            draggable={showSequenceChrome && textareas.length > 1}
            on:dragstart={(e) => startStepDrag(i, e)}
            on:dragend={handleStepDragEnd}
            role="group"
            aria-label={`Step ${i + 1} header drag area`}
            title={showSequenceChrome && textareas.length > 1 ? 'Drag this header to reorder step' : undefined}
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="text-[10px] font-semibold uppercase tracking-[0.16em]" style={`color: ${textarea.enabled ? withAlpha(stepColor, 0.92) : 'rgb(148, 163, 184)'};`}>
                {getStepContextLabel(i)}
              </div>
              {#if translationHint}
                <div class="relative translation-hint-popover">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-emerald-500/45 bg-emerald-900/25 text-[9px] font-semibold text-emerald-200 hover:bg-emerald-800/40 transition-colors"
                    title="Show original and translated query"
                    aria-label="Show translation details"
                    aria-expanded={openTranslationHintIndex === i}
                    on:click|stopPropagation={() => toggleTranslationHint(i)}
                  >
                    <img
                      src="/icons/translate.svg"
                      alt=""
                      aria-hidden="true"
                      class="w-3.5 h-3.5 object-contain"
                      loading="lazy"
                    />
                  </button>

                  {#if openTranslationHintIndex === i}
                    <div class="absolute left-0 top-full mt-1 w-72 max-w-[75vw] rounded-lg border border-emerald-500/40 bg-slate-900/95 shadow-xl z-50 p-2">
                      <div class="text-[9px] uppercase tracking-[0.14em] text-emerald-300/80 mb-1">Auto Translation</div>
                      <div class="mb-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-slate-500/60 bg-slate-800/80 text-[9px] text-slate-200 hover:bg-slate-700/80 transition-colors"
                          on:click|stopPropagation={() => applyTranslationVariant(i, 'original')}
                        >
                          Use Original
                        </button>
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-emerald-600/70 bg-emerald-900/30 text-[9px] text-emerald-100 hover:bg-emerald-800/40 transition-colors"
                          on:click|stopPropagation={() => applyTranslationVariant(i, 'english')}
                        >
                          Use English
                        </button>
                      </div>
                      <div class="text-[10px] text-slate-300 mb-1">
                        <span class="text-slate-400">Original:</span>
                        <span class="ml-1 break-words">{translationHint.from}</span>
                      </div>
                      <div class="text-[10px] text-emerald-100">
                        <span class="text-emerald-300/80">English:</span>
                        <span class="ml-1 break-words">{translationHint.to}</span>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if isVisualQueryStep}
                <span class="ui-query-step-header-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-amber-500/40 bg-amber-900/20 text-[9px] font-medium text-amber-300/90" title="Image set by Similarity — next click replaces it">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Similarity
                </span>
              {/if}
              {#if isDisabledBySimilarity}
                <span class="px-1.5 py-0.5 rounded-md border border-amber-600/60 bg-amber-900/30 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                  Disabled by similarity
                </span>
              {/if}
            </div>

            <div class="flex items-center gap-1">
              {#if showSequenceChrome && i > 0}
                <button
                  type="button"
                  on:click|stopPropagation={() => swapQueries(i, i - 1)}
                  title="Move up"
                  aria-label="Move step up"
                  class="inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/45 transition-colors"
                >
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 19V5"/>
                    <path d="M5 12l7-7 7 7"/>
                  </svg>
                </button>
              {/if}

              {#if showSequenceChrome && i < textareas.length - 1}
                <button
                  type="button"
                  on:click|stopPropagation={() => swapQueries(i, i + 1)}
                  title="Move down"
                  aria-label="Move step down"
                  class="inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/45 transition-colors"
                >
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 5v14"/>
                    <path d="M19 12l-7 7-7-7"/>
                  </svg>
                </button>
              {/if}

              <button
                type="button"
                on:click={() => toggle(i)}
                title={textarea.enabled ? 'Skip this step' : 'Enable this step'}
                aria-label={textarea.enabled ? 'Skip this step' : 'Enable this step'}
                class="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                style={`background-color: ${textarea.enabled ? withAlpha(stepColor, 0.9) : 'rgb(75, 85, 99)'};`}
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                         {textarea.enabled ? 'translate-x-3' : 'translate-x-0.5'}"
                ></span>
              </button>

              {#if textareas.length > 1}
                <div class="relative step-actions-menu">
                  <button
                    type="button"
                    on:click|stopPropagation={() => toggleStepActions(i)}
                    title="Delete step"
                    aria-label="Delete step"
                    aria-haspopup="menu"
                    aria-expanded={openStepActionsIndex === i}
                    class="ui-step-delete-btn inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-500/45 bg-slate-700/75 text-slate-200 hover:text-red-100 hover:bg-red-900/45 hover:border-red-700/60 transition-colors"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/>
                      <path d="M19 6l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    </svg>
                  </button>

                  {#if openStepActionsIndex === i}
                    <div class="absolute right-0 mt-1 w-36 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50 p-1" role="menu">
                      <button
                        type="button"
                        on:click|stopPropagation={() => removeStepFromMenu(i)}
                        class="w-full text-left px-2.5 py-2 rounded-md text-xs text-red-200 hover:text-red-100 hover:bg-red-900/35 transition-colors"
                        role="menuitem"
                      >
                        Delete step
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <div class="relative">
            {#if textareaImages[i]?.length > 0}
              {#if isVisualQueryStep}
                {@const similarityImage = getPrimarySimilarityImage(i)}
                {@const similarityImageIndex = getPrimarySimilarityImageIndex(i)}
                {#if similarityImage}
                  <div class="px-1.5 py-0.5 border-b border-slate-700/45">
                    <div class="flex flex-wrap items-start gap-2">
                      <div class="ui-query-image-shell relative group/img w-28 rounded-md overflow-hidden bg-slate-900/70 border border-slate-700/70">
                        <img
                          src={similarityImage.url}
                          alt={similarityImage.name}
                          class="ui-query-image-thumb w-full max-h-20 object-contain bg-slate-950/50"
                        />
                        <button
                          type="button"
                          on:click={() => similarityImageIndex >= 0 && removePrimarySimilarityImage(i, similarityImageIndex)}
                          aria-label="Remove image"
                          class="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-700/45 bg-red-900/75 text-red-100 hover:bg-red-800 transition-colors"
                          title="Remove image"
                        >
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>

                        <div class="px-1.5 py-1 bg-slate-950/70 border-t border-slate-700/60">
                          <div class="truncate text-[9px] text-slate-300">{similarityImage.name}</div>
                          <div class="text-[8px] text-amber-400/70">similarity</div>
                        </div>
                      </div>

                      {#if modelSelectionPerStepEnabled && textarea.enabled && imageModelOptions.length > 0}
                        <div class="w-[9.5rem] shrink-0 pt-0.5">
                          <div class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">IMG</div>
                          <select
                            class="w-full text-[9px] font-mono bg-slate-900/80 border border-slate-600/50 rounded px-1 py-0.5 text-slate-300 hover:border-slate-500 focus:border-blue-500 focus:outline-none cursor-pointer"
                            value={getImageModelValueForStep(textarea)}
                            title="Image embedding model for this similarity step"
                            on:change={(e) => {
                              const target = /** @type {HTMLSelectElement} */ (e.currentTarget);
                              handleModelSelectionChange(i, target.value, 'image');
                            }}
                          >
                            {#each imageModelOptions as m}
                              <option value={m}>{m}</option>
                            {/each}
                          </select>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              {:else}
                <div class="px-1.5 py-0.5 border-b border-slate-700/45">
                  <div class="flex flex-wrap items-start gap-2">
                    {#each textareaImages[i] as image, imgIdx}
                      <div class="ui-query-image-shell relative group/img w-28 rounded-md overflow-hidden bg-slate-900/70 border border-slate-700/70">
                        <img
                          src={image.url}
                          alt={image.name}
                          class="ui-query-image-thumb w-full max-h-20 object-contain bg-slate-950/50"
                        />
                        {#if image.type === 'result'}
                          <div class="absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] font-semibold bg-emerald-600/90 text-white leading-none">
                            RESULT
                          </div>
                        {/if}
                        <button
                          type="button"
                          on:click={() => removeImageFromTextarea(i, imgIdx)}
                          aria-label="Remove image"
                          class="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-700/45 bg-red-900/75 text-red-100 hover:bg-red-800 transition-colors"
                          title="Remove image"
                        >
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>

                        <div class="px-1.5 py-1 bg-slate-950/70 border-t border-slate-700/60">
                          <div class="truncate text-[9px] text-slate-300">{image.name}</div>
                          <div class="text-[8px] text-slate-500">{image.type === 'result' ? 'img' : image.type} · attached manually</div>
                        </div>
                      </div>
                    {/each}

                    {#if modelSelectionPerStepEnabled && textarea.enabled && !isVisualQueryStep && hasImageQueryForStep(i) && imageModelOptions.length > 0}
                      <div class="w-[9.5rem] shrink-0 pt-0.5">
                        <div class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">IMG</div>
                        <select
                          class="w-full text-[9px] font-mono bg-slate-900/80 border border-slate-600/50 rounded px-1 py-0.5 text-slate-300 hover:border-slate-500 focus:border-blue-500 focus:outline-none cursor-pointer"
                          value={getImageModelValueForStep(textarea)}
                          title="Image embedding model for this query"
                          on:change={(e) => {
                            const target = /** @type {HTMLSelectElement} */ (e.currentTarget);
                            handleModelSelectionChange(i, target.value, 'image');
                          }}
                        >
                          {#each imageModelOptions as m}
                            <option value={m}>{m}</option>
                          {/each}
                        </select>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            {/if}

            {#if !isVisualQueryStep || shouldShowSimilarityTextConstraint(i)}
              <div class="relative">
                <textarea
                  bind:this={textareaRefs[i]}
                  use:autoResizeAction={textarea.value}
                  class="ui-query-textarea w-full p-1.5 pr-6 pb-1.5 resize-none transition-all duration-200 font-sans text-sm bg-transparent border-0
                         {textarea.enabled ? 'text-slate-100 placeholder-slate-400' : 'text-slate-300 placeholder-slate-500 cursor-not-allowed'}"
                  rows="1"
                  bind:value={textarea.value}
                  placeholder={getStepPlaceholder(i)}
                  disabled={!textarea.enabled}
                  autocomplete="off"
                  spellcheck="false"
                  style="overflow-y: hidden;"
                  on:input={(e) => handleTextareaInput(i, e)}
                  on:keydown={(e) => handleKeyDown(e, i)}
                ></textarea>

                {#if textarea.enabled && hasTextareaTextContent(i)}
                  <button
                    type="button"
                    on:click={() => clearTextareaValue(i)}
                    class="ui-textarea-clear-btn absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-slate-700/85 hover:bg-slate-600 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
                    title="Clear query"
                    aria-label="Clear textarea query"
                  >
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
</button>
                {/if}

              </div>
            {/if}
          </div>

          {#if getMetadataChipsForIndex(i).length > 0}
            <div class="px-1.5 pb-1 pt-0.5 flex flex-wrap items-center gap-1.5 border-t border-slate-800/60">
              {#each getMetadataChipsForIndex(i) as chip}
                <span class="ui-metadata-chip inline-flex items-center gap-1 rounded-full border border-cyan-600/40 bg-cyan-900/25 px-1 py-0.5 text-[10px] text-cyan-100">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-cyan-700/35 transition-colors"
                    title={`Edit ${chip.label}`}
                    aria-label={`Edit ${chip.label}`}
                    on:click|stopPropagation={() => editMetadataChip(i, chip)}
                  >
                    <span class="font-semibold">{chip.label}</span>
                    <span class="text-cyan-200/90">{chip.value}</span>
                  </button>
                  <button
                    type="button"
                    class="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-cyan-200 hover:bg-cyan-700/40 hover:text-white transition-colors"
                    title={`Remove ${chip.label}`}
                    aria-label={`Remove ${chip.label}`}
                    on:click|stopPropagation={() => removeMetadataTokenFromTextarea(i, chip.token)}
                  >
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              {/each}
            </div>
          {/if}

          <!-- Footer toolbar -->
          <div class="flex items-center justify-between px-1.5 py-0.5">
            <div class="menu-container z-40">
              <div class="relative flex items-center gap-1">
                <button
                  bind:this={menuTriggerRefs[i]}
                  type="button"
                  on:click|stopPropagation={() => toggleMenu(i)}
                  title="Add attachment or filter"
                  aria-label="Add attachment or filter"
                    class="ui-query-plus-btn w-6 h-6 rounded-full border border-slate-500/45 bg-slate-900/80 text-slate-200
                      inline-flex items-center justify-center shadow-sm transition-all
                      hover:bg-slate-800 hover:border-slate-400/70 hover:text-white
                      {openMenuIndex === i ? 'bg-slate-800 border-slate-300/70 text-white' : ''}"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>

                <!-- Dropdown menu -->
                {#if openMenuIndex === i}
                  <div
                    bind:this={menuPanelRefs[i]}
                    class="absolute left-0 w-56 max-h-[calc(100vh-6rem)] overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 animate-slide-up {menuPlacementByIndex[i] === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}"
                  >
                    <div class="px-3 py-2 bg-gray-900/50 border-b border-gray-700">
                      <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Add to Query</span>
                    </div>

                    <div class="py-1">
                      {#if isVisualQueryStep && !shouldShowSimilarityTextConstraint(i)}
                        <button
                          type="button"
                          on:click|stopPropagation={() => enableSimilarityTextConstraint(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M4 7h16M4 12h12M4 17h8"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Add Text Filter</div>
                            <div class="text-[10px] text-gray-400">Show optional text with similarity image</div>
                          </div>
                        </button>

                        <div class="my-1 h-px bg-gray-700"></div>
                      {/if}

                      {#if openImageSubmenuIndex === i}
                        <button
                          type="button"
                          on:click|stopPropagation={closeImageSubmenu}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M15 18l-6-6 6-6"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Back</div>
                            <div class="text-[10px] text-gray-400">Return to add menu</div>
                          </div>
                        </button>

                        <div class="px-3 py-1">
                          <span class="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">Image Inputs</span>
                        </div>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openImagePicker(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                          disabled={availableImages.length === 0}
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                              <path d="M9 12l2 2 4-4"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Pick from Results</div>
                            <div class="text-[10px] text-gray-400">
                              {availableImages.length > 0
                                ? `Click to select from ${availableImages.length} results`
                                : 'No results available'}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          on:click|stopPropagation={() => handleImageFromFile(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <path d="M21 15l-5-5L5 21"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Image from File</div>
                            <div class="text-[10px] text-gray-400">Upload from computer</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openUrlModal(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Image from URL</div>
                            <div class="text-[10px] text-gray-400">Paste image link</div>
                          </div>
                        </button>
                      {:else}
                        <button
                          type="button"
                          on:click|stopPropagation={() => openDateRangeFilterModal(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <img src="/icons/data_range.svg" alt="" class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Date Range</div>
                            <div class="text-[10px] text-gray-400 font-mono">From / To interval</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openDateHourMetadataFilterModal(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <img src="/icons/date_hour.svg" alt="" class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Date/Hour</div>
                            <div class="text-[10px] text-gray-400 font-mono">year/month/day/hour AND</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openCountryMetadataFilterModal(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <img src="/icons/country.svg" alt="" class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Country</div>
                            <div class="text-[10px] text-gray-400 font-mono">location_country:...</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openLocationMetadataFilterModal(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                              <circle cx="12" cy="9" r="2.5"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Location</div>
                            <div class="text-[10px] text-gray-400 font-mono">location:...</div>
                          </div>
                        </button>

                        {#if hasMusicFilterSupport}
                          <button
                            type="button"
                            on:click|stopPropagation={() => openMusicMetadataFilterModal(i)}
                            class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                          >
                            <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                              <svg class="w-4 h-4 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18V5l12-2v13"/>
                                <circle cx="6" cy="18" r="3"/>
                                <circle cx="18" cy="16" r="3"/>
                              </svg>
                            </div>
                            <div class="flex-1">
                              <div class="text-xs font-medium text-white">Music</div>
                              <div class="text-[10px] text-gray-400 font-mono">music:...</div>
                            </div>
                          </button>
                        {/if}

                        {#if hasHeartRateFilterSupport}
                          <button
                            type="button"
                            on:click|stopPropagation={() => openHeartRateMetadataFilterModal(i)}
                            class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                          >
                            <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                              <svg class="w-4 h-4 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
                                <path d="M3 12h4l2-4 3 8 2-4h7"/>
                              </svg>
                            </div>
                            <div class="flex-1">
                              <div class="text-xs font-medium text-white">Heart Rate</div>
                              <div class="text-[10px] text-gray-400">Filter by BPM range</div>
                            </div>
                          </button>
                        {/if}

                        {#if displayMetadataFilterFields.length > 0}
                          <div class="my-1 h-px bg-gray-700"></div>
                        {/if}

                        {#each displayMetadataFilterFields as field}
                          {@const shortcut = getShortcutForField(field)}
                          <button
                            type="button"
                            on:click|stopPropagation={() => openMetadataFilterModal(i, field)}
                            class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                          >
                            <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                              <svg class="w-4 h-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 7h16M4 12h16M4 17h16"/>
                              </svg>
                            </div>
                            <div class="flex-1">
                              <div class="text-xs font-medium text-white">{field}</div>
                              <div class="text-[10px] text-gray-400 font-mono">{shortcut}:...</div>
                            </div>
                          </button>
                        {/each}

                        <div class="my-1 h-px bg-gray-700"></div>

                        <button
                          type="button"
                          on:click|stopPropagation={() => openImageSubmenu(i)}
                          class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                        >
                          <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                            <svg class="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <path d="M21 15l-5-5L5 21"/>
                            </svg>
                          </div>
                          <div class="flex-1">
                            <div class="text-xs font-medium text-white">Image Inputs</div>
                            <div class="text-[10px] text-gray-400">Open image upload/select actions</div>
                          </div>
                          <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 6l6 6-6 6"/>
                          </svg>
                        </button>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            {#if textarea.enabled}
              <div class="ml-2 flex items-center gap-1">
                {#if modelSelectionPerStepEnabled && textModelOptions.length > 0}
                  <span class="text-[9px] font-semibold uppercase tracking-wide text-slate-400">TXT</span>
                  <select
                    class="text-[9px] font-mono bg-slate-900/80 border border-slate-600/50 rounded px-1 py-0.5 text-slate-300 hover:border-slate-500 focus:border-blue-500 focus:outline-none cursor-pointer min-w-[9rem] max-w-[13.5rem] truncate"
                    value={getTextModelValueForStep(textarea)}
                    title="Text embedding model for this query"
                    on:change={(e) => {
                      const target = /** @type {HTMLSelectElement} */ (e.currentTarget);
                      handleModelSelectionChange(i, target.value, 'text');
                    }}
                  >
                    {#each textModelOptions as m}
                      <option value={m}>{m}</option>
                    {/each}
                  </select>

                {/if}
              </div>
            {/if}
          </div>
        </div>

      </div>
    {/each}
  </div>

  <!-- Add button -->
  <div class={showSequenceChrome ? "pl-8" : ""}>
    <button
      on:click={() => add(textareas.length - 1)}
      class="w-full py-2.5 border-2 border-dashed border-gray-700 hover:border-blue-600/50 rounded-lg text-xs text-gray-400 hover:text-blue-400 transition-all flex items-center justify-center space-x-2"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Describe Next Scene</span>
    </button>
  </div>

  <InputModal
  isOpen={modalConfig.isOpen}
  title={modalConfig.title}
  icon={modalConfig.icon}
  description={modalConfig.description}
  fields={modalConfig.fields}
  submitLabel={modalConfig.filterType.startsWith('metadata') ? 'Apply' : 'Submit'}
  submitOnEnter={modalConfig.filterType.startsWith('metadata')}
  autoFocusFirstTextInput={modalConfig.filterType.startsWith('metadata')}
  presentation={modalConfig.filterType.startsWith('metadata') ? 'dropdown' : 'modal'}
  anchorRect={modalAnchorRect as any}
  on:submit={handleModalSubmit}
  on:close={handleModalClose}
/>
</div>

<style>
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-up {
    animation: slide-up 0.2s ease-out;
  }

  .ui-query-step-card--disabled {
    position: relative;
    filter: grayscale(0.35) saturate(0.38) brightness(0.78);
  }

  .ui-query-step-card--disabled::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 0.75rem;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.46));
    pointer-events: none;
    z-index: 0;
  }

  .ui-query-step-card--disabled > * {
    position: relative;
    z-index: 1;
  }

  .ui-query-step-card--disabled textarea,
  .ui-query-step-card--disabled select,
  .ui-query-step-card--disabled button,
  .ui-query-step-card--disabled .ui-query-plus-btn {
    opacity: 0.78;
  }

  .ui-query-step-card--disabled .ui-query-step-header-badge {
    border-color: rgba(100, 116, 139, 0.55);
    background: rgba(51, 65, 85, 0.62);
    color: rgba(203, 213, 225, 0.92);
  }

  .ui-query-step-card--disabled .ui-query-textarea {
    color: rgba(148, 163, 184, 0.95) !important;
  }

  .ui-query-step-card--disabled .ui-query-textarea::placeholder {
    color: rgba(100, 116, 139, 0.85) !important;
  }

  .ui-query-step-card--disabled .ui-query-image-shell {
    border-color: rgba(100, 116, 139, 0.45);
    background: rgba(15, 23, 42, 0.8);
  }

  .ui-query-step-card--disabled .ui-query-image-thumb {
    filter: grayscale(1) saturate(0.2) brightness(0.58);
    opacity: 0.68;
  }

  .ui-query-step-card--disabled .ui-metadata-chip {
    border-color: rgba(100, 116, 139, 0.5);
    background: rgba(30, 41, 59, 0.8);
    color: rgba(148, 163, 184, 0.95);
  }

  .ui-query-step-card--disabled .ui-metadata-chip button {
    color: rgba(203, 213, 225, 0.9);
  }

  .ui-query-step-card--disabled .ui-metadata-chip button:hover {
    background: rgba(71, 85, 105, 0.45);
    color: rgba(248, 250, 252, 0.95);
  }
</style>
