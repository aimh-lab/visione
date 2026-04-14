// src/lib/controllers/dresController.js
//
// Manages DRES client lifecycle, frame submission, verdict propagation
// and connection testing.

import { createDresClientFromSettings, DresClientError } from '../../services/dresClient.ts';
import { visioneAPI } from '../../services/api.js';
import { uiStore } from '../../stores/uiStore.js';
import { toasts } from '../../stores/toastStore.js';
import { get } from 'svelte/store';

/**
 * @param {Object} deps
 * @param {Object} deps.sessionStore
 * @param {() => Object|null} deps.findFrame        - (imgId, fallback) => frameObj | null
 * @param {(id: string, verdict: string) => void} deps.updateVerdictInViews
 * @param {(id: string) => void} deps.markSubmittedInViews
 * @param {(data: any) => void} [deps.onFrameSubmitEvent]
 * @param {(data: any) => void} [deps.onTextSubmitEvent]
 */
export function createDresController({ sessionStore, findFrame, updateVerdictInViews, markSubmittedInViews, onFrameSubmitEvent, onTextSubmitEvent }) {
  let clientInstance = null;
  let clientSignature = '';

  // ---- Singleton client ------------------------------------------------

  function getClient() {
    const settings = get(uiStore);
    const signature = JSON.stringify({
      enabled: !!settings?.dresEnabled,
      server: settings?.dresSubmitServer ?? '',
      username: settings?.dresUsername ?? '',
      password: settings?.dresPassword ?? '',
      memberId: settings?.dresMemberId ?? ''
    });

    if (!settings?.dresEnabled) {
      clientInstance = null;
      clientSignature = '';
      throw new DresClientError('DRES is disabled in settings.');
    }

    if (!clientInstance || clientSignature !== signature) {
      clientInstance = createDresClientFromSettings(settings);
      clientSignature = signature;
    }

    return clientInstance;
  }

  // ---- Verdict propagation ---------------------------------------------

  function applySubmissionVerdict(imgId, submissionVerdict) {
    if (!imgId) return;
    sessionStore.actions.updateSubmittedFrame({ imgId, patch: { submissionVerdict } });
    updateVerdictInViews(imgId, submissionVerdict);
  }

  function normalizeChallengeType(value) {
    const type = String(value ?? '').toUpperCase();
    if (type === 'AVS') return 'AVS';
    if (type === 'Q&A') return 'Q&A';
    return 'KIS';
  }

  function normalizeVerdict(value) {
    const v = String(value ?? '').toUpperCase();
    if (v === 'CORRECT' || v === 'WRONG' || v === 'INDETERMINATE' || v === 'UNDECIDABLE') return v;
    if (v === 'PENDING') return 'PENDING';
    return '';
  }

  function notifyVerdict(verdict, description = 'sent', prefix = 'DRES submission') {
    if (verdict === 'WRONG') {
      toasts.error(`${prefix} WRONG: ${description}`);
    } else if (verdict === 'INDETERMINATE' || verdict === 'UNDECIDABLE') {
      toasts.warning(`${prefix} ${verdict}: ${description}`);
    } else {
      toasts.success(`${prefix} OK: ${description}`);
    }
  }

  // ---- Low-level submit to DRES ----------------------------------------

  async function submitFrameToDres(frameObj) {
    try {
      const client = getClient();

      if (!client.getSessionId()) {
        await client.login();
      }

      const imgId = frameObj?.imgId;
      if (!imgId) {
        throw new Error('Missing imgId for DRES submission');
      }

      const middleSeconds = await visioneAPI.getMiddleTimestamp(imgId);
      const timestampMs = Math.max(0, Math.round(Number(middleSeconds) * 1000));
      const videoId = String(frameObj?.videoId ?? String(imgId).split('-')[0]).padStart(5, '0');

      let result;
      try {
        result = await client.submitResultByTime(videoId, timestampMs, timestampMs);
      } catch (submitError) {
        if (submitError instanceof DresClientError && submitError.statusCode === 401) {
          await client.login();
          result = await client.submitResultByTime(videoId, timestampMs, timestampMs);
        } else {
          throw submitError;
        }
      }

      const verdict = normalizeVerdict(result?.submission);
      const description = result?.description ?? 'sent';

      if (result?.status === false) {
        toasts.error(`DRES submission rejected: ${description}`);
        return { accepted: false, verdict, description };
      }
      return { accepted: true, verdict, description };
    } catch (error) {
      const message = error instanceof DresClientError || error instanceof Error
        ? error.message
        : 'Unknown error during DRES submission';
      toasts.error(`DRES submission failed: ${message}`);
      return { accepted: false, verdict: '', description: message };
    }
  }

  // ---- High-level submit by imgId --------------------------------------

  async function submitByImgId(imgId, fallback = null) {
    const settings = get(uiStore);
    if (!settings?.dresEnabled) {
      toasts.info('Enable DRES submit in settings to submit frames.');
      onFrameSubmitEvent?.({ imgId, accepted: false, reason: 'dres-disabled' });
      return { accepted: false, verdict: '', description: 'DRES disabled' };
    }

    const challengeType = normalizeChallengeType(settings?.dresChallengeType);
    if (challengeType === 'Q&A') {
      toasts.info('Q&A challenge accepts only text answers. Use the submit panel on the right.');
      onFrameSubmitEvent?.({ imgId, accepted: false, reason: 'wrong-challenge-type', challengeType });
      return { accepted: false, verdict: '', description: 'Q&A mode accepts text answers only' };
    }

    if (challengeType === 'KIS' && typeof window !== 'undefined') {
      const ok = window.confirm('Are you sure you want to submit this frame?');
      if (!ok) {
        onFrameSubmitEvent?.({ imgId, accepted: false, reason: 'cancelled-by-user', challengeType });
        return { accepted: false, verdict: '', description: 'Cancelled by user' };
      }
    }

    const frameObj = findFrame(imgId, fallback);
    if (!frameObj) {
      onFrameSubmitEvent?.({ imgId, accepted: false, reason: 'frame-not-found', challengeType });
      return { accepted: false, verdict: '', description: 'Frame not found' };
    }

    const dresResult = await submitFrameToDres(frameObj);
    if (!dresResult?.accepted) {
      onFrameSubmitEvent?.({
        imgId,
        challengeType,
        accepted: false,
        verdict: normalizeVerdict(dresResult?.verdict),
        description: dresResult?.description ?? ''
      });
      return {
        accepted: false,
        verdict: normalizeVerdict(dresResult?.verdict),
        description: dresResult?.description ?? 'Submission rejected'
      };
    }

    const verdictForStore = challengeType === 'AVS'
      ? 'PENDING'
      : normalizeVerdict(dresResult?.verdict);

    applySubmissionVerdict(imgId, verdictForStore);

    sessionStore.actions.submitFrame({
      imgId,
      frameObj: { ...frameObj, submissionVerdict: verdictForStore },
      markSubmitted: (id) => markSubmittedInViews(id)
    });

    if (challengeType === 'AVS') {
      toasts.warning('DRES submission queued: waiting for async verdict.');
      const response = {
        accepted: true,
        verdict: verdictForStore,
        description: dresResult?.description ?? 'queued'
      };
      onFrameSubmitEvent?.({ imgId, challengeType, ...response });
      return response;
    }

    const description = dresResult?.description ?? 'sent';
    notifyVerdict(verdictForStore, description, 'DRES submission');
    const response = { accepted: true, verdict: verdictForStore, description };
    onFrameSubmitEvent?.({ imgId, challengeType, ...response });
    return response;
  }

  async function submitTextAnswer(text) {
    const value = String(text ?? '').trim();
    if (!value) {
      toasts.warning('Please type an answer before submitting.');
      const response = { accepted: false, verdict: '', description: 'Empty answer' };
      onTextSubmitEvent?.({ text: value, challengeType: 'Q&A', ...response });
      return response;
    }

    const settings = get(uiStore);
    if (!settings?.dresEnabled) {
      toasts.info('Enable DRES submit in settings to submit answers.');
      const response = { accepted: false, verdict: '', description: 'DRES disabled' };
      onTextSubmitEvent?.({ text: value, challengeType: 'Q&A', ...response });
      return response;
    }

    const challengeType = normalizeChallengeType(settings?.dresChallengeType);
    if (challengeType !== 'Q&A') {
      toasts.info('Text answer submission is available only in Q&A mode.');
      const response = { accepted: false, verdict: '', description: 'Wrong challenge type' };
      onTextSubmitEvent?.({ text: value, challengeType, ...response });
      return response;
    }

    try {
      const client = getClient();
      if (!client.getSessionId()) {
        await client.login();
      }

      let result;
      try {
        result = await client.submitTextAnswer(value);
      } catch (submitError) {
        if (submitError instanceof DresClientError && submitError.statusCode === 401) {
          await client.login();
          result = await client.submitTextAnswer(value);
        } else {
          throw submitError;
        }
      }

      const verdict = normalizeVerdict(result?.submission);
      const description = result?.description ?? 'sent';

      if (result?.status === false) {
        toasts.error(`DRES answer rejected: ${description}`);
        sessionStore.actions.submitAnswer({ text: value, status: 'FAILED', verdict, description });
        const response = { accepted: false, verdict, description };
        onTextSubmitEvent?.({ text: value, challengeType, ...response });
        return response;
      }

      sessionStore.actions.submitAnswer({ text: value, status: 'SUBMITTED', verdict, description });
      if (verdict === 'WRONG') {
        toasts.error(`DRES answer WRONG: ${description}`);
      } else if (verdict === 'INDETERMINATE' || verdict === 'UNDECIDABLE') {
        toasts.warning(`DRES answer ${verdict}: ${description}`);
      } else {
        toasts.success(`DRES answer submitted: ${description}`);
      }

      const response = { accepted: true, verdict, description };
      onTextSubmitEvent?.({ text: value, challengeType, ...response });
      return response;
    } catch (error) {
      const message = error instanceof DresClientError || error instanceof Error
        ? error.message
        : 'Unknown error during DRES text submission';
      toasts.error(`DRES answer failed: ${message}`);
      sessionStore.actions.submitAnswer({ text: value, status: 'FAILED', verdict: '', description: message });
      const response = { accepted: false, verdict: '', description: message };
      onTextSubmitEvent?.({ text: value, challengeType, ...response });
      return response;
    }
  }

  // ---- Test connection --------------------------------------------------

  async function testConnection(e) {
    try {
      const config = e?.detail ?? {};
      const client = createDresClientFromSettings(config);

      await client.login();
      const evaluationId = await client.getEvaluationId();
      toasts.success(`DRES connected. Active evaluation: ${evaluationId}`);

      try { await client.logout(); } catch { /* ignore logout errors after test */ }
    } catch (error) {
      const message = error instanceof DresClientError || error instanceof Error
        ? error.message
        : 'Unknown error during DRES test';
      toasts.error(`DRES test failed: ${message}`);
    }
  }

  return {
    submitByImgId,
    submitTextAnswer,
    testConnection,
    applySubmissionVerdict,
    getClient
  };
}
