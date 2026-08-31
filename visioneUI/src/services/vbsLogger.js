import { findResultsArray } from '../utils/results';

const DB_NAME = 'visione-vbs-logs';
const DB_VERSION = 1;
const STORE_LOGS = 'logs';

const MIN_RESULT_LOG_LIMIT = 100;
const MAX_RESULT_LOG_LIMIT = 10000;
const DEFAULT_RESULT_LOG_LIMIT = MAX_RESULT_LOG_LIMIT;

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function toUnixMs(value = Date.now()) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : Date.now();
}

function sanitizeSegment(value, fallback = 'unknown-user') {
  const v = String(value || '').trim();
  if (!v) return fallback;
  return v.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;
}

function normalizeChallengeType(value) {
  const t = String(value || '').toUpperCase();
  if (t === 'AVS') return 'AVS';
  if (t === 'Q&A' || t === 'QA') return 'Q&A';
  return 'KIS';
}

function modelToTextType(model) {
  const m = String(model || '').toLowerCase();
  if (!m) return 'custom';
  if (m.includes('asr')) return 'ASR';
  if (m.includes('ocr')) return 'OCR';
  if (m.includes('caption')) return 'caption';
  if (m.includes('object') || m.includes('yolo')) return 'localizedObject';
  if (m.includes('concept') || m.includes('clip') || m.includes('openclip')) return 'concept';
  return 'custom';
}

function modelToImageType(model, hasRf = false) {
  if (hasRf) return 'feedbackModel';
  const m = String(model || '').toLowerCase();
  if (!m) return 'globalFeatures';
  if (m.includes('local')) return 'localFeatures';
  return 'globalFeatures';
}

function buildQueryEvents({
  textareas = [],
  relevanceFeedback = null,
  timestamp = Date.now(),
  temporalWindowSeconds = undefined,
  buildSearchPayload = null
}) {
  const ts = toUnixMs(timestamp);
  const events = [];

  let queryPayload = null;
  if (typeof buildSearchPayload === 'function') {
    try {
      queryPayload = buildSearchPayload(textareas, relevanceFeedback, temporalWindowSeconds);
    } catch {
      queryPayload = null;
    }
  }

  if (queryPayload) {
    events.push({
      timestamp: ts,
      category: 'Visione query',
      type: '',
      value: queryPayload
    });
  }

  // TEXT and IMAGE query logs are intentionally disabled while the full Visione query event is evaluated.

  return events;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        const store = db.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_user_ts', ['userFolder', 'timestamp'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB.'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
  });
}

function readAllByUser(db, userFolder) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readonly');
    const store = tx.objectStore(STORE_LOGS);
    const index = store.index('by_user_ts');
    const range = IDBKeyRange.bound([userFolder, 0], [userFolder, Number.MAX_SAFE_INTEGER]);
    const req = index.getAll(range);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Failed to read logs from IndexedDB.'));
  });
}

function deleteAllByUser(db, userFolder) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const index = store.index('by_user_ts');
    const range = IDBKeyRange.bound([userFolder, 0], [userFolder, Number.MAX_SAFE_INTEGER]);

    let deleted = 0;
    const req = index.openCursor(range);

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(deleted);
        return;
      }
      store.delete(cursor.primaryKey);
      deleted += 1;
      cursor.continue();
    };

    req.onerror = () => reject(req.error || new Error('Failed to delete logs from IndexedDB.'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed while deleting logs.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted while deleting logs.'));
  });
}

async function saveEntry(db, entry) {
  const tx = db.transaction(STORE_LOGS, 'readwrite');
  tx.objectStore(STORE_LOGS).add(entry);
  await txDone(tx);
}

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDateForFilename(timestamp = Date.now()) {
  const d = new Date(toUnixMs(timestamp));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}_${hh}${mm}${ss}`;
}

function toCompetitionPayload(rawPayload, filenameTimestamp) {
  const ts = toUnixMs(filenameTimestamp);
  const events = Array.isArray(rawPayload?.events) ? rawPayload.events : [];
  const results = Array.isArray(rawPayload?.results) ? rawPayload.results : [];

  const base = {
    timestamp: ts,
    sortType: String(rawPayload?.sortType || 'feedbackModel'),
    source: String(rawPayload?.source || 'rankingModel'),
    resultSetAvailability: String(rawPayload?.resultSetAvailability || 'all'),
    events,
    results
  };

  const teamId = String(rawPayload?.teamId || '').trim();
  const memberId = String(rawPayload?.memberId || '').trim();
  if (teamId) base.teamId = teamId;
  if (memberId) base.memberId = memberId;

  return base;
}

export function createVbsLogger() {
  let dbPromise = null;
  let loggerOptions = {
    resultLimit: DEFAULT_RESULT_LOG_LIMIT
  };
  let sessionContext = {
    sessionId: '',
    teamId: '',
    memberId: '',
    challengeType: 'KIS',
    userFolder: 'unknown-user'
  };

  function ensureDb() {
    if (!isBrowser()) return null;
    if (!dbPromise) dbPromise = openDb();
    return dbPromise;
  }

  async function initSession(context = {}) {
    if (!isBrowser()) return;

    const sessionId = String(context.sessionId || `local-${Date.now()}`);
    const userFolder = sanitizeSegment(context.userFolder || context.username || context.memberId || 'unknown-user');

    sessionContext = {
      sessionId,
      teamId: String(context.teamId || ''),
      memberId: String(context.memberId || ''),
      challengeType: normalizeChallengeType(context.challengeType),
      userFolder
    };

    const db = await ensureDb();
    if (!db) return;

    const now = Date.now();
    const payload = {
      timestamp: toUnixMs(now),
      teamId: sessionContext.teamId,
      memberId: sessionContext.memberId,
      sessionId: sessionContext.sessionId,
      type: 'interaction',
      challengeType: sessionContext.challengeType,
      events: [
        {
          timestamp: toUnixMs(now),
          category: 'OTHER',
          type: 'sessionStart',
          value: `challenge:${sessionContext.challengeType}`
        }
      ],
      results: []
    };

    await saveEntry(db, {
      userFolder: sessionContext.userFolder,
      timestamp: payload.timestamp,
      filenameTimestamp: payload.timestamp,
      payload
    });
  }

  async function logResultSet({
    textareas = [],
    relevanceFeedback = null,
    resultSet,
    sortType = 'feedbackModel',
    source = 'rankingModel',
    resultSetAvailability = 'all',
    maxResults,
    timestamp = Date.now(),
    temporalWindowSeconds = undefined,
    buildSearchPayload = null,
    metadata = {}
  }) {
    const db = await ensureDb();
    if (!db) return;

    const ts = toUnixMs(timestamp);
    const raw = findResultsArray(resultSet) || [];
    const resolvedLimit = Number(maxResults ?? loggerOptions.resultLimit);
    const boundedLimit = Math.min(MAX_RESULT_LOG_LIMIT, Math.max(MIN_RESULT_LOG_LIMIT, Number.isFinite(resolvedLimit) ? resolvedLimit : DEFAULT_RESULT_LOG_LIMIT));
    const results = raw.slice(0, boundedLimit);
    const events = buildQueryEvents({ textareas, relevanceFeedback, timestamp: ts, temporalWindowSeconds, buildSearchPayload });

    const payload = {
      timestamp: ts,
      teamId: sessionContext.teamId,
      memberId: sessionContext.memberId,
      sessionId: sessionContext.sessionId,
      type: 'result',
      challengeType: sessionContext.challengeType,
      sortType,
      source,
      resultSetAvailability,
      events,
      results,
      metadata
    };

    await saveEntry(db, {
      userFolder: sessionContext.userFolder,
      timestamp: ts,
      filenameTimestamp: ts,
      payload
    });
  }

  async function logInteractionEvent({ category = 'OTHER', type = 'custom', value = '', timestamp = Date.now(), extra = {} }) {
    const db = await ensureDb();
    if (!db) return;

    const ts = toUnixMs(timestamp);
    const payload = {
      timestamp: ts,
      teamId: sessionContext.teamId,
      memberId: sessionContext.memberId,
      sessionId: sessionContext.sessionId,
      type: 'interaction',
      challengeType: sessionContext.challengeType,
      events: [
        {
          timestamp: ts,
          category,
          type,
          value: String(value || '')
        }
      ],
      results: [],
      ...extra
    };

    await saveEntry(db, {
      userFolder: sessionContext.userFolder,
      timestamp: ts,
      filenameTimestamp: ts,
      payload
    });
  }

  async function countForCurrentUser() {
    const db = await ensureDb();
    if (!db) return 0;
    const rows = await readAllByUser(db, sessionContext.userFolder);
    return rows.length;
  }

  async function exportForCurrentUser() {
    const db = await ensureDb();
    if (!db) return { exported: 0, mode: 'none' };

    const rows = await readAllByUser(db, sessionContext.userFolder);
    if (!rows.length) {
      return { exported: 0, mode: 'empty', userFolder: sessionContext.userFolder };
    }

    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const root = await window.showDirectoryPicker({
          mode: 'readwrite',
          id: 'visione-vbs-export',
          startIn: 'downloads'
        });
        const userDir = await root.getDirectoryHandle(sessionContext.userFolder, { create: true });

        const usedNames = new Set();
        for (const row of rows) {
          let fileName = `${toUnixMs(row.filenameTimestamp)}.json`;
          let suffix = 1;
          while (usedNames.has(fileName)) {
            fileName = `${toUnixMs(row.filenameTimestamp)}_${suffix}.json`;
            suffix += 1;
          }
          usedNames.add(fileName);

          const competitionPayload = toCompetitionPayload(row.payload, row.filenameTimestamp);

          const fileHandle = await userDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(competitionPayload, null, 2));
          await writable.close();
        }

        return { exported: rows.length, mode: 'directory', userFolder: sessionContext.userFolder };
      } catch (error) {
        const isUserAbort = error && (error.name === 'AbortError' || error.name === 'NotAllowedError');
        if (isUserAbort) {
          return { exported: 0, mode: 'cancelled', userFolder: sessionContext.userFolder };
        }
        // Fall through to single-file fallback when directory access is blocked by browser/OS policy.
      }
    }

    const fallbackFile = `visione_logs_${formatDateForFilename()}.json`;
    triggerDownload(
      fallbackFile,
      JSON.stringify(
        {
          userFolder: sessionContext.userFolder,
          count: rows.length,
          files: rows.map((row) => ({
            fileName: `${toUnixMs(row.filenameTimestamp)}.json`,
            content: toCompetitionPayload(row.payload, row.filenameTimestamp)
          }))
        },
        null,
        2
      )
    );

    return { exported: rows.length, mode: 'fallback-file', userFolder: sessionContext.userFolder };
  }

  async function deleteForCurrentUser() {
    const db = await ensureDb();
    if (!db) return { deleted: 0, mode: 'none', userFolder: sessionContext.userFolder };

    const deleted = await deleteAllByUser(db, sessionContext.userFolder);
    return { deleted, mode: 'indexeddb', userFolder: sessionContext.userFolder };
  }

  return {
    setOptions: (next = {}) => {
      const parsed = Number(next?.resultLimit);
      if (Number.isFinite(parsed)) {
        loggerOptions.resultLimit = Math.min(MAX_RESULT_LOG_LIMIT, Math.max(MIN_RESULT_LOG_LIMIT, Math.floor(parsed)));
      }
    },
    initSession,
    logResultSet,
    logInteractionEvent,
    countForCurrentUser,
    exportForCurrentUser,
    deleteForCurrentUser,
    getUserFolder: () => sessionContext.userFolder
  };
}
