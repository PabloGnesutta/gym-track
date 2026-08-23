import { ServiceError } from './ServiceError.js';


/**
 * @typedef {{ w: number, r: number[] }} WeightRow
 * @typedef {object} LastSession
 * @property {number} id
 * @property {number} date
 * @property {WeightRow[]} sets
 * @property {string} notes
 *
 * @typedef {object} ExerciseRow
 * @property {number} id
 * @property {string[]} muscles
 * @property {string} name
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {LastSession | null} [lastSession]
 */

/**
 * @param {*} row
 * @returns {ExerciseRow}
 */
function toExercise(row) {
  return {
    id: Number(row.id),
    name: row.name,
    muscles: row.muscles ? row.muscles.split(',').filter(Boolean) : [],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Only the fields `exercise-db.js`'s `lastSession` denormalization actually
 * needs for list rendering (see `listExercises` below) - not the full
 * `sessionService.js#toSession` shape, to avoid an exerciseService <->
 * sessionService import cycle for a handful of duplicated lines.
 * @param {*} row
 * @returns {LastSession}
 */
function toLastSession(row) {
  return {
    id: Number(row.ls_id),
    date: Number(row.ls_date),
    sets: JSON.parse(row.ls_sets),
    notes: row.ls_notes || '',
  };
}

/**
 * Mirrors the validation/shape of `frontend/js/local-db/exercise-db.js`'s
 * `createExercise`/`updateExercise`/`fetchExercises`/`deleteExercise`,
 * adapted for SQL instead of IndexedDB, and scoped by `userId` the same way
 * `vehicleService.js`'s `getOwnedVehicleRow` scopes vehicles.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createExerciseService(db) {
  /**
   * @param {number} userId
   * @param {number} exerciseId
   */
  function getOwnedExerciseRow(userId, exerciseId) {
    const row = db.prepare('SELECT * FROM exercises WHERE id = ? AND user_id = ?').get(exerciseId, userId);
    if (!row) { throw new ServiceError('Ejercicio no encontrado'); }
    return row;
  }

  /**
   * @param {number} userId
   * @param {string} name
   * @param {string[]} [muscles]
   */
  function createExercise(userId, name, muscles = []) {
    name = String(name || '').trim();
    if (!name) { throw new ServiceError('Ingresar nombre'); }

    const existing = db.prepare('SELECT 1 FROM exercises WHERE user_id = ? AND name = ?').get(userId, name);
    if (existing) { throw new ServiceError(`El ejercicio "${name}" ya existe`); }

    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO exercises (user_id, name, muscles, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, name, muscles.join(','), now, now);

    return toExercise({
      id: info.lastInsertRowid, name, muscles: muscles.join(','), created_at: now, updated_at: now,
    });
  }

  /**
   * @param {number} userId
   * @param {number} id
   */
  function getExercise(userId, id) {
    return toExercise(getOwnedExerciseRow(userId, id));
  }

  /**
   * Each exercise's most recent Session (if any) is joined in directly via a
   * correlated subquery, so the client's list view (which shows "40kg x 10 -
   * hace 2 días" per row, same as the old IndexedDB-denormalized
   * `exercise.lastSession`) doesn't need a separate round trip per exercise.
   * @param {number} userId
   */
  function listExercises(userId) {
    const rows = db.prepare(
      `SELECT e.*, ls.id as ls_id, ls.date as ls_date, ls.sets as ls_sets, ls.notes as ls_notes
       FROM exercises e
       LEFT JOIN sessions ls ON ls.id = (
         SELECT s.id FROM sessions s WHERE s.exercise_id = e.id ORDER BY s.date DESC LIMIT 1
       )
       WHERE e.user_id = ?
       ORDER BY e.updated_at DESC`
    ).all(userId);
    return rows.map(row => ({
      ...toExercise(row),
      lastSession: row.ls_id != null ? toLastSession(row) : null,
    }));
  }

  /**
   * @param {number} userId
   * @param {number} id
   * @param {{name?: string, muscles?: string[]}} patch
   */
  function updateExercise(userId, id, patch) {
    const exercise = getExercise(userId, id);

    const name = patch.name !== undefined ? String(patch.name).trim() : exercise.name;
    if (!name) { throw new ServiceError('Ingresar nombre'); }
    if (name !== exercise.name) {
      const collision = db.prepare('SELECT 1 FROM exercises WHERE user_id = ? AND name = ? AND id != ?').get(userId, name, id);
      if (collision) { throw new ServiceError(`El ejercicio "${name}" ya existe`); }
    }

    const muscles = patch.muscles !== undefined ? patch.muscles : exercise.muscles;
    const now = Date.now();

    db.prepare('UPDATE exercises SET name = ?, muscles = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(name, muscles.join(','), now, id, userId);

    return getExercise(userId, id);
  }

  /**
   * Also removes every Session belonging to this Exercise, mirroring
   * `exercise-ui.js`'s `tryDeleteExercise` calling both `deleteExercise` and
   * `deleteExerciseSessions` client-side.
   * @param {number} userId
   * @param {number} id
   */
  function deleteExercise(userId, id) {
    getOwnedExerciseRow(userId, id);
    db.prepare('DELETE FROM sessions WHERE exercise_id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM exercises WHERE id = ? AND user_id = ?').run(id, userId);
  }

  return { createExercise, getExercise, listExercises, updateExercise, deleteExercise, getOwnedExerciseRow };
}

export { createExerciseService };
