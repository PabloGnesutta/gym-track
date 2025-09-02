import { dbStore } from "../common/state.js";
import { getAll, getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _error, _info, _log } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
*/

/**
 * @typedef {import("../lib/indexedDb.js").StoreKey} StoreKey
 * @typedef {import("./set-db.js").Session} Session
 */

/**
 * 
 * @typedef {object} Exercise
 * @property {string} name
 * @property {string[]} muscles
 * @property {import("./set-db.js").Session | null} lastSession
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */


/**
 * Stores Exercise in DB. Updates DBStore
 * @param {string} name 
 * @param {string[]} muscles 
 * @param {Date} date - Date in which the exercise was created 
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function createExercise(name, muscles = [], date = new Date()) {
  name = name.trim();
  if (!name) {
    return { errorMsg: 'Ingresar nombre' };
  }
  const nameExists = await getOneWithIndex('exercises', 'name', name);
  if (nameExists) {
    return { errorMsg: `El ejercicio "${name}" ya existe` };
  }

  /** @type {Exercise} */
  const exercise = {
    name,
    muscles,
    createdAt: date,
    updatedAt: date,
    lastSession: null,
  };
  const _key = await putOne('exercises', exercise);
  exercise._key = _key;

  dbStore.exercises.push(exercise);
  return { data: exercise };
}

/**
 * Updates DB record. Mutates incoming Exercise object
 * @param {Exercise} exercise will be updated
 * @param {string|null} name 
 * @param {string[]|null} muscles 
 * @param {Date|null} date
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function updateExercise(exercise, name, muscles, date) {
  if (!exercise || !exercise._key) { return { errorMsg: 'Llave no provista' }; }
  if (name) {
    exercise.name = name;
  }
  if (muscles && muscles.length) {
    exercise.muscles = muscles;
  }
  exercise.updatedAt = date || new Date();

  const _key = await putOne('exercises', exercise, exercise._key);
  if (!_key) {
    _error('Error al actualizar ejercicio');
  }
  return { data: exercise };
}


/**
 * Fetch all exercises,
 * Store then sorted in dbStore.exercises
 * @returns {Promise<void>}
 */
async function fetchExercises() {
  /** @type {Exercise[]} */
  const haveSet = [];
  /** @type {Exercise[]} */
  const dontHaveSet = [];

  await getAll(
    'exercises',
    /**
     * Splits the exercises into two arrays, 
     * one for excersices with sets done, and the other not
     * @param {Exercise} exercise 
     */
    exercise => {
      if (exercise.lastSession) {
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

  dbStore.exercises = haveSet.concat(dontHaveSet);
}


export { createExercise, fetchExercises, updateExercise };