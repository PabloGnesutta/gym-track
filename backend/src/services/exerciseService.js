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
 * @property {boolean} isFavorite
 * @property {LastSession | null} [lastSession]
 */

/**
 * @param {*} row
 * @param {string[]} muscles
 * @returns {ExerciseRow}
 */
function toExercise(row, muscles) {
  return {
    id: Number(row.id),
    name: row.name,
    muscles,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    isFavorite: !!row.is_favorite,
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
 * Trim + locale-aware lowercase, the canonical form every `muscles.name` is
 * stored as - see migration `003_muscles.js`'s own header comment for why
 * this can't be done in raw SQL (SQLite's `LOWER()` is ASCII-only).
 * @param {string} tag
 */
function normalizeMuscle(tag) {
  return String(tag || '').trim().toLocaleLowerCase();
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
   * @param {number} exerciseId
   * @returns {string[]}
   */
  function getMusclesForExercise(exerciseId) {
    /** @type {{name: string}[]} */ // @ts-ignore
    const rows = db.prepare(
      `SELECT m.name FROM exercise_muscles em
       JOIN muscles m ON m.id = em.muscle_id
       WHERE em.exercise_id = ?
       ORDER BY m.name`
    ).all(exerciseId);
    return rows.map(row => row.name);
  }

  /**
   * Looks up or creates a canonical `muscles` row per tag for this user,
   * then links it to the exercise. Does *not* clear existing links first -
   * callers that want a full replace (`updateExercise`) do that themselves,
   * since `createExercise` never needs to.
   * @param {number} userId
   * @param {number} exerciseId
   * @param {string[]} muscles
   */
  function linkMuscles(userId, exerciseId, muscles) {
    const now = Date.now();
    const insertMuscle = db.prepare(
      'INSERT INTO muscles (user_id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id, name) DO NOTHING'
    );
    const getMuscleId = db.prepare('SELECT id FROM muscles WHERE user_id = ? AND name = ?');
    const linkExerciseMuscle = db.prepare(
      'INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id) VALUES (?, ?)'
    );

    const seen = new Set();
    for (const rawTag of muscles) {
      const tag = normalizeMuscle(rawTag);
      if (!tag || seen.has(tag)) { continue; }
      seen.add(tag);
      insertMuscle.run(userId, tag, now);
      /** @type {{id: number}} */ // @ts-ignore
      const muscleRow = getMuscleId.get(userId, tag);
      linkExerciseMuscle.run(exerciseId, muscleRow.id);
    }
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
      'INSERT INTO exercises (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(userId, name, now, now);
    const exerciseId = Number(info.lastInsertRowid);

    linkMuscles(userId, exerciseId, muscles);

    return getExercise(userId, exerciseId);
  }

  /**
   * @param {number} userId
   * @param {number} id
   */
  function getExercise(userId, id) {
    const row = getOwnedExerciseRow(userId, id);
    return toExercise(row, getMusclesForExercise(id));
  }

  /**
   * Each exercise's most recent Session (if any) and its muscle tags are
   * joined in directly (a correlated subquery for the session, a
   * `GROUP_CONCAT` subquery for the muscles - muscle names can never
   * contain a comma themselves, since they're split on comma at input), so
   * the client's list view doesn't need a separate round trip per exercise
   * for either.
   * @param {number} userId
   */
  function listExercises(userId) {
    const rows = db.prepare(
      `SELECT e.*,
         (SELECT GROUP_CONCAT(m.name) FROM exercise_muscles em
          JOIN muscles m ON m.id = em.muscle_id
          WHERE em.exercise_id = e.id) as muscle_names,
         ls.id as ls_id, ls.date as ls_date, ls.sets as ls_sets, ls.notes as ls_notes
       FROM exercises e
       LEFT JOIN sessions ls ON ls.id = (
         SELECT s.id FROM sessions s WHERE s.exercise_id = e.id ORDER BY s.date DESC LIMIT 1
       )
       WHERE e.user_id = ?
       ORDER BY e.is_favorite DESC, e.updated_at DESC`
    ).all(userId);
    return rows.map(row => ({
      ...toExercise(row, row.muscle_names ? String(row.muscle_names).split(',') : []),
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

    const now = Date.now();
    db.prepare('UPDATE exercises SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(name, now, id, userId);

    if (patch.muscles !== undefined) {
      // Full replace, matching the pre-relational behavior (muscles.join(',')
      // overwrote the whole column) - clear this exercise's links, then
      // re-link. Doesn't delete now-orphaned `muscles` rows on purpose: kept
      // around so re-adding the same tag later (or a future tag-autocomplete
      // feature) reuses the existing canonical row instead of recreating it.
      db.prepare('DELETE FROM exercise_muscles WHERE exercise_id = ?').run(id);
      linkMuscles(userId, id, patch.muscles);
    }

    return getExercise(userId, id);
  }

  /**
   * Pins/unpins an exercise, independent of `updateExercise`'s patch shape
   * specifically so toggling it never bumps `updated_at` - that timestamp
   * doubles as the "last used" caption a favorited-but-never-logged exercise
   * would otherwise show a misleading "hace unos segundos" for.
   * @param {number} userId
   * @param {number} id
   * @param {boolean} isFavorite
   */
  function setFavorite(userId, id, isFavorite) {
    getOwnedExerciseRow(userId, id);
    db.prepare('UPDATE exercises SET is_favorite = ? WHERE id = ? AND user_id = ?')
      .run(isFavorite ? 1 : 0, id, userId);
    return getExercise(userId, id);
  }

  /**
   * Also removes every Session belonging to this Exercise, mirroring
   * `exercise-ui.js`'s `tryDeleteExercise` calling both `deleteExercise` and
   * `deleteExerciseSessions` client-side. Leaves `muscles` rows themselves
   * alone (see `updateExercise`'s comment on why orphaned rows are fine).
   * @param {number} userId
   * @param {number} id
   */
  function deleteExercise(userId, id) {
    getOwnedExerciseRow(userId, id);
    db.prepare('DELETE FROM sessions WHERE exercise_id = ? AND user_id = ?').run(id, userId);
    db.prepare('DELETE FROM exercise_muscles WHERE exercise_id = ?').run(id);
    db.prepare('DELETE FROM exercises WHERE id = ? AND user_id = ?').run(id, userId);
  }

  return { createExercise, getExercise, listExercises, updateExercise, setFavorite, deleteExercise, getOwnedExerciseRow };
}

export { createExerciseService };
