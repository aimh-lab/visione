// src/utils/ui.ts
type ImgLike = {
  index?: number;
  idx?: number;
  title?: string;
  videoId?: string | number;
  imgId?: string | number;
  url?: string;
  submitted?: boolean;
  raw?: unknown;
};

export function indexOfImgId(
  list: Array<{ imgId?: string | number } | null | undefined>,
  imgId: string | number
): number {
  return Array.isArray(list) ? list.findIndex(i => i?.imgId === imgId) : -1;
}

export function ensureImgObj(imgId: string | number, fallback: ImgLike | null | undefined): ImgLike | null {
  if (!fallback) return null;
  return {
    index: fallback.idx ?? -1,
    title: String(fallback.title ?? fallback.imgId ?? ""),
    videoId: fallback.videoId ?? String(fallback.imgId).split("-")[0],
    imgId: fallback.imgId,
    url: fallback.url,
    submitted: !!fallback.submitted,
    raw: fallback.raw ?? null
  };
}

export function scrollToImage(container: Element | null | undefined, target: number | string): void {
  if (!container) return;
  let el: HTMLElement | null = null;
  if (typeof target === "number") {
    el = container.querySelector<HTMLElement>(`[data-index="${target}"]`);
  } else if (typeof target === "string") {
    el = container.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(target)}"]`)
      || container.querySelector<HTMLElement>(`[data-img-id="${CSS.escape(target)}"]`);
  }
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => el.focus?.({ preventScroll: true }), 120);
  }
}

/**
 * A Svelte action that traps the focus inside a given HTMLElement.
 * To use: <div use:focusTrap>...</div>
 */
export function focusTrap(node: HTMLElement) {
  const focusableElements = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    const focusables = Array.from(node.querySelectorAll<HTMLElement>(focusableElements));
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusables[0];
    const lastElement = focusables[focusables.length - 1];

    if (e.shiftKey) { // Shift + Tab
      if (document.activeElement === firstElement || !node.contains(document.activeElement)) {
        e.preventDefault();
        lastElement.focus();
      }
    } else { // Tab
      if (document.activeElement === lastElement || !node.contains(document.activeElement)) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  const previousFocus = document.activeElement as HTMLElement;

  // focus the first element initially
  setTimeout(() => {
    const focusables = Array.from(node.querySelectorAll<HTMLElement>(focusableElements));
    if (focusables.length > 0 && !node.contains(document.activeElement)) {
      focusables[0].focus();
    }
  }, 50);

  node.addEventListener('keydown', handleKeydown);

  return {
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
      if (previousFocus && typeof previousFocus.focus === 'function') {
        setTimeout(() => previousFocus.focus(), 50);
      }
    }
  };
}

export function tooltip(node: HTMLElement, options: { text: string, shortcut?: string, position?: 'top'|'bottom'|'left'|'right', showDelay?: number, enabled?: boolean }) {
  let tooltipEl: HTMLDivElement | null = null;
  let timeoutId: ReturnType<typeof setTimeout>;
  let { text, shortcut, position = 'top', showDelay = 400, enabled = true } = options;
  let isHovering = false;
  let isFocused = false;
  let disabledObserver: MutationObserver | null = null;

  function clearTooltip() {
    clearTimeout(timeoutId);
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  function isNodeDisabled() {
    if (!(node instanceof HTMLButtonElement || node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)) {
      return false;
    }
    return node.disabled;
  }

  function createTooltip() {
    if (!enabled) return;
    if (!node.isConnected) return;
    if (!isHovering && !isFocused) return;
    if (isNodeDisabled()) return;

    clearTooltip();
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'fixed z-[99999] px-2 py-1.5 text-xs font-medium text-slate-100 bg-slate-900 border border-slate-700/80 rounded block shadow-xl pointer-events-none opacity-0 transition-opacity duration-150';
    
    let html = `<span>${text}</span>`;
    if (shortcut) {
      html += `<span class="ml-1.5 text-blue-300 bg-blue-900/30 px-1 py-0.5 rounded text-[10px] tracking-wider">${shortcut}</span>`;
    }
    tooltipEl.innerHTML = html;
    document.body.appendChild(tooltipEl);

    const nodeRect = node.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    let top = 0;
    let left = 0;

    if (position === 'top') {
      top = nodeRect.top - tooltipRect.height - 8;
      left = nodeRect.left + (nodeRect.width / 2) - (tooltipRect.width / 2);
    } else if (position === 'bottom') {
      top = nodeRect.bottom + 8;
      left = nodeRect.left + (nodeRect.width / 2) - (tooltipRect.width / 2);
    } else if (position === 'left') {
      top = nodeRect.top + (nodeRect.height / 2) - (tooltipRect.height / 2);
      left = nodeRect.left - tooltipRect.width - 8;
    } else if (position === 'right') {
      top = nodeRect.top + (nodeRect.height / 2) - (tooltipRect.height / 2);
      left = nodeRect.right + 8;
    }

    // Boundary checks
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    if (left + tooltipRect.width > window.innerWidth - 4) left = window.innerWidth - tooltipRect.width - 4;
    if (top + tooltipRect.height > window.innerHeight - 4) top = window.innerHeight - tooltipRect.height - 4;

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
    
    requestAnimationFrame(() => {
      if (tooltipEl) tooltipEl.classList.replace('opacity-0', 'opacity-100');
    });
  }

  function onMouseEnter() {
    if (!enabled) return;
    isHovering = true;
    if (isNodeDisabled()) return;
    timeoutId = setTimeout(createTooltip, showDelay);
  }

  function onMouseLeave() {
    isHovering = false;
    clearTooltip();
  }

  function onFocus() {
    if (!enabled) return;
    isFocused = true;
    if (isNodeDisabled()) return;
    timeoutId = setTimeout(createTooltip, showDelay);
  }

  function onBlur() {
    isFocused = false;
    clearTooltip();
  }

  node.addEventListener('mouseenter', onMouseEnter);
  node.addEventListener('mouseleave', onMouseLeave);
  node.addEventListener('click', onMouseLeave);
  node.addEventListener('focus', onFocus);
  node.addEventListener('blur', onBlur);

  if (typeof MutationObserver !== 'undefined') {
    disabledObserver = new MutationObserver(() => {
      if (isNodeDisabled()) {
        isHovering = false;
        isFocused = false;
        clearTooltip();
      }
    });
    disabledObserver.observe(node, { attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
  }

  return {
    update(newOptions: any) {
      text = newOptions.text;
      shortcut = newOptions.shortcut;
      position = newOptions.position || 'top';
      showDelay = newOptions.showDelay || 400;
      enabled = newOptions.enabled ?? true;
      if (!enabled) {
        isHovering = false;
        isFocused = false;
      }
      if (isNodeDisabled()) {
        isHovering = false;
        isFocused = false;
      }
      clearTooltip();
    },
    destroy() {
      node.removeEventListener('mouseenter', onMouseEnter);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('click', onMouseLeave);
      node.removeEventListener('focus', onFocus);
      node.removeEventListener('blur', onBlur);
      if (disabledObserver) {
        disabledObserver.disconnect();
        disabledObserver = null;
      }
      clearTooltip();
    }
  }
}
