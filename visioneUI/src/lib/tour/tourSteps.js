import { get } from 'svelte/store';
import { uiStore } from '../../stores/uiStore.js';
import { requestTourUi } from '../../stores/tourStore.js';

// Guided tour for novice competition users (~5 minutes).
//
// Step fields:
// - target: `data-tour` anchor to spotlight; when missing the popover is centered.
// - title / body: popover content (body is trusted static HTML; target and body
//   may also be functions of (ctx, start)).
// - task: true for "do it" steps; they advance on their own once `done` returns true.
// - done(ctx, start, memo): completion check against the live tour context
//   (see `tourContext` in routes/+page.svelte); `start` is the context when the
//   step was entered, `memo` a per-step scratch object.
// - before(): prepares the UI (open sidebars/panels) when the step is entered.
// - forceActions: keep the first keyframe's hover actions visible.
// - callouts: extra anchors marked with labelled badges.

export const AGENT_EXAMPLE_QUESTION =
  'What time does the clock show, when the woman arrives at the top of the parking deck?';

function ensureLeftSidebar() {
  if (!get(uiStore).isSidebarOpen) uiStore.actions.toggleSidebar();
}

// Starts from the plain ranked list so the layout step can switch to By Video.
function prepareFirstQuery() {
  ensureLeftSidebar();
  if (get(uiStore).viewMode === 'byvideo') uiStore.actions.setViewMode('byrank');
}

function openedThenClosed(flag) {
  return (ctx, _start, memo) => {
    if (ctx[flag]) memo.opened = true;
    return !!memo.opened && !ctx[flag];
  };
}

export const TOUR_STEPS = [
  {
    id: 'query',
    target: 'query-input',
    title: 'Describe what you are looking for',
    body:
      'Type a description of the scene and press <b>Enter</b>. You can write <b>in any language</b>: ' +
      'when the <b>translate</b> toggle is on, VISIONE translates your query into English.<br><br>' +
      '💡 <b>Tip:</b> writing directly in English? Turn the toggle off: the search will be faster!',
    task: true,
    before: prepareFirstQuery,
    callouts: [{ target: 'translate-toggle', label: 'Translate', side: 'above' }],
    done: (ctx, start) => ctx.searchCount > start.searchCount && ctx.resultCount > 0
  },
  {
    id: 'results',
    target: 'results',
    title: 'Results',
    body: 'Results are keyframes <b>ranked by relevance</b>, best matches first. Scroll down to see more.',
    placement: 'center'
  },
  {
    id: 'layout',
    target: 'view-mode',
    title: 'Group results by video',
    body: 'Open this menu and choose <b>By Video</b>: keyframes from the same video are grouped together, so you can compare videos instead of single frames.',
    task: true,
    done: (ctx, start) => ctx.viewMode !== start.viewMode
  },
  {
    id: 'frame-actions',
    target: 'kf-actions',
    forceActions: true,
    title: 'Frame actions',
    body: 'When you hover a frame, a set of <b>quick actions</b> appears on it. The next steps show you the most useful ones.'
  },
  {
    id: 'play',
    target: 'kf-play',
    forceActions: true,
    title: 'Watch the video',
    body: 'Press <b>▶</b> on a frame to open the video. Use the timeline to jump around, then <b>close the player</b> to continue.',
    task: true,
    done: openedThenClosed('isVideoPlayerOpen')
  },
  {
    id: 'context',
    target: 'kf-context',
    forceActions: true,
    title: 'Context view',
    body: 'Open the <b>Context view</b> of a frame: it shows the whole video as a sequence of frames, so you can check it at a glance. Close it to continue.',
    task: true,
    done: openedThenClosed('isVideoSummaryOpen')
  },
  {
    id: 'similarity',
    target: 'kf-similarity',
    forceActions: true,
    title: 'Image similarity',
    body: 'Click <b>Image similarity</b> on a frame to find frames that look like it. Useful when you found something close to the target. The frame is added as a new step of your query: remove it when you no longer need it.',
    task: true,
    // Similarity runs a new search; wait for its results before moving on.
    done: (ctx, start) => ctx.searchCount > start.searchCount && ctx.resultCount > 0
  },
  {
    id: 'feedback',
    target: 'rf-panel',
    forceActions: true,
    title: 'Relevance feedback',
    body:
      'To test <b>relevance feedback</b>, mark some frames as <b>👍 relevant</b> and/or <b>👎 not relevant</b> using the buttons on the frames, ' +
      'then press <b>Search</b>: results move toward what you liked and away from what you did not. Make sure RF is <b>ON</b>.',
    task: true,
    before: () => uiStore.actions.focusRightTab('RF'),
    callouts: [
      { target: 'kf-rf', label: '👍 👎' },
      { target: 'search-button', label: 'Search' }
    ],
    // The search has to run after at least one frame was marked.
    done: (ctx, start, memo) => {
      const marked = ctx.rfPositiveCount + ctx.rfNegativeCount;
      const markedAtStart = (start.rfPositiveCount || 0) + (start.rfNegativeCount || 0);
      if (memo.readyAt === undefined && marked > markedAtStart) memo.readyAt = ctx.searchCount;
      return memo.readyAt !== undefined && ctx.searchCount > memo.readyAt;
    }
  },
  {
    id: 'add-step',
    // Once the new step exists, point at its text box instead of the button.
    target: (ctx, start) => (ctx.stepCount > start.stepCount ? 'new-query-input' : 'add-step'),
    title: 'Search for a sequence',
    body: (ctx, start) =>
      ctx.stepCount > start.stepCount
        ? 'Now <b>type the next scene</b> in the highlighted box and press <b>Enter</b>: VISIONE finds videos where the scenes appear <b>in this order</b>.'
        : 'Remember what happens next? Click <b>Describe Next Scene</b> to add a new box for the following scene.',
    task: true,
    before: ensureLeftSidebar,
    // Wait for the new step to be filled in and searched, not just added.
    done: (ctx, start, memo) => {
      if (memo.searchAtAdd === undefined && ctx.stepCount > start.stepCount) memo.searchAtAdd = ctx.searchCount;
      return (
        memo.searchAtAdd !== undefined &&
        ctx.filledStepCount > start.filledStepCount &&
        ctx.searchCount > memo.searchAtAdd
      );
    }
  },
  {
    id: 'reorder',
    target: 'query-steps',
    title: 'Reorder the scenes',
    body: 'Wrong order? Use the <b>↑ ↓</b> arrows in a step header, or <b>drag a step</b> by its header or left border. The search runs again automatically.',
    before: ensureLeftSidebar
  },
  {
    id: 'skip-delete',
    target: 'step-controls',
    title: 'Skip or delete a step',
    body: 'In each step header, use the <b>switch</b> to temporarily skip the step without losing what you wrote, and the <b>trash</b> button to delete it.',
    before: ensureLeftSidebar
  },
  {
    id: 'agent',
    target: 'agent',
    title: 'Let the agent search for you',
    body:
      'You can ask the <b>Agent</b> to run the search for you, in plain language. For example, to find the <b>exact video and moment</b> ' +
      'where a scene happens, or to <b>answer a question</b> about a particular video. ' +
      'The agent suggests an answer: always <b>check it on the video</b> before submitting.',
    before: () => {
      ensureLeftSidebar();
      requestTourUi('openAgent', { question: AGENT_EXAMPLE_QUESTION });
    }
  },
  {
    id: 'challenge',
    target: 'challenge',
    title: 'Pick the right challenge',
    body: 'At the <b>start of each task</b>, select here the challenge type of the task currently running (e.g. <b>KIS</b> to find a scene, <b>Q&amp;A</b> to answer a question). Submissions are sent as the selected type.'
  },
  {
    id: 'submit',
    target: 'kf-submit',
    forceActions: true,
    title: 'Submit',
    body:
      'Found it? Hit <b>Submit</b> on the frame (for question tasks you type the answer).<br><br>' +
      'Not sure about the exact moment? <b>Play the video</b> ▶, find the exact moment and press <b>Submit</b> in the player.',
    callouts: [{ target: 'kf-play', label: '▶ Play' }]
  },
  {
    id: 'recent',
    target: 'recent',
    title: 'Recent searches',
    body: 'Your previous queries are kept in <b>Recent</b>. Click one to run it again.<br><br><b>You are ready!</b> 🎉',
    before: () => {
      ensureLeftSidebar();
      requestTourUi('openRecent');
    }
  }
];
