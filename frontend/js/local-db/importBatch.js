import { apiAddSet, apiCreateExercise, apiFetchExercises, apiFetchSessions, apiUpdateSession } from "../api-caller/apiCaller.js";
import { toYYYYMMDD } from "../lib/date.js";


/**
 * @typedef {object} ImportBatch
 * @property {any[]} exercises
 * @property {any[]} sessions
 */

const REQUEST_PACING_MS = 120;
const RATE_LIMIT_BACKOFF_MS = 2000;

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Paces every write in the import at least `REQUEST_PACING_MS` apart, and on
 * a 429/503 (rate-limited/overloaded) response specifically, waits longer
 * and retries once before giving up. Exists because a real import once
 * silently lost most of its data (see `legacyImport.js`'s own header
 * comment) - a request-rate cap on whatever's in front of the API (a
 * reverse proxy, say) is a plausible cause, since unlike a randomly flaky
 * connection it would explain a *consistent* partial-success pattern:
 * everything up to some request-count threshold succeeds, everything after
 * it doesn't. Fixed delays rather than reading a `Retry-After` header only
 * because `apiCall()` doesn't currently surface response headers, just
 * status.
 * @param {() => Promise<import('../api-caller/apiCaller.js').ApiCallResult>} fn
 */
async function callThrottled(fn) {
  await sleep(REQUEST_PACING_MS);
  const result = await fn();
  if (result.error && (result.status === 429 || result.status === 503)) {
    await sleep(RATE_LIMIT_BACKOFF_MS);
    return fn();
  }
  return result;
}

/**
 * @typedef {object} ImportCounts
 * @property {number} exercisesCreated
 * @property {number} exercisesReused
 * @property {number} exercisesFailed
 * @property {number} sessionsCreated
 * @property {number} sessionsSkipped
 * @property {number} sessionsFailed
 */

/**
 * Uploads a batch of exercises/sessions in the old locally-keyed shape (as
 * read from IndexedDB - each record carries `_key` and, for sessions, an
 * `exerciseKey` foreign-key reference, with `Date` instances for date
 * fields) to the backend, in dependency order: exercises first, then
 * sessions. Builds an old-key -> new-server-id map and rewrites each
 * session's exerciseKey before posting, since the server assigns its own ids.
 *
 * Deliberately idempotent - safe to call more than once for the same
 * account, which matters because `apiCall()` (apiCaller.js) never throws:
 * a dropped connection just resolves to `{error}` and the loop moves on, so
 * a flaky connection (the realistic case this exists for - a phone
 * uploading months of history) can silently fail partway through. Before
 * doing any writes, this fetches what the account *already* has
 * (`apiFetchExercises`/`apiFetchSessions`) and only creates what's missing:
 * an exercise already present by name is reused rather than re-created
 * (re-creating would fail anyway - names are unique per account - which is
 * exactly what silently orphaned every session under it on a naive retry
 * before this fix), and a session already present for a given exercise+day
 * is skipped rather than re-added (re-adding would duplicate that day's
 * sets, since `sessions/addSet` always appends).
 *
 * Each new session is recreated via one `sessions/addSet` call (to create
 * it on the right calendar day) followed by one `sessions/update` call (to
 * overwrite it with the session's exact original `sets`/`notes`) - the
 * backend has no bulk "create session with these exact sets" endpoint, so
 * this two-step replay is how an already-grouped session gets reproduced
 * exactly, rather than replayed rep-by-rep through addSet's own same-day/
 * same-weight grouping logic (which is designed for one-set-at-a-time live
 * entry, not bulk replay).
 *
 * Best-effort per item (skips one that fails rather than aborting the rest)
 * but reports every failure in the returned counts, so the caller can
 * decide whether it's safe to consider this import "done" - see
 * `legacyImport.js`.
 * @param {ImportBatch} batch
 * @returns {Promise<ImportCounts>}
 */
async function importBatch({ exercises, sessions }) {
  const counts = {
    exercisesCreated: 0, exercisesReused: 0, exercisesFailed: 0,
    sessionsCreated: 0, sessionsSkipped: 0, sessionsFailed: 0,
  };

  const existingExercises = await apiFetchExercises();
  /** @type {Map<string, number>} old exercise name -> server id */
  const idByName = new Map((existingExercises.data || []).map(e => [e.name, e.id]));

  /** @type {Map<number, number>} old local _key -> server id */
  const exerciseIdMap = new Map();

  for (const exercise of exercises) {
    const existingId = idByName.get(exercise.name);
    if (existingId != null) {
      exerciseIdMap.set(exercise._key, existingId);
      counts.exercisesReused++;
      continue;
    }

    const created = await callThrottled(() => apiCreateExercise(exercise.name, exercise.muscles || []));
    if (!created.data) { counts.exercisesFailed++; continue; }
    exerciseIdMap.set(exercise._key, created.data.id);
    idByName.set(exercise.name, created.data.id);
    counts.exercisesCreated++;
  }

  // Grouped by exercise (rather than one global date-sorted list) so a
  // fetch-existing-sessions round trip happens once per exercise, not once
  // per session, and so an interruption partway through leaves whole
  // exercises' histories complete rather than scattering gaps across all of
  // them.
  /** @type {Map<number, any[]>} */
  const sessionsByOldExerciseKey = new Map();
  for (const session of sessions) {
    const list = sessionsByOldExerciseKey.get(session.exerciseKey) || [];
    list.push(session);
    sessionsByOldExerciseKey.set(session.exerciseKey, list);
  }

  for (const [oldExerciseKey, exerciseSessions] of sessionsByOldExerciseKey) {
    const newExerciseId = exerciseIdMap.get(oldExerciseKey);
    if (newExerciseId == null) { continue; }

    const existing = await apiFetchSessions(newExerciseId);
    const existingDays = new Set((existing.data || []).map(s => toYYYYMMDD(new Date(s.date))));

    // Oldest first, so this exercise's server-side lastSession/updatedAt end
    // up matching its most recently dated session, same as if the sessions
    // had been entered live in that order.
    const ordered = exerciseSessions.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const session of ordered) {
      if (!session.sets || !session.sets.length) { continue; }
      const day = toYYYYMMDD(session.date);
      if (existingDays.has(day)) { counts.sessionsSkipped++; continue; }

      const firstRow = session.sets[0];
      const created = await callThrottled(() => apiAddSet(newExerciseId, {
        weight: firstRow.w,
        reps: firstRow.r[0],
        date: session.date.getTime(),
      }));
      if (!created.data) { counts.sessionsFailed++; continue; }

      const updated = await callThrottled(() => apiUpdateSession(created.data.id, { sets: session.sets, notes: session.notes || '' }));
      if (updated.data) {
        counts.sessionsCreated++;
        existingDays.add(day);
      } else {
        counts.sessionsFailed++;
      }
    }
  }

  return counts;
}


export { importBatch };
