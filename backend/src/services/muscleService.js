import { ServiceError } from './ServiceError.js';


/**
 * @typedef {object} MuscleRow
 * @property {number} id
 * @property {string} name
 * @property {number} exerciseCount
 */

/**
 * Trim + locale-aware lowercase - same rule exerciseService.js's own
 * normalizeMuscle/003_muscles.js use; duplicated here rather than shared,
 * matching this codebase's existing per-service self-containment (e.g.
 * sessionService.js duplicates its own isSameDay rather than importing one).
 * @param {string} tag
 */
function normalizeMuscle(tag) {
  return String(tag || '').trim().toLocaleLowerCase();
}

/**
 * Manages the `muscles`/`exercise_muscles` tables directly (see migration
 * `003_muscles.js`) - exercises reference a muscle by id, not a copy of its
 * name, so rename/delete here are real, safe operations reflected everywhere
 * that muscle is used.
 * @param {import('node:sqlite').DatabaseSync} db
 */
function createMuscleService(db) {
  /**
   * @param {number} userId
   * @param {number} muscleId
   */
  function getOwnedMuscleRow(userId, muscleId) {
    const row = db.prepare('SELECT * FROM muscles WHERE id = ? AND user_id = ?').get(muscleId, userId);
    if (!row) { throw new ServiceError('Músculo no encontrado'); }
    return row;
  }

  /**
   * @param {number} userId
   * @param {number} muscleId
   * @returns {MuscleRow}
   */
  function getMuscleWithCount(userId, muscleId) {
    const row = db.prepare(
      `SELECT m.id, m.name, COUNT(em.exercise_id) as exercise_count
       FROM muscles m LEFT JOIN exercise_muscles em ON em.muscle_id = m.id
       WHERE m.id = ? AND m.user_id = ? GROUP BY m.id`
    ).get(muscleId, userId);
    return { id: Number(row.id), name: String(row.name), exerciseCount: Number(row.exercise_count) };
  }

  /**
   * Every muscle tag this user has, with how many exercises use it,
   * alphabetical.
   * @param {number} userId
   * @returns {MuscleRow[]}
   */
  function listMuscles(userId) {
    const rows = db.prepare(
      `SELECT m.id, m.name, COUNT(em.exercise_id) as exercise_count
       FROM muscles m LEFT JOIN exercise_muscles em ON em.muscle_id = m.id
       WHERE m.user_id = ? GROUP BY m.id ORDER BY m.name`
    ).all(userId);
    return rows.map(row => ({ id: Number(row.id), name: String(row.name), exerciseCount: Number(row.exercise_count) }));
  }

  /**
   * Renames in place if `newName` normalizes to something new; if it
   * collides with another muscle the user already has, MERGES instead -
   * every exercise linked to the old muscle is relinked to the existing
   * target (`INSERT OR IGNORE`, since an exercise may already carry both
   * tags), the old links are dropped, then the now-empty old muscle row is
   * deleted. Returns the surviving row (the target's on merge, the same one
   * on a plain rename), so the caller doesn't need to know which happened.
   * @param {number} userId
   * @param {number} muscleId
   * @param {string} newName
   * @returns {MuscleRow}
   */
  function renameMuscle(userId, muscleId, newName) {
    getOwnedMuscleRow(userId, muscleId);
    const normalized = normalizeMuscle(newName);
    if (!normalized) { throw new ServiceError('Ingresar nombre'); }

    /** @type {{id: number} | undefined} */ // @ts-ignore
    const collision = db.prepare(
      'SELECT id FROM muscles WHERE user_id = ? AND name = ? AND id != ?'
    ).get(userId, normalized, muscleId);

    if (collision) {
      const targetId = Number(collision.id);
      db.prepare(
        `INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id)
         SELECT exercise_id, ? FROM exercise_muscles WHERE muscle_id = ?`
      ).run(targetId, muscleId);
      db.prepare('DELETE FROM exercise_muscles WHERE muscle_id = ?').run(muscleId);
      db.prepare('DELETE FROM muscles WHERE id = ? AND user_id = ?').run(muscleId, userId);
      return getMuscleWithCount(userId, targetId);
    }

    db.prepare('UPDATE muscles SET name = ? WHERE id = ? AND user_id = ?').run(normalized, muscleId, userId);
    return getMuscleWithCount(userId, muscleId);
  }

  /**
   * Cascade delete: drops every exercise_muscles link, then the muscle row
   * itself.
   * @param {number} userId
   * @param {number} muscleId
   */
  function deleteMuscle(userId, muscleId) {
    getOwnedMuscleRow(userId, muscleId);
    db.prepare('DELETE FROM exercise_muscles WHERE muscle_id = ?').run(muscleId);
    db.prepare('DELETE FROM muscles WHERE id = ? AND user_id = ?').run(muscleId, userId);
  }

  return { listMuscles, renameMuscle, deleteMuscle, getOwnedMuscleRow };
}

export { createMuscleService };
