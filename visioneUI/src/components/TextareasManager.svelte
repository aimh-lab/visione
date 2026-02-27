<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import InputModal from "./InputModal.svelte";
  import { toasts } from "../stores/toastStore.js";

  type QueryTextarea = {
    value: string;
    enabled: boolean;
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

  type ModalOption = { value: string; label: string };
  type ModalField = {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    value?: string;
    hint?: string;
    required?: boolean;
    rows?: number;
    options?: ModalOption[];
  };

  type ModalConfig = {
    isOpen: boolean;
    title: string;
    icon: string;
    fields: ModalField[];
    description: string;
    targetIndex: number | null;
    filterType: "date" | "imageUrl" | "type" | "";
  };

  type ModalSubmitData = {
    from?: string;
    to?: string;
    url?: string;
    name?: string;
    type?: string;
  };

  type DispatchEvents = {
    add: { index: number };
    remove: { index: number };
    toggle: { index: number };
    update: { index: number; value: string };
    search: void;
    swap: { indexA: number; indexB: number; mode?: "swap" | "move" };
    startImageSelection: { textareaIndex: number };
    imageSelected: void;
    updateImages: { index: number; images: AttachedImage[] };
  };

  export let textareas: QueryTextarea[] = [];
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

  const MIN_TEXTAREA_ROWS = 1;
  const MAX_TEXTAREA_ROWS = 5;
  const TIMELINE_STOPS = ["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"];

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

  function mixHex(colorA: string, colorB: string, t: number) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    const clampT = Math.max(0, Math.min(1, t));

    const r = Math.round(a.r + (b.r - a.r) * clampT);
    const g = Math.round(a.g + (b.g - a.g) * clampT);
    const bVal = Math.round(a.b + (b.b - a.b) * clampT);

    return `rgb(${r}, ${g}, ${bVal})`;
  }

  function getStepColor(index: number) {
    if (textareas.length <= 1) return "rgb(59, 130, 246)";

    const maxPos = TIMELINE_STOPS.length - 1;
    const progress = (index / (textareas.length - 1)) * maxPos;
    const left = Math.floor(progress);
    const right = Math.min(maxPos, left + 1);
    const localT = progress - left;

    return mixHex(TIMELINE_STOPS[left], TIMELINE_STOPS[right], localT);
  }

  function withAlpha(color: string, alpha: number) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (!match) return color;
    const [, r, g, b] = match;
    const clamped = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
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
  const remove = (i: number) => dispatch("remove", { index: i });
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
      dispatch("swap", { indexA: sourceIndex, indexB: targetIndex, mode: "move" });
      setTimeout(() => dispatch("search"), 100);
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
      setTimeout(() => dispatch("search"), 0);
    }
  };
  const update = (i: number, value: string) => dispatch("update", { index: i, value });
  
  function swapQueries(indexA: number, indexB: number) {
    if (indexB < 0 || indexB >= textareas.length) return;

    dispatch("swap", { indexA, indexB, mode: "swap" });
    setTimeout(() => dispatch("search"), 100);
  }


  const handleKeyDown = (e: KeyboardEvent, textareaIndex: number) => {
    if (e.key === "Enter" && !e.shiftKey && textareas[textareaIndex]?.enabled) {
      e.preventDefault();
      dispatch("search");
    }
  };

  const handleTextareaInput = (index: number, e: Event) => {
    const value = (e.currentTarget as HTMLTextAreaElement | null)?.value ?? "";
    update(index, value);
  };

  function clearTextareaValue(index: number) {
    update(index, "");
  }

  // ✅ Gestione menu dropdown
  let openMenuIndex: number | null = null;
  let menuTriggerRefs: Array<HTMLButtonElement | null> = [];
  let menuPlacementByIndex: Record<number, "top" | "bottom"> = {};
  let fileInput: HTMLInputElement | null = null;

  async function toggleMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index;

    if (openMenuIndex === index) {
      await tick();
      updateMenuPlacement(index);
    }
  }

  function closeMenu() {
    openMenuIndex = null;
  }

  function updateMenuPlacement(index: number) {
    const trigger = menuTriggerRefs[index];
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedMenuHeight = 270;

    menuPlacementByIndex[index] =
      spaceAbove >= estimatedMenuHeight || spaceAbove >= spaceBelow ? "top" : "bottom";
  }

  // ✅ NUOVO: Gestione immagini

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
    // ✅ Dispatch evento per attivare modalità selezione
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


  // ✅ MODIFICATO: addImageToTextarea ora accetta imgId opzionale
  function addImageToTextarea(index: number, url: string, name: string, type: AttachedImage["type"], imgId: string | null = null) {
    if (!textareaImages[index]) {
      textareaImages[index] = [];
    }
    textareaImages[index] = [...textareaImages[index], { url, name, type, imgId }];
    
    // ✅ Notifica il padre del cambiamento
    dispatch('updateImages', { index, images: textareaImages[index] });
  }

  function removeImageFromTextarea(textareaIndex: number, imageIndex: number) {
    textareaImages[textareaIndex] = textareaImages[textareaIndex].filter((_, i) => i !== imageIndex);

    
    // ✅ Notifica il padre
    dispatch('updateImages', { index: textareaIndex, images: textareaImages[textareaIndex] });
  }

  // Click outside per chiudere menu
  function handleClickOutside(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (openMenuIndex !== null && !target.closest('.menu-container')) {
      closeMenu();
    }
    if (openStepActionsIndex !== null && !target.closest('.step-actions-menu')) {
      closeStepActions();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    closeMenu();
    closeStepActions();
  }

  function openDateFilterModal(index: number) {

    modalConfig = {
      isOpen: true,
      title: 'Add Date Filter',
      icon: 'calendar',
      description: 'Filter by capture date range',
      targetIndex: index,
      filterType: 'date',
      fields: [
        {
          name: 'from',
          label: 'From Date',
          type: 'date',
          placeholder: 'YYYY-MM-DD',
          value: '',
          hint: 'Leave empty for no start limit'
        },
        {
          name: 'to',
          label: 'To Date',
          type: 'date',
          placeholder: 'YYYY-MM-DD',
          value: '',
          hint: 'Leave empty for no end limit'
        }
      ]
    };

    closeMenu();
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
          placeholder: 'https://example.com/image.jpg',
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
  
  function openTypeFilterModal(index: number) {
    modalConfig = {
      isOpen: true,
      title: 'Add Type Filter',
      icon: 'filter',
      description: 'Filter by content type',
      targetIndex: index,
      filterType: 'type',
      fields: [
        {
          name: 'type',
          label: 'Content Type',
          type: 'select',
          value: 'video',
          options: [
            { value: 'video', label: 'Video' },
            { value: 'image', label: 'Image' },
            { value: 'audio', label: 'Audio' },
            { value: 'document', label: 'Document' }
          ]
        }
      ]
    };
    closeMenu();
  }
  
  function handleModalSubmit(event: CustomEvent<ModalSubmitData>) {

    const data = event.detail;
    const { targetIndex, filterType } = modalConfig;
    if (targetIndex === null) {
      modalConfig.isOpen = false;
      return;
    }
    
    if (filterType === 'date') {
      let dateFilter = 'date:';
      if (data.from && data.to) {
        dateFilter += `${data.from}..${data.to}`;
      } else if (data.from) {
        dateFilter += `>${data.from}`;
      } else if (data.to) {
        dateFilter += `<${data.to}`;
      } else {
        dateFilter = ''; // No dates entered
      }
      
      if (dateFilter) {
        const currentValue = textareas[targetIndex].value || '';
        update(targetIndex, currentValue + ' ' + dateFilter);
      }
    } else if (filterType === 'imageUrl') {
      if (data.url) {
        addImageToTextarea(
          targetIndex,
          data.url,
          data.name || 'Image from URL',
          'url'
        );
      }
    } else if (filterType === 'type') {
      const currentValue = textareas[targetIndex].value || '';
      update(targetIndex, currentValue + ' type:' + (data.type ?? ''));
    }
    
    modalConfig.isOpen = false;
  }
  
  function handleModalClose() {

    modalConfig.isOpen = false;
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleWindowKeydown} />

<div class="space-y-4">
  <!-- Query cards -->
  <div
    class="relative space-y-4 pl-8"
    role="list"
    aria-label="Query steps"
    on:dragover={handleStepsListDragOver}
    on:drop={handleStepsListDrop}
  >
    <div class="ui-query-timeline-line pointer-events-none absolute left-[11px] top-2 bottom-2 w-px bg-cyan-400/45"></div>

    {#each textareas as textarea, i}
      {@const stepColor = getStepColor(i)}
      <div
        bind:this={stepRefs[i]}
        class="group relative transition-all rounded-xl {draggedStepIndex !== null && dropStepIndex === i && draggedStepIndex !== i ? 'ring-2 ring-cyan-400/40 bg-cyan-900/10' : ''}"
        role="group"
        aria-label={`Query step ${i + 1}`}
      >
        {#if textareas.length > 1}
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

        <div
          class="ui-query-step-index absolute -left-8 top-2 z-30 w-6 h-6 rounded-full border-2 bg-slate-950 shadow-[0_0_0_3px_rgba(2,6,23,0.7)] flex items-center justify-center"
          style={`border-color: ${withAlpha(stepColor, 0.95)}; color: ${withAlpha(stepColor, 0.95)};`}
        >
          <span class="text-[10px] font-semibold leading-none">{i + 1}</span>
        </div>
        <div
          class="ui-query-step-card relative rounded-xl border transition-all overflow-visible {textarea.enabled ? 'bg-slate-800/75 border-slate-600/55 shadow-[0_10px_30px_rgba(2,6,23,0.45)]' : 'bg-slate-900/50 border-slate-700/55 opacity-65'} {imageDropIndex === i ? 'ring-2 ring-cyan-400/50 bg-cyan-900/10' : ''}"
          style={`box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(2,6,23,0.45), inset 2px 0 0 ${withAlpha(stepColor, textarea.enabled ? 0.85 : 0.35)};`}
          role="group"
          aria-label={`Drop frame on step ${i + 1}`}
          on:dragover={(e) => handleTextareaDragOver(i, e)}
          on:drop={(e) => handleTextareaDrop(i, e)}
          on:dragleave={(e) => handleTextareaDragLeave(i, e)}
        >
          <div
            class="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1.5 border-b border-slate-700/45 {textareas.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}"
            draggable={textareas.length > 1}
            on:dragstart={(e) => startStepDrag(i, e)}
            on:dragend={handleStepDragEnd}
            role="group"
            aria-label={`Step ${i + 1} header drag area`}
            title={textareas.length > 1 ? 'Drag this header to reorder step' : undefined}
          >
            <div class="text-[10px] font-semibold uppercase tracking-[0.16em]" style={`color: ${textarea.enabled ? withAlpha(stepColor, 0.92) : 'rgb(107, 114, 128)'};`}>
              {textareas.length > 1 ? (i === 0 ? 'First' : i === textareas.length - 1 ? 'Finally' : 'Then') : ''}
            </div>

            <div class="flex items-center gap-1">
              {#if i > 0}
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

              {#if i < textareas.length - 1}
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
              <div class="px-2.5 pt-1.5 pb-1.5 flex flex-wrap gap-2 border-b border-slate-700/45">
                {#each textareaImages[i] as image, imgIdx}
                  <div class="relative group/img w-28 rounded-md overflow-hidden bg-slate-900/70 border border-slate-700/70">
                    <img
                      src={image.url}
                      alt={image.name}
                      class="w-full h-14 object-cover"
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
                      class="absolute top-1 right-1 inline-flex items-center justify-center w-4.5 h-4.5 rounded-full border border-red-700/45 bg-red-900/75 text-red-100 hover:bg-red-800 transition-colors"
                      title="Remove image"
                    >
                      <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>

                    <div class="px-1.5 py-1 bg-slate-950/70 border-t border-slate-700/60">
                      <div class="truncate text-[9px] text-slate-300">{image.name}</div>
                      <div class="text-[8px] text-slate-500">{image.type === 'result' ? 'img' : image.type} · 1 attached</div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <textarea
              bind:this={textareaRefs[i]}
              use:autoResizeAction={textarea.value}
              class="ui-query-textarea w-full p-2.5 pr-8 pb-7 resize-none transition-all duration-200 font-sans text-sm bg-transparent border-0
                     {textarea.enabled ? 'text-slate-100 placeholder-slate-400' : 'text-slate-500 placeholder-slate-600 cursor-not-allowed line-through'}"
              rows="1"
              bind:value={textarea.value}
              placeholder={textarea.enabled
                ? `Describe ${i === 0 ? 'what happens in the scene' : 'a scene appearing after the previous one'}`
                : 'This step is skipped'}
              disabled={!textarea.enabled}
              style="overflow-y: hidden;"
              on:input={(e) => handleTextareaInput(i, e)}
              on:keydown={(e) => handleKeyDown(e, i)}
            ></textarea>

            {#if textarea.enabled && textarea.value?.trim()}
              <button
                type="button"
                on:click={() => clearTextareaValue(i)}
                class="ui-textarea-clear-btn absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-slate-700/85 hover:bg-slate-600 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
                title="Clear text"
                aria-label="Clear textarea text"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            {/if}
          </div>

            <!-- Menu dropdown button -->
            <div class="absolute bottom-2 left-2 flex items-center justify-between menu-container z-40">
              <div class="relative">
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
                  <div class="absolute left-0 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-slide-up {menuPlacementByIndex[i] === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}">
                    <div class="px-3 py-2 bg-gray-900/50 border-b border-gray-700">
                      <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Add to Query</span>
                    </div>

                    <div class="py-1">
                      <!-- ✅ Image from Results -->
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

                      <div class="my-1 h-px bg-gray-700"></div>

                      <!-- Image from file -->
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

                      <!-- Image from URL -->
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

                      <div class="my-1 h-px bg-gray-700"></div>


            <!-- Date filter -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openDateFilterModal(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                          <svg class="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Add Date Filter</div>
                          <div class="text-[10px] text-gray-400 font-mono">date:YYYY-MM-DD</div>
                        </div>
                      </button>

                      <!-- Type filter -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openTypeFilterModal(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-slate-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-gray-700/40 flex items-center justify-center group-hover:bg-gray-600/50 transition-colors">
                          <svg class="w-4 h-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Add Type Filter</div>
                          <div class="text-[10px] text-gray-400 font-mono">type:format</div>
                        </div>
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="absolute bottom-2.5 right-0 flex items-center justify-between px-2">
              <span class="text-[9px] font-medium text-slate-500">
                {textarea.value?.length || 0} chars
                {#if textareaImages[i]?.length > 0}
                  · {textareaImages[i].length} img
                {/if}
              </span>
            </div>
        </div>

      </div>
    {/each}
  </div>

  <!-- Add button -->
  <div class="pl-8">
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
</style>
