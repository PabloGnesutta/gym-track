import { createExerciseService } from './exerciseService.js';
import { ServiceError } from './ServiceError.js';


/**
 * @typedef {{ w: number, r: number[] }} WeightRow
 * @typedef {object} SessionRow
 * @property {number} id
 * @property {number} exerciseId
 * @property {number} date
 * @property {WeightRow[]} sets
 * @property {string} notes
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @param {*} row
 * @returns {SessionRow}
 */
function toSession(row) {
  return {
    id: Number(row.id),
    exerciseId: Number(row.exercise_id),
    date: Number(row.date),
    sets: JSON.parse(row.sets),
    notes: row.notes || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * True if both epoch-ms timestamps fall on the same local calendar day -
 * mirrors `frontend/js/lib/date.js`'s `toYYYYMMDD` comparison, which is how
 * `set-db.js`'s `createSet` decides whether a new Set belongs to today's
 * Session or starts a new one.
 * @param {number} a
 * @param {number} b
 */
function isSameDay(a, b) {
  const da = new Date(a);
  const db_ = new Date(b);
  return da.getFullYear() === db_.getFullYear()
    && da.getMonth() === db_.getMonth()
    && da.getDate() === db_.getDate();
}

/**
 * Mirrors `frontend/js/local-db/set-db.js`'s `createSet`/
 * `getSessionsForExercise`/`deleteSession`, adapted for SQL and scoped by
 * `userId`. Takes an `exerciseService` (defaulting to a real one over the
 * same `db`) purely so ownership checks go through
 * `getOwnedExerciseRow` instead of duplicating that query here - same
 * cross-service reuse shape as fridge-track's `syncService` reusing
 * `homeService`'s `assertHomeMembership`.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {ReturnType<typeof createExerciseService>} [exerciseService]
 */
function createSessionService(db, exerciseService = createExerciseService(db)) {
  /**
   * Appends a set to today's Session for the Exercise, creating it if it
   * doesn't exist yet. Within a Session, sets sharing the same weight are
   * grouped into one row's `r` array - same rule as `createSet` client-side.
   * @param {number} userId
   * @param {number} exerciseId
   * @param {{weight: number, reps: number}} setData
   * @param {number} [date] Epoch ms; defaults to now.
   */
  function addSet(userId, exerciseId, setData, date = Date.now()) {
    exerciseService.getOwnedExerciseRow(userId, exerciseId);

    const existing = db.prepare(
      'SELECT * FROM sessions WHERE exercise_id = ? AND user_id = ? ORDER BY date DESC LIMIT 1'
    ).get(exerciseId, userId);

    const now = Date.now();
    // Mirrors the old client-side createSet's own `updateExercise(exercise,
    // null, null, date)` call - touches only updated_at (not name/muscles),
    // using the *set's* date (not necessarily "now") - same as before, so
    // the exercise list's "most recently used first" sort keeps working now
    // that the timestamp lives server-side.
    db.prepare('UPDATE exercises SET updated_at = ? WHERE id = ? AND user_id = ?').run(date, exerciseId, userId);

    if (existing && isSameDay(Number(existing.date), date)) {
      const session = toSession(existing);
      let weightRow = session.sets.find(row => row.w === setData.weight);
      if (!weightRow) {
        weightRow = { w: setData.weight, r: [] };
        session.sets.push(weightRow);
      }
      weightRow.r.push(setData.reps);

      db.prepare('UPDATE sessions SET sets = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(JSON.stringify(session.sets), now, session.id, userId);

      return getSession(userId, session.id);
    }

    const sets = [{ w: setData.weight, r: [setData.reps] }];
    const info = db.prepare(
      'INSERT INTO sessions (user_id, exercise_id, date, sets, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, exerciseId, date, JSON.stringify(sets), '', now, now);

    return getSession(userId, Number(info.lastInsertRowid));
  }

  /**
   * @param {number} userId
   * @param {number} id
   */
  function getSession(userId, id) {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) { throw new ServiceError('Sesión no encontrada'); }
    return toSession(row);
  }

  /**
   * @param {number} userId
   * @param {number} exerciseId
   */
  function listSessionsForExercise(userId, exerciseId) {
    exerciseService.getOwnedExerciseRow(userId, exerciseId);
    const rows = db.prepare('SELECT * FROM sessions WHERE exercise_id = ? AND user_id = ? ORDER BY date DESC').all(exerciseId, userId);
    return rows.map(toSession);
  }

  /**
   * Full replace of a Session's sets/notes, mirroring `set-ui.js`'s
   * `submitSession` (which overwrites `session.sets` wholesale from the
   * edit form rather than patching individual rows).
   * @param {number} userId
   * @param {number} id
   * @param {{sets?: WeightRow[], notes?: string}} patch
   */
  function updateSession(userId, id, patch) {
    const session = getSession(userId, id);
    const sets = patch.sets !== undefined ? patch.sets : session.sets;
    const notes = patch.notes !== undefined ? patch.notes : session.notes;
    const now = Date.now();

    db.prepare('UPDATE sessions SET sets = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(sets), notes, now, id, userId);

    return getSession(userId, id);
  }

  /**
   * @param {number} userId
   * @param {number} id
   */
  function deleteSession(userId, id) {
    getSession(userId, id);
    db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId);
  }

  return { addSet, getSession, listSessionsForExercise, updateSession, deleteSession };
}

export { createSessionService };
