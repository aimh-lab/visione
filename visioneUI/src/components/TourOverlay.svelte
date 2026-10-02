<script>
  import { onMount, tick } from 'svelte';
  import { tour } from '../stores/tourStore.js';
  import { TOUR_STEPS } from '../lib/tour/tourSteps.js';

  // Live app state the steps check for completion; see `done` in tourSteps.js.
  export let ctx = {};

  const POPOVER_WIDTH = 330;
  const GAP = 14;
  const MARGIN = 8;
  const PAD = 6;

  let stepIndex = -1;
  let start = {};
  let memo = {};
  let completed = false;
  let advanceTimer = null;

  let targetRect = null;
  let calloutRects = [];
  let popoverHeight = 220;
  let viewport = { w: 0, h: 0 };

  $: step = $tour.active ? TOUR_STEPS[$tour.index] : null;
  $: isLast = $tour.index === TOUR_STEPS.length - 1;
  $: if ($tour.active && $tour.index !== stepIndex) enterStep($tour.index);
  $: if (!$tour.active && stepIndex !== -1) leaveTour();

  $: if (step?.task && stepIndex === $tour.index && !completed && step.done?.(ctx, start, memo)) {
    completed = true;
    advanceTimer = setTimeout(() => tour.next(), 900);
  }

  // `target` and `body` may be functions of (ctx, start), for steps whose
  // focus moves once the user has acted (e.g. a newly added query box).
  // The template passes ctx/start explicitly so Svelte re-renders when they change.
  function resolve(value, c = ctx, s = start) {
    return typeof value === 'function' ? value(c, s) : value;
  }

  $: docked = !!ctx.modalOpen;
  $: popoverPos = computePopoverPosition(targetRect, popoverHeight, viewport, step?.placement, docked);

  async function enterStep(index) {
    clearTimeout(advanceTimer);
    stepIndex = index;
    completed = false;
    memo = {};
    start = { ...ctx };
    clearForcedActions();
    const current = TOUR_STEPS[index];
    try {
      current?.before?.();
    } catch {
      /* a failed UI preparation should not break the tour */
    }
    await tick();
    setTimeout(() => {
      const el = findTarget(resolve(current?.target));
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Only scroll targets that fit on screen; tall panels would otherwise be
      // scrolled past their header.
      const offscreen = r.top < 0 || r.bottom > window.innerHeight;
      if (offscreen && r.height < window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 150);
  }

  function leaveTour() {
    clearTimeout(advanceTimer);
    stepIndex = -1;
    targetRect = null;
    calloutRects = [];
    clearForcedActions();
  }

  function findTarget(name) {
    if (!name || typeof document === 'undefined') return null;
    for (const el of document.querySelectorAll(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }

  function clearForcedActions() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-tour-force]').forEach((el) => el.removeAttribute('data-tour-force'));
  }

  function toRect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  // Rect of an anchor grown to include its open `data-tour-part` pieces
  // (e.g. a dropdown menu), so they are not left under the dimmed backdrop.
  function anchorRect(name) {
    const rect = toRect(findTarget(name));
    if (!rect) return null;
    let top = rect.top;
    let left = rect.left;
    let bottom = rect.top + rect.height;
    let right = rect.left + rect.width;
    for (const part of document.querySelectorAll(`[data-tour-part="${name}"]`)) {
      const r = part.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      bottom = Math.max(bottom, r.bottom);
      right = Math.max(right, r.right);
    }
    return { top, left, width: right - left, height: bottom - top };
  }

  function sameRect(a, b) {
    if (!a || !b) return a === b;
    return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
      && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
  }

  // Targets move with scrolling, sidebar resizes and async rendering, so they
  // are re-measured every frame while the tour runs.
  function measure() {
    if (!step) return;
    if (step.forceActions) {
      const actions = findTarget('kf-actions');
      if (actions && !actions.hasAttribute('data-tour-force')) {
        clearForcedActions();
        actions.setAttribute('data-tour-force', '');
      }
    }
    const nextRect = anchorRect(resolve(step.target));
    if (!sameRect(nextRect, targetRect)) targetRect = nextRect;

    const nextCallouts = (step.callouts || [])
      .map((c, i) => {
        const spec = typeof c === 'string' ? { target: c, label: String(i + 1) } : c;
        const rect = toRect(findTarget(spec.target));
        return rect ? { label: spec.label, side: spec.side || 'corner', rect } : null;
      })
      .filter(Boolean);
    if (
      nextCallouts.length !== calloutRects.length ||
      nextCallouts.some((c, i) => !sameRect(c.rect, calloutRects[i].rect))
    ) {
      calloutRects = nextCallouts;
    }
    if (viewport.w !== window.innerWidth || viewport.h !== window.innerHeight) {
      viewport = { w: window.innerWidth, h: window.innerHeight };
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(v, max));
  }

  function computePopoverPosition(rect, height, vp, placement, isDocked) {
    const w = Math.min(POPOVER_WIDTH, (vp.w || 400) - 2 * MARGIN);
    const maxY = Math.max(MARGIN, vp.h - height - MARGIN);
    const maxX = Math.max(MARGIN, vp.w - w - MARGIN);
    if (isDocked) return { left: MARGIN * 2, top: maxY - MARGIN, width: w };
    if (!rect) return { left: (vp.w - w) / 2, top: Math.max(MARGIN, (vp.h - height) / 2), width: w };

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (placement !== 'center') {
      if (rect.left + rect.width + PAD + GAP + w <= vp.w - MARGIN) {
        return { left: rect.left + rect.width + PAD + GAP, top: clamp(rect.top, MARGIN, maxY), width: w };
      }
      if (rect.left - PAD - GAP - w >= MARGIN) {
        return { left: rect.left - PAD - GAP - w, top: clamp(rect.top, MARGIN, maxY), width: w };
      }
      if (rect.top + rect.height + PAD + GAP + height <= vp.h - MARGIN) {
        return { left: clamp(cx - w / 2, MARGIN, maxX), top: rect.top + rect.height + PAD + GAP, width: w };
      }
      if (rect.top - PAD - GAP - height >= MARGIN) {
        return { left: clamp(cx - w / 2, MARGIN, maxX), top: rect.top - PAD - GAP - height, width: w };
      }
    }
    return { left: clamp(cx - w / 2, MARGIN, maxX), top: clamp(cy - height / 2, MARGIN, maxY), width: w };
  }

  function startTour() {
    tour.start(TOUR_STEPS.length);
  }

  onMount(() => {
    tour.setStepCount(TOUR_STEPS.length);
    viewport = { w: window.innerWidth, h: window.innerHeight };
    try {
      if (new URLSearchParams(window.location.search).get('tutorial') === '1') startTour();
    } catch {
      /* ignore malformed URLs */
    }

    let frame = 0;
    const loop = () => {
      if ($tour.active) measure();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(advanceTimer);
      clearForcedActions();
    };
  });
</script>

{#if step}
  <div class="tour-root" aria-live="polite">
    {#if !docked}
      {#if targetRect}
        <div
          class="tour-spotlight"
          style="top: {targetRect.top - PAD}px; left: {targetRect.left - PAD}px; width: {targetRect.width + PAD * 2}px; height: {targetRect.height + PAD * 2}px;"
        ></div>
      {:else}
        <div class="tour-dim"></div>
      {/if}

      {#each calloutRects as c (c.label)}
        <div
          class="tour-callout-ring"
          style="top: {c.rect.top - 3}px; left: {c.rect.left - 3}px; width: {c.rect.width + 6}px; height: {c.rect.height + 6}px;"
        ></div>
        {#if c.side === 'above'}
          <div
            class="tour-callout-badge"
            style="top: {c.rect.top - 26}px; left: {c.rect.left + c.rect.width / 2}px; transform: translateX(-50%);"
          >{c.label}</div>
        {:else}
          <div class="tour-callout-badge" style="top: {c.rect.top - 12}px; left: {c.rect.left - 12}px;">{c.label}</div>
        {/if}
      {/each}
    {/if}

    <div
      class="tour-popover"
      role="dialog"
      aria-label="Guided tour"
      bind:offsetHeight={popoverHeight}
      style="top: {popoverPos.top}px; left: {popoverPos.left}px; width: {popoverPos.width}px;"
    >
      <div class="tour-progress" aria-hidden="true">
        <div class="tour-progress-bar" style="width: {(($tour.index + 1) / TOUR_STEPS.length) * 100}%;"></div>
      </div>

      <div class="tour-header">
        <span class="tour-counter">{$tour.index + 1} / {TOUR_STEPS.length}</span>
        {#if step.task}
          <span class="tour-chip {completed ? 'tour-chip-done' : ''}">{completed ? '✓ Done' : 'Your turn'}</span>
        {/if}
      </div>

      <h3 class="tour-title">{step.title}</h3>
      <!-- Static, trusted copy from tourSteps.js -->
      <div class="tour-body">{@html resolve(step.body, ctx, start)}</div>

      <div class="tour-actions">
        <button type="button" class="tour-btn tour-btn-ghost" on:click={() => tour.stop()}>Skip tour</button>
        <div class="tour-actions-right">
          {#if $tour.index > 0}
            <button type="button" class="tour-btn tour-btn-ghost" on:click={() => tour.prev()}>Back</button>
          {/if}
          <button
            type="button"
            class="tour-btn {step.task && !completed ? 'tour-btn-secondary' : 'tour-btn-primary'}"
            on:click={() => tour.next()}
          >
            {isLast ? 'Finish' : step.task && !completed ? 'Skip step' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global([data-tour-force]) {
    opacity: 1 !important;
  }

  .tour-root {
    position: fixed;
    inset: 0;
    z-index: 10050;
    pointer-events: none;
  }

  .tour-spotlight {
    position: fixed;
    border-radius: 10px;
    box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.55), 0 0 0 2px rgba(96, 165, 250, 0.95), 0 0 18px 4px rgba(96, 165, 250, 0.45);
    transition: top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease;
  }

  .tour-dim {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.55);
  }

  .tour-callout-ring {
    position: fixed;
    border-radius: 6px;
    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.95);
  }

  .tour-callout-badge {
    position: fixed;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: #f59e0b;
    color: #0f172a;
    font-size: 11px;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  }

  .tour-popover {
    position: fixed;
    pointer-events: auto;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: #0f172a;
    color: #e2e8f0;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
    padding: 14px 16px 12px;
    font-size: 13px;
    line-height: 1.45;
    transition: top 0.2s ease, left 0.2s ease;
  }

  .tour-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(148, 163, 184, 0.2);
  }

  .tour-progress-bar {
    height: 100%;
    background: #3b82f6;
    transition: width 0.25s ease;
  }

  .tour-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .tour-counter {
    font-size: 11px;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }

  .tour-chip {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.45);
  }

  .tour-chip-done {
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.45);
  }

  .tour-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 6px;
  }

  .tour-body :global(ol) {
    margin: 6px 0 0;
    padding-left: 20px;
    list-style: decimal;
  }

  .tour-body :global(b) {
    color: #f8fafc;
  }

  .tour-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    gap: 8px;
  }

  .tour-actions-right {
    display: flex;
    gap: 6px;
  }

  .tour-btn {
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .tour-btn-ghost {
    color: #94a3b8;
    background: transparent;
  }

  .tour-btn-ghost:hover {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.15);
  }

  .tour-btn-primary {
    color: #fff;
    background: #2563eb;
  }

  .tour-btn-primary:hover {
    background: #1d4ed8;
  }

  .tour-btn-secondary {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.2);
  }

  .tour-btn-secondary:hover {
    background: rgba(148, 163, 184, 0.3);
  }
</style>
