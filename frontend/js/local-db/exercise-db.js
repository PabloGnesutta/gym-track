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
 * @property {import("./set-db.js").Set} [lastSet]
 * @property {IDBValidKey} [_key]
 * @property {Date} [createdAt]
 */


/**
 * @param {string} name 
 * @param {string[]} muscles 
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function createExercise(name, muscles = []) {
  name = name.trim();
  if (!name) {
    return { errorMsg: 'Ingresar nombre' };
  }
  const nameExists = await getOneWithIndex('exercises', 'excerisesNameIdx', name);
  if (nameExists) {
    return { errorMsg: `El ejercicio "${name}" ya existe` };
  }

  /** @type {Exercise} */
  const exercise = {
    name,
    muscles,
    createdAt: new Date(),
  };
  const _key = await putOne('exercises', exercise);
  exercise._key = _key;

  dbStore.exercises.push(exercise);
  return { data: exercise };
}


/**
 * @param {Exercise} exercise 
 */
async function updateExercise(exercise) {
  await putOne('exercises', exercise, exercise._key);

}

/** */
async function fetchExercises() {
  const exercises = await getAll('exercises');
  // @ts-ignore
  dbStore.exercises = exercises;
}


export { createExercise, fetchExercises, updateExercise };