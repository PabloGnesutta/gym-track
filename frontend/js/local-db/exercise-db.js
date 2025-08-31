import { dbStore } from "../common/state.js";
import { getAll, getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
*/

/**
 * @typedef {import("../lib/indexedDb.js").StoreKey} StoreKey
 */

/**
 * 
 * @typedef {object} Exercise
 * @property {string} name
 * @property {string[]} muscles
 * @property {import("./set-db.js").ExerciseSession | null} lastSession
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */


/**
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
 * @param {Exercise} exercise 
 */
async function updateExercise(exercise, date = new Date()) {
  exercise.updatedAt = date;
  await putOne('exercises', exercise, exercise._key);
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