import { _error } from "../lib/logger.js";
import { apiFetchMuscles, apiRenameMuscle, apiDeleteMuscle } from "../api-caller/apiCaller.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * Server-backed muscle tag. Unlike Exercise/Session, there's no dbStore
 * cache for these - nothing else holds a long-lived reference to one - so,
 * unlike the rest of local-db/*.js, these functions return fresh data
 * rather than mutating a passed-in object (see CLAUDE.md's "Conventions to
 * preserve"). The Muscles view always re-fetches fresh, same "no client
 * caching" approach CLAUDE.md documents for Analytics.
 * @typedef {object} Muscle
 * @property {number} id
 * @property {string} name
 * @property {number} exerciseCount
 */

/** @returns {Promise<Muscle[]>} */
async function fetchMuscles() {
  const result = await apiFetchMuscles();
  if (!result.data) {
    _error(' __ Error fetching muscles', result.error);
    return [];
  }
  return result.data;
}

/**
 * @param {number} muscleId
 * @param {string} name
 * @returns {ServiceReturn<Muscle>} The surviving muscle row - same id on a
 *   plain rename, the pre-existing target's id if this merged into it.
 */
async function renameMuscle(muscleId, name) {
  const result = await apiRenameMuscle(muscleId, name);
  if (!result.data) { return { errorMsg: result.error }; }
  return { data: result.data };
}

/**
 * @param {number} muscleId
 * @returns {ServiceReturn<{ok: true}>}
 */
async function deleteMuscle(muscleId) {
  const result = await apiDeleteMuscle(muscleId);
  if (!result.data) { return { errorMsg: result.error }; }
  return { data: result.data };
}

export { fetchMuscles, renameMuscle, deleteMuscle };
