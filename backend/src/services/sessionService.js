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
 * Not wired to any HTTP route yet - see CLAUDE.md's "Server-side database
 * (scaffolding)" section. Mirrors `frontend/js/local-db/set-db.js`'s
 * `createSet`/`getSessionsForExercise`/`deleteSession`, adapted for SQL.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createSessionService(db) {
  /**
   * @param {number} exerciseId
   */
  function assertExerciseExists(exerciseId) {
    const exists = db.prepare('SELECT 1 FROM exercises WHERE id = ?').get(exerciseId);
    if (!exists) { throw new ServiceError('Ejercicio no encontrado'); }
  }

  /**
   * Appends a set to today's Session for the Exercise, creating it if it
   * doesn't exist yet. Within a Session, sets sharing the same weight are
   * grouped into one row's `r` array - same rule as `createSet` client-side.
   * @param {number} exerciseId
   * @param {{weight: number, reps: number}} setData
   * @param {number} [date] Epoch ms; defaults to now.
   */
  function addSet(exerciseId, setData, date = Date.now()) {
    assertExerciseExists(exerciseId);

    const existing = db.prepare(
      'SELECT * FROM sessions WHERE exercise_id = ? ORDER BY date DESC LIMIT 1'
    ).get(exerciseId);

    const now = Date.now();

    if (existing && isSameDay(Number(existing.date), date)) {
      const session = toSession(existing);
      let weightRow = session.sets.find(row => row.w === setData.weight);
      if (!weightRow) {
        weightRow = { w: setData.weight, r: [] };
        session.sets.push(weightRow);
      }
      weightRow.r.push(setData.reps);

      db.prepare('UPDATE sessions SET sets = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(session.sets), now, session.id);

      return getSession(session.id);
    }

    const sets = [{ w: setData.weight, r: [setData.reps] }];
    const info = db.prepare(
      'INSERT INTO sessions (exercise_id, date, sets, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(exerciseId, date, JSON.stringify(sets), '', now, now);

    return getSession(Number(info.lastInsertRowid));
  }

  /**
   * @param {number} id
   */
  function getSession(id) {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) { throw new ServiceError('Sesión no encontrada'); }
    return toSession(row);
  }

  /**
   * @param {number} exerciseId
   */
  function listSessionsForExercise(exerciseId) {
    assertExerciseExists(exerciseId);
    const rows = db.prepare('SELECT * FROM sessions WHERE exercise_id = ? ORDER BY date DESC').all(exerciseId);
    return rows.map(toSession);
  }

  /**
   * Full replace of a Session's sets/notes, mirroring `set-ui.js`'s
   * `submitSession` (which overwrites `session.sets` wholesale from the
   * edit form rather than patching individual rows).
   * @param {number} id
   * @param {{sets?: WeightRow[], notes?: string}} patch
   */
  function updateSession(id, patch) {
    const session = getSession(id);
    const sets = patch.sets !== undefined ? patch.sets : session.sets;
    const notes = patch.notes !== undefined ? patch.notes : session.notes;
    const now = Date.now();

    db.prepare('UPDATE sessions SET sets = ?, notes = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(sets), notes, now, id);

    return getSession(id);
  }

  /**
   * @param {number} id
   */
  function deleteSession(id) {
    getSession(id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  return { addSet, getSession, listSessionsForExercise, updateSession, deleteSession };
}

export { createSessionService };
