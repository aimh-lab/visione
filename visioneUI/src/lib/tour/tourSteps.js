import { get } from 'svelte/store';
import { uiStore } from '../../stores/uiStore.js';
import { requestTourUi } from '../../stores/tourStore.js';

// Guided tour for novice competition users, from the basics to the advanced tools.
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
// - callouts: extra anchors marked with labelled badges (may be a function of (ctx, start)).
// - skip(ctx): true when the step doesn't apply right now and must be passed over.

export const AGENT_EXAMPLE_QUESTION =
  'In the video 18728, which of the two fighters (color of their shorts) is the first one landing on the floor?';

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
    id: 'challenge',
    target: 'challenge',
    title: 'Select the challenge',
    body: 'At the <b>start of each task</b>, select here the challenge type of the task currently running (e.g. <b>KIS</b> to find a scene, <b>Q&amp;A</b> to answer a question). Your submissions are sent as the selected type.'
  },
  {
    id: 'query',
    target: 'query-input',
    title: 'Describe what you are looking for',
    // The translator needs the AI services token: without it, only the query part is shown.
    body: (ctx) =>
      ctx.aiServicesAvailable
        ? 'Type a description of the scene and press <b>Enter</b>. You can write <b>in any language</b>: ' +
          'when <b>Translate</b> is on, VISIONE translates your query into English.<br><br>' +
          '💡 <b>Tip:</b> writing in English? Turn Translate off and the search will be faster!'
        : 'Type a description of the scene <b>in English</b> and press <b>Enter</b>.',
    task: true,
    before: prepareFirstQuery,
    callouts: (ctx) => (ctx.aiServicesAvailable ? [{ target: 'translate-toggle', label: 'Translate', side: 'above' }] : []),
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
    id: 'add-step',
    // Once the new step exists, point at its text box instead of the button.
    target: (ctx, start) => (ctx.stepCount > start.stepCount ? 'new-query-input' : 'add-step'),
    title: 'Search for a sequence',
    body: (ctx, start) =>
      ctx.stepCount > start.stepCount
        ? 'Now <b>type the next scene</b> in the highlighted box and press <b>Enter</b>: VISIONE finds videos where the scenes appear <b>in this order</b>.'
        : 'Remember what happens next? Click <b>Describe Next Scene</b> to add a box for the following scene.',
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
    body: 'Wrong order? Use the <b>↑ ↓</b> arrows in a step header, or <b>drag a step</b> by its header. The search runs again automatically. Try it now.',
    task: true,
    before: ensureLeftSidebar,
    done: (ctx, start) => ctx.reorderCount > start.reorderCount
  },
  {
    id: 'skip-step',
    target: 'step-controls',
    title: 'Skip a step',
    body: 'Not sure about a scene? Use the <b>switch</b> in its header to <b>skip</b> it: the step is ignored by the search, but what you wrote is kept. Try it now.',
    task: true,
    before: ensureLeftSidebar,
    done: (ctx, start) => ctx.enabledStepCount < start.enabledStepCount
  },
  {
    id: 'delete-step',
    target: 'step-controls',
    title: 'Delete a step',
    body: 'Don\'t need a step anymore? Press the <b>trash</b> button in its header and confirm with <b>Delete step</b>. Try it on the step you just skipped.',
    task: true,
    before: ensureLeftSidebar,
    done: (ctx, start) => ctx.stepCount < start.stepCount
  },
  {
    id: 'frame-actions',
    target: 'kf-actions',
    forceActions: true,
    title: 'Frame actions',
    body: 'When you hover a frame, a set of <b>quick actions</b> appears on it. The next steps show you the most useful ones.'
  },
  {
    id: 'submit',
    target: 'kf-submit',
    forceActions: true,
    title: 'Submit',
    body: 'Found it? Press <b>Submit</b> on the frame. For question tasks, you type the answer.'
  },
  {
    id: 'play',
    target: 'kf-play',
    forceActions: true,
    title: 'Play the video',
    body:
      'Not sure about the exact moment? Press <b>▶</b> to play the video. Use the timeline to find the exact moment, ' +
      'then press <b>Submit</b> in the player. <b>Close the player</b> to continue.',
    task: true,
    done: openedThenClosed('isVideoPlayerOpen')
  },
  {
    id: 'context',
    target: 'kf-context',
    forceActions: true,
    title: 'Context view',
    body: 'Open the <b>Context view</b> of a frame: it shows the frames before and after it, so you can check the whole scene at a glance. Close it to continue.',
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
    title: 'Advanced: Relevance feedback',
    body:
      'Mark some frames as <b>👍 relevant</b> and/or <b>👎 not relevant</b> using the buttons on the frames, ' +
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
    id: 'agent',
    target: 'agent',
    title: 'Advanced: the Agent',
    body:
      'You can ask the <b>Agent</b> to search for you, in plain language: to find the <b>exact video and moment</b> of a scene, ' +
      'or to <b>answer a question</b> about a video. Try it with the question we prepared:<br><br>' +
      `<i>"${AGENT_EXAMPLE_QUESTION}"</i><br><br>` +
      'Press <b>Ask agent</b> and wait for its answer.',
    task: true,
    skip: (ctx) => !ctx.aiServicesAvailable,
    before: () => {
      ensureLeftSidebar();
      requestTourUi('openAgent', { question: AGENT_EXAMPLE_QUESTION });
    },
    done: openedThenClosed('agentStreaming')
  },
  {
    id: 'agent-check',
    target: 'step-filters',
    title: 'Check the agent\'s answer',
    skip: (ctx) => !ctx.aiServicesAvailable,
    body:
      'The agent tells you the <b>video</b> and the <b>moment</b> it found. Always check it before submitting: ' +
      'open the <b>+</b> menu of a step and add the <b>Video ID</b> and <b>Time Range</b> filters with those values. ' +
      'The results then show only the frames of that moment: verify them and <b>Submit</b>.',
    before: ensureLeftSidebar
  },
  {
    id: 'recent',
    target: 'recent',
    title: 'Recent searches',
    body: 'Your previous queries are kept in <b>Recent</b>. Click one to run it again.',
    before: () => {
      ensureLeftSidebar();
      requestTourUi('openRecent');
    }
  },
  {
    id: 'reset',
    target: 'logo',
    title: 'Start over',
    body: 'Press the <b>VISIONE</b> logo to reset the system and start a new search from scratch.<br><br><b>You are ready!</b> 🎉',
    task: true,
    done: (ctx, start) => ctx.resetCount > start.resetCount
  }
];
