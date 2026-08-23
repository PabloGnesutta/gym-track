import { ServiceError } from './ServiceError.js';


/**
 * @typedef {object} ExerciseRow
 * @property {number} id
 * @property {string[]} muscles
 * @property {string} name
 * @property {number} createdAt
 * @property {number} updatedAt
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
   * @param {number} userId
   */
  function listExercises(userId) {
    const rows = db.prepare('SELECT * FROM exercises WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    return rows.map(toExercise);
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
