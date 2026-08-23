import { ServiceError } from './ServiceError.js';


/**
 * @typedef {object} ExerciseRow
 * @property {number} id
 * @property {string} name
 * @property {string[]} muscles
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
 * Not wired to any HTTP route yet - see CLAUDE.md's "Server-side database
 * (scaffolding)" section. Mirrors the validation/shape of
 * `frontend/js/local-db/exercise-db.js`'s `createExercise`/`updateExercise`/
 * `fetchExercises`/`deleteExercise`, adapted for SQL instead of IndexedDB.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createExerciseService(db) {
  /**
   * @param {string} name
   * @param {string[]} [muscles]
   */
  function createExercise(name, muscles = []) {
    name = String(name || '').trim();
    if (!name) { throw new ServiceError('Ingresar nombre'); }

    const existing = db.prepare('SELECT 1 FROM exercises WHERE name = ?').get(name);
    if (existing) { throw new ServiceError(`El ejercicio "${name}" ya existe`); }

    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO exercises (name, muscles, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(name, muscles.join(','), now, now);

    return toExercise({
      id: info.lastInsertRowid, name, muscles: muscles.join(','), created_at: now, updated_at: now,
    });
  }

  /**
   * @param {number} id
   */
  function getExercise(id) {
    const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
    if (!row) { throw new ServiceError('Ejercicio no encontrado'); }
    return toExercise(row);
  }

  function listExercises() {
    const rows = db.prepare('SELECT * FROM exercises ORDER BY updated_at DESC').all();
    return rows.map(toExercise);
  }

  /**
   * @param {number} id
   * @param {{name?: string, muscles?: string[]}} patch
   */
  function updateExercise(id, patch) {
    const exercise = getExercise(id);

    const name = patch.name !== undefined ? String(patch.name).trim() : exercise.name;
    if (!name) { throw new ServiceError('Ingresar nombre'); }
    if (name !== exercise.name) {
      const collision = db.prepare('SELECT 1 FROM exercises WHERE name = ? AND id != ?').get(name, id);
      if (collision) { throw new ServiceError(`El ejercicio "${name}" ya existe`); }
    }

    const muscles = patch.muscles !== undefined ? patch.muscles : exercise.muscles;
    const now = Date.now();

    db.prepare('UPDATE exercises SET name = ?, muscles = ?, updated_at = ? WHERE id = ?')
      .run(name, muscles.join(','), now, id);

    return getExercise(id);
  }

  /**
   * Also removes every Session belonging to this Exercise, mirroring
   * `exercise-ui.js`'s `tryDeleteExercise` calling both `deleteExercise` and
   * `deleteExerciseSessions` client-side.
   * @param {number} id
   */
  function deleteExercise(id) {
    getExercise(id);
    db.prepare('DELETE FROM sessions WHERE exercise_id = ?').run(id);
    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
  }

  return { createExercise, getExercise, listExercises, updateExercise, deleteExercise };
}

export { createExerciseService };
