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
 */
export function createDresController({ sessionStore, findFrame, updateVerdictInViews, markSubmittedInViews }) {
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

  // ---- Low-level submit to DRES ----------------------------------------

  async function submitToDres(frameObj) {
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

      const verdict = String(result?.submission ?? '').toUpperCase();
      const description = result?.description ?? 'sent';
      applySubmissionVerdict(imgId, verdict);

      if (result?.status === false) {
        toasts.error(`DRES submission rejected: ${description}`);
        return { accepted: false, verdict, description };
      }

      if (verdict === 'WRONG') {
        toasts.error(`DRES submission WRONG: ${description}`);
      } else if (verdict === 'INDETERMINATE' || verdict === 'UNDECIDABLE') {
        toasts.warning(`DRES submission ${verdict}: ${description}`);
      } else {
        toasts.success(`DRES submission OK: ${description}`);
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
      return;
    }

    if (typeof window !== 'undefined') {
      const ok = window.confirm('Are you sure you want to submit this frame?');
      if (!ok) return;
    }

    const frameObj = findFrame(imgId, fallback);
    if (!frameObj) return;

    const dresResult = await submitToDres(frameObj);
    if (!dresResult?.accepted) return;

    sessionStore.actions.submitFrame({
      imgId,
      frameObj,
      markSubmitted: (id) => markSubmittedInViews(id)
    });
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
    testConnection,
    applySubmissionVerdict,
    getClient
  };
}
