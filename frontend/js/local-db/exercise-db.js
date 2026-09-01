import { dbStore } from "../common/state.js";
import { normalize } from "../lib/string.js";
import { _error, _info, _log } from "../lib/logger.js";
import { apiCreateExercise, apiDeleteExercise, apiFetchExercises, apiSetExerciseFavorite, apiUpdateExercise } from "../api-caller/apiCaller.js";
import { sessionFromApi } from "./set-db.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {number} StoreKey
 * @typedef {import("./set-db.js").Session} Session
 */

/**
 * @typedef {object} Exercise
 * @property {string} name
 * @property {string} [normalizedName]
 * @property {string} [normalizedMuscles]
 * @property {string[]} muscles
 * @property {Session | null} lastSession
 * @property {boolean} [isFavorite]
 * @property {StoreKey} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

/**
 * @param {*} data - the `data` field of an exercises/* API response
 * @returns {Exercise}
 */
function exerciseFromApi(data) {
  const muscles = data.muscles || [];
  return {
    _key: data.id,
    name: data.name,
    normalizedName: normalize(data.name),
    muscles,
    normalizedMuscles: normalize(muscles.join(',')),
    lastSession: data.lastSession ? sessionFromApi({ ...data.lastSession, exerciseId: data.id }) : null,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    isFavorite: !!data.isFavorite,
  };
}

/**
 * Creates Exercise via the API. Updates dbStore.
 * @param {string} name
 * @param {string[]} muscles
 * @param {Date} [date] Accepted for call-site compatibility; ignored - the
 *   server always stamps createdAt/updatedAt with its own "now".
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function createExercise(name, muscles = [], date) {
  name = name.trim();
  if (!name) {
    return { errorMsg: 'Ingresar nombre' };
  }

  const result = await apiCreateExercise(name, muscles);
  if (!result.data) {
    return { errorMsg: result.error };
  }

  const exercise = exerciseFromApi(result.data);
  dbStore.exercises.push(exercise);
  return { data: exercise };
}

/**
 * Updates the Exercise via the API. Mutates the incoming Exercise object.
 * @param {Exercise} exercise will be updated
 * @param {string|null} name
 * @param {string[]|null} muscles
 * @param {Date|null} [date] Accepted for call-site compatibility; ignored -
 *   the server always stamps updatedAt with its own "now". Callers that
 *   only want to bump updatedAt (no name/muscles change) still get that,
 *   since the server always re-stamps the row regardless of which fields
 *   the patch includes.
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function updateExercise(exercise, name, muscles, date) {
  if (!exercise || !exercise._key) { return { errorMsg: 'Llave no provista' }; }

  /** @type {{name?: string, muscles?: string[]}} */
  const patch = {};
  if (name) { patch.name = name; }
  if (muscles && muscles.length) { patch.muscles = muscles; }

  const result = await apiUpdateExercise(exercise._key, patch);
  if (!result.data) {
    _error('Error al actualizar ejercicio');
    return { errorMsg: result.error };
  }

  exercise.name = result.data.name;
  exercise.normalizedName = normalize(exercise.name);
  exercise.muscles = result.data.muscles || [];
  exercise.normalizedMuscles = normalize(exercise.muscles.join(','));
  exercise.updatedAt = new Date(result.data.updatedAt);

  return { data: exercise };
}

/**
 * Pins/unpins the Exercise via the API. Mutates the incoming Exercise object,
 * same convention as `updateExercise` - a dedicated call (not folded into
 * `updateExercise`'s patch) since the server intentionally doesn't bump
 * `updatedAt` for a favorite toggle (see exerciseService.js's `setFavorite`).
 * @param {Exercise} exercise will be updated
 * @param {boolean} isFavorite
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function setExerciseFavorite(exercise, isFavorite) {
  if (!exercise || !exercise._key) { return { errorMsg: 'Llave no provista' }; }

  const result = await apiSetExerciseFavorite(exercise._key, isFavorite);
  if (!result.data) {
    _error('Error al marcar ejercicio como favorito');
    return { errorMsg: result.error };
  }

  exercise.isFavorite = !!result.data.isFavorite;
  return { data: exercise };
}

/**
 * @param {StoreKey} exerciseKey
 */
async function deleteExercise(exerciseKey) {
  await apiDeleteExercise(Number(exerciseKey));
}


/**
 * Fetch all exercises via the API.
 * Sorted the same way the old IndexedDB-backed version was: exercises with
 * a recorded set (most recently updated first), then exercises with none
 * (oldest created first) - except favorited exercises, which are pinned
 * above both groups. The favorites bucket isn't re-sorted client-side: the
 * server already returns rows `is_favorite DESC, updated_at DESC` (see
 * exerciseService.js's `listExercises`), and `push` preserves that relative
 * order.
 * @returns {Promise<Exercise[]>}
 */
async function fetchExercises() {
  const result = await apiFetchExercises();
  if (!result.data) {
    _error(' __ Error fetching exercises', result.error);
    return [];
  }

  /** @type {Exercise[]} */
  const favorites = [];
  /** @type {Exercise[]} */
  const haveSet = [];
  /** @type {Exercise[]} */
  const dontHaveSet = [];

  result.data.forEach(
    /** @param {*} raw */
    raw => {
      const exercise = exerciseFromApi(raw);
      if (exercise.isFavorite) {
        favorites.push(exercise);
      } else if (exercise.lastSession) {
        haveSet.push(exercise);
      } else {
        dontHaveSet.push(exercise);
      }
    }
  );

  haveSet.sort((a, b) => {
    if (!a.updatedAt || !b.updatedAt) { return 0; }
    return a.updatedAt <= b.updatedAt ? -1 : 1;
  });

  dontHaveSet.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) { return 0; }
    return a.createdAt <= b.createdAt ? -1 : 1;
  });

  const exercises = favorites.concat(haveSet, dontHaveSet);
  return exercises;
}


export { createExercise, fetchExercises, updateExercise, setExerciseFavorite, deleteExercise, exerciseFromApi };
