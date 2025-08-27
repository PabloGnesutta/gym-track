import { dbStore } from "../common/state.js";
import { deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./exercise-db.js").StoreKey} StoreKey
 */

/**
 * Set
 * @typedef {object} Set
 * @property {StoreKey} exerciseKey
 * @property {number} weight
 * @property {number} reps
 * @property {Date} [date]
 * @property {number} [volume] Result of computing weight*reps
 * @property {StoreKey} [_key]
 */


/**
 * Creates a Set. Puts it into the cache.
 * Updates Exercise with last set data.
 * @param {import("./exercise-db.js").Exercise} exercise 
 * @param {number} weight 
 * @param {number} reps
 * @returns {ServiceReturn<Set>} The exercise object with its key
 */
async function createSet(exercise, weight, reps) {
  if (!weight || !reps) {
    return { errorMsg: 'Completar todos los campos' };
  }
  const exerciseKey = exercise._key || 0;
  if (!exerciseKey) {
    return { errorMsg: 'Falta la llave del ejercicio (wtf)' };
  }

  /** @type {Set} */
  const set = {
    exerciseKey,
    weight,
    reps,
    volume: weight * reps,
    date: new Date(),
  };
  const _key = await putOne('sets', set);
  set._key = _key;

  /** string Exercise key for dbStore cache */
  const stringKey = exerciseKey.toString();
  if (!dbStore.setsForExercise[stringKey]) {
    dbStore.setsForExercise[stringKey] = [];
  }
  dbStore.setsForExercise[stringKey].unshift(set);

  exercise.lastSet = set;
  await putOne('exercises', exercise, exercise._key);
  // TODO: Update exercise row with last set data

  return { data: set };
}


/**
 * Returns the sets for the given exercise.
 * If they are cached, return the cache, otherwise fetch and cache.
 * @param {import("./exercise-db.js").StoreKey} exerciseKey 
 * @returns {Promise<Array<Set>>}
 */
async function getSetsForExercise(exerciseKey) {
  const stringKey = exerciseKey.toString();
  if (dbStore.setsForExercise[stringKey]) {
    // cached
    return dbStore.setsForExercise[stringKey];
  }
  const data = await getAllWithIndex('sets', 'setsExerciseKeyIdx', exerciseKey);
  // @ts-ignore - cache the value: 
  dbStore.setsForExercise[stringKey] = data;
  // @ts-ignore
  return dbStore.setsForExercise[stringKey];
}

/**
 * Delete one Set
 * @param {StoreKey} key 
 */
async function deleteSet(key) {
  return await deleteOne('sets', key);
  // TODO: Remove from dbStore cache
}

export { createSet, getSetsForExercise, deleteSet };