import { apiAddSet, apiCreateExercise, apiUpdateSession } from "../api-caller/apiCaller.js";


/**
 * @typedef {object} ImportBatch
 * @property {any[]} exercises
 * @property {any[]} sessions
 */

/**
 * Uploads a batch of exercises/sessions in the old locally-keyed shape (as
 * read from IndexedDB - each record carries `_key` and, for sessions, an
 * `exerciseKey` foreign-key reference, with `Date` instances for date
 * fields) to the backend, in dependency order: exercises first, then
 * sessions. Builds an old-key -> new-server-id map and rewrites each
 * session's exerciseKey before posting, since the server assigns its own ids.
 *
 * Each session is recreated via one `sessions/addSet` call (to create it on
 * the right calendar day) followed by one `sessions/update` call (to
 * overwrite it with the session's exact original `sets`/`notes`) - the
 * backend has no bulk "create session with these exact sets" endpoint, so
 * this two-step replay is how an already-grouped session gets reproduced
 * exactly, rather than replayed rep-by-rep through addSet's own same-day/
 * same-weight grouping logic (which is designed for one-set-at-a-time live
 * entry, not bulk replay).
 *
 * Best-effort: skips (rather than aborting) a session if its exercise
 * failed to import, and returns a summary rather than throwing. This is a
 * one-time convenience for pre-existing local data, not a guaranteed
 * lossless migration.
 * @param {ImportBatch} batch
 * @returns {Promise<{exercises: number, sessions: number}>}
 */
async function importBatch({ exercises, sessions }) {
  /** @type {Map<number, number>} */
  const exerciseIdMap = new Map();
  const counts = { exercises: 0, sessions: 0 };

  for (const exercise of exercises) {
    const created = await apiCreateExercise(exercise.name, exercise.muscles || []);
    if (!created.data) { continue; }
    exerciseIdMap.set(exercise._key, created.data.id);
    counts.exercises++;
  }

  // Oldest first, so each exercise's server-side lastSession/updatedAt end
  // up matching its most recently dated session, same as if the sessions
  // had been entered live in that order.
  const orderedSessions = sessions.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const session of orderedSessions) {
    const newExerciseId = exerciseIdMap.get(session.exerciseKey);
    if (newExerciseId == null || !session.sets || !session.sets.length) { continue; }

    const firstRow = session.sets[0];
    const created = await apiAddSet(newExerciseId, {
      weight: firstRow.w,
      reps: firstRow.r[0],
      date: session.date.getTime(),
    });
    if (!created.data) { continue; }

    const updated = await apiUpdateSession(created.data.id, { sets: session.sets, notes: session.notes || '' });
    if (updated.data) { counts.sessions++; }
  }

  return counts;
}


export { importBatch };
