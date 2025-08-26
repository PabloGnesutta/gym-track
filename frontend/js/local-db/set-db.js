import { dbStore } from "../common/state.js";
import { getAll, getAllWithIndex, getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./exercise-db.js").StoreKey} StoreKey
 */


/**
 * @typedef {object} Set
 * @property {StoreKey} exerciseKey
 * @property {number} weight
 * @property {number} reps
 * @property {Date} [date]
 * @property {number} [volume] Result of computing weight*reps
 * @property {StoreKey} [_key]
 */


/**
 * @param {import("./exercise-db.js").Exercise} exercise 
 * @param {number} weight 
 * @param {number} reps
 * @returns {ServiceReturn<Set>} The exercise object with its key
 */
async function createSet(exercise, weight, reps) {
  if (!weight || !reps) {
    return { errorMsg: 'Completar todos los campos' };
  }
  /** @type {Set} */
  const set = {
    exerciseKey: exercise._key || '',
    weight,
    reps,
    volume: weight * reps,
    date: new Date(),
  };
  const _key = await putOne('sets', set);
  set._key = _key;

  // TODO: Update set history
  const stringKey = _key.toString()
  if (!dbStore.setsForExercise[stringKey]) {
    dbStore.setsForExercise[stringKey] = []
  }
  dbStore.setsForExercise[stringKey].push(set)


  exercise.lastSet = set
  await putOne('exercises', exercise, exercise._key)
  // TODO: Update exercise row (make an updateExerciseRow funtion that does all)

  return { data: set };
}


/**
 * @param {import("./exercise-db.js").StoreKey} exerciseKey 
 * @returns {Promise<Array<Set>>}
 */
async function setsForExercise(exerciseKey) {
  const cachedSetsForExercise = dbStore.setsForExercise[exerciseKey.toString()]
  if (cachedSetsForExercise) {
    // Sets already fetched for exercise
    return cachedSetsForExercise;
  }
  const data = await getAllWithIndex('sets', 'setsExerciseKeyIdx', exerciseKey);
  _log(data);
  // @ts-ignore
  return data;
}

export { createSet, setsForExercise };