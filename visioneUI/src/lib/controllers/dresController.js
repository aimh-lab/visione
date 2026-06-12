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
 * @param {() => Object|null} [deps.getRuntimeProfile]
 * @param {(data: any) => void} [deps.onFrameSubmitEvent]
 * @param {(data: any) => void} [deps.onTextSubmitEvent]
 */
export function createDresController({ sessionStore, findFrame, updateVerdictInViews, markSubmittedInViews, getRuntimeProfile, onFrameSubmitEvent, onTextSubmitEvent }) {
  let clientInstance = null;
  let clientSignature = '';

  const CHALLENGE_TYPES = ['KIS', 'AVS', 'Q&A'];

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

  function normalizeEvaluationMap(value) {
    const source = value && typeof value === 'object' ? value : {};
    const normalizeEntry = (entry) => {
      if (Array.isArray(entry)) {
        for (const candidate of entry) {
          const id = String(candidate ?? '').trim();
          if (id) return id;
        }
        return '';
      }
      return String(entry ?? '').trim();
    };

    return {
      KIS: normalizeEntry(source.KIS),
      AVS: normalizeEntry(source.AVS),
      'Q&A': normalizeEntry(source['Q&A'])
    };
  }

  function getSelectedEvaluationId(settings, challengeType) {
    const map = normalizeEvaluationMap(
      settings?.dresEvaluationIdByChallenge ?? settings?.dresEvaluationIdsByChallenge
    );
    if (!CHALLENGE_TYPES.includes(challengeType)) return '';
    return String(map[challengeType] || map.KIS || map.AVS || map['Q&A'] || '').trim();
  }

  function normalizeVerdict(value) {
    const v = String(value ?? '').toUpperCase();
    if (v === 'CORRECT' || v === 'WRONG' || v === 'INDETERMINATE' || v === 'UNDECIDABLE') return v;
    if (v === 'PENDING') return 'PENDING';
    return '';
  }

  function toFiniteNumber(value) {
    if (value == null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function resolveFrameMiddleSeconds(frameObj) {
    if (!frameObj || typeof frameObj !== 'object') return null;
    const raw = frameObj?.raw && typeof frameObj.raw === 'object' ? frameObj.raw : {};
    const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

    const fromCurrentTime = toFiniteNumber(raw?.currentTime);
    if (fromCurrentTime != null && fromCurrentTime >= 0) return fromCurrentTime;

    const fromTimestamp = toFiniteNumber(
      frameObj?.timestamp
      ?? raw?.timestamp
      ?? frameObj?.hour_msb_middletime
      ?? raw?.hour_msb_middletime
      ?? metadata?.hour_msb_middletime
      ?? frameObj?.video_offset_seconds
      ?? raw?.video_offset_seconds
      ?? metadata?.video_offset_seconds
    );
    if (fromTimestamp != null && fromTimestamp >= 0) return fromTimestamp;

    return null;
  }

  function notifyVerdict(verdict, description = 'sent', prefix = 'DRES submission') {
    if (verdict === 'WRONG') {
      toasts.error(`${prefix} WRONG: ${description}`);
    } else if (verdict === 'PENDING') {
      toasts.warning(`${prefix} PENDING: ${description}`);
    } else if (verdict === 'INDETERMINATE' || verdict === 'UNDECIDABLE') {
      toasts.warning(`${prefix} ${verdict}: ${description}`);
    } else {
      toasts.success(`${prefix} OK: ${description}`);
    }
  }

  function isSuccessfulDresStatus(value) {
    if (value === true) return true;
    if (value === false || value == null) return false;

    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === 'ok' || normalized === 'success' || normalized === 'accepted' || normalized === '1';
  }

  function shouldSubmitFrameByImageId() {
    const profile = typeof getRuntimeProfile === 'function' ? getRuntimeProfile() : null;
    if (profile?.dres?.submitByImageId === true) return true;

    const normalizedMode = String(profile?.dres?.submitMode || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return normalizedMode === 'byimgid'
      || normalizedMode === 'byimageid'
      || normalizedMode === 'imgid'
      || normalizedMode === 'imageid'
      || normalizedMode === 'mediaitemname';
  }

  // ---- Low-level submit to DRES ----------------------------------------

  async function submitFrameToDres(frameObj, evaluationId) {
    try {
      const client = getClient();

      if (!client.getSessionId()) {
        await client.login();
      }

      const imgId = frameObj?.imgId;
      if (!imgId) {
        throw new Error('Missing imgId for DRES submission');
      }
      const submitByImageId = shouldSubmitFrameByImageId();

      const safeEvaluationId = String(evaluationId ?? '').trim();
      if (!safeEvaluationId) {
        throw new DresClientError('No evaluationId selected for current challenge.');
      }

      const submitByEvaluationId = async (evaluationId) => {
        try {
          if (submitByImageId) {
            return await client.submitResultByImgId(String(imgId), evaluationId);
          }

          const localMiddleSeconds = resolveFrameMiddleSeconds(frameObj);
          const middleSeconds = localMiddleSeconds != null
            ? localMiddleSeconds
            : (visioneAPI.supportsVideos ? await visioneAPI.getMiddleTimestamp(imgId) : 0);
          const timestampMs = Math.max(0, Math.round(Number(middleSeconds) * 1000));
          const videoId = String(frameObj?.videoId ?? String(imgId).split('-')[0]);

          return await client.submitResultByTime(videoId, timestampMs, timestampMs, evaluationId);
        } catch (submitError) {
          if (submitError instanceof DresClientError && submitError.statusCode === 401) {
            await client.login();
            if (submitByImageId) {
              return await client.submitResultByImgId(String(imgId), evaluationId);
            }

            const localMiddleSeconds = resolveFrameMiddleSeconds(frameObj);
            const middleSeconds = localMiddleSeconds != null
              ? localMiddleSeconds
              : (visioneAPI.supportsVideos ? await visioneAPI.getMiddleTimestamp(imgId) : 0);
            const timestampMs = Math.max(0, Math.round(Number(middleSeconds) * 1000));
            const videoId = String(frameObj?.videoId ?? String(imgId).split('-')[0]);

            return await client.submitResultByTime(videoId, timestampMs, timestampMs, evaluationId);
          }
          throw submitError;
        }
      };

      const response = await submitByEvaluationId(safeEvaluationId);

      if (!isSuccessfulDresStatus(response?.status)) {
        const rejectionDescription = response?.description ?? 'rejected';
        toasts.error(`DRES submission rejected (${safeEvaluationId}): ${rejectionDescription}`);
        return {
          accepted: false,
          verdict: normalizeVerdict(response?.submission),
          description: rejectionDescription,
          evaluationId: safeEvaluationId
        };
      }

      return {
        accepted: true,
        verdict: normalizeVerdict(response?.submission),
        description: `${response?.description ?? 'sent'}`,
        evaluationId: safeEvaluationId
      };
    } catch (error) {
      const message = error instanceof DresClientError || error instanceof Error
        ? error.message
        : 'Unknown error during DRES submission';
      toasts.error(`DRES submission failed: ${message}`);
      return { accepted: false, verdict: '', description: message, evaluationId: '' };
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

    const selectedEvaluationId = getSelectedEvaluationId(settings, challengeType);
    if (!selectedEvaluationId) {
      const message = `No evaluationId selected for ${challengeType}.`;
      toasts.error(message);
      onFrameSubmitEvent?.({ imgId, challengeType, accepted: false, reason: 'missing-evaluation-id', description: message });
      return { accepted: false, verdict: '', description: message, evaluationId: '' };
    }

    const dresResult = await submitFrameToDres(frameObj, selectedEvaluationId);
    if (!dresResult?.accepted) {
      onFrameSubmitEvent?.({
        imgId,
        challengeType,
        evaluationId: dresResult?.evaluationId || selectedEvaluationId,
        accepted: false,
        verdict: normalizeVerdict(dresResult?.verdict),
        description: dresResult?.description ?? ''
      });
      return {
        accepted: false,
        verdict: normalizeVerdict(dresResult?.verdict),
        description: dresResult?.description ?? 'Submission rejected',
        evaluationId: dresResult?.evaluationId || selectedEvaluationId
      };
    }

    const verdictForStore = normalizeVerdict(dresResult?.verdict) || 'PENDING';

    applySubmissionVerdict(imgId, verdictForStore);

    sessionStore.actions.submitFrame({
      imgId,
      frameObj: { ...frameObj, submissionVerdict: verdictForStore },
      markSubmitted: (id) => markSubmittedInViews(id)
    });

    const description = dresResult?.description ?? 'sent';
    notifyVerdict(verdictForStore, description, 'DRES submission');
    const response = {
      accepted: true,
      verdict: verdictForStore,
      description,
      evaluationId: dresResult?.evaluationId || selectedEvaluationId
    };
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

      const selectedEvaluationId = getSelectedEvaluationId(settings, challengeType);
      if (!selectedEvaluationId) {
        const message = `No evaluationId selected for ${challengeType}.`;
        toasts.error(message);
        sessionStore.actions.submitAnswer({ text: value, status: 'FAILED', verdict: '', description: message });
        const response = { accepted: false, verdict: '', description: message, evaluationId: '' };
        onTextSubmitEvent?.({ text: value, challengeType, ...response });
        return response;
      }

      const submitByEvaluationId = async (evaluationId) => {
        try {
          return await client.submitTextAnswer(value, evaluationId);
        } catch (submitError) {
          if (submitError instanceof DresClientError && submitError.statusCode === 401) {
            await client.login();
            return await client.submitTextAnswer(value, evaluationId);
          }
          throw submitError;
        }
      };

      const result = await submitByEvaluationId(selectedEvaluationId);

      if (!isSuccessfulDresStatus(result?.status)) {
        const rejectedDescription = result?.description ?? 'rejected';
        toasts.error(`DRES answer rejected (${selectedEvaluationId}): ${rejectedDescription}`);
        sessionStore.actions.submitAnswer({
          text: value,
          status: 'FAILED',
          verdict: normalizeVerdict(result?.submission),
          description: rejectedDescription
        });
        const response = {
          accepted: false,
          verdict: normalizeVerdict(result?.submission),
          description: rejectedDescription,
          evaluationId: selectedEvaluationId
        };
        onTextSubmitEvent?.({ text: value, challengeType, ...response });
        return response;
      }

      const verdict = normalizeVerdict(result?.submission);
      const description = `${result?.description ?? 'sent'}`;

      sessionStore.actions.submitAnswer({ text: value, status: 'SUBMITTED', verdict, description });
      if (verdict === 'WRONG') {
        toasts.error(`DRES answer WRONG: ${description}`);
      } else if (verdict === 'INDETERMINATE' || verdict === 'UNDECIDABLE') {
        toasts.warning(`DRES answer ${verdict}: ${description}`);
      } else {
        toasts.success(`DRES answer submitted: ${description}`);
      }

      const response = { accepted: true, verdict, description, evaluationId: selectedEvaluationId };
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
      toasts.success('DRES connected.');

      //  try { await client.logout(); } catch { /* ignore logout errors after test */ }
      return {
        ok: true,
        evaluations: []
      };
    } catch (error) {
      const message = error instanceof DresClientError || error instanceof Error
        ? error.message
        : 'Unknown error during DRES test';
      toasts.error(`DRES test failed: ${message}`);
      return {
        ok: false,
        evaluations: [],
        error: message
      };
    }
  }

  async function listEvaluations() {
    const settings = get(uiStore);
    if (!settings?.dresEnabled) return [];

    const client = getClient();
    if (!client.getSessionId()) {
      await client.login();
    }

    try {
      const evaluations = await client.listEvaluations();
      return Array.isArray(evaluations) ? evaluations : [];
    } catch (error) {
      if (error instanceof DresClientError && error.statusCode === 401) {
        await client.login();
        const retry = await client.listEvaluations();
        return Array.isArray(retry) ? retry : [];
      }
      throw error;
    }
  }

  return {
    submitByImgId,
    submitTextAnswer,
    testConnection,
    listEvaluations,
    applySubmissionVerdict,
    getClient
  };
}
