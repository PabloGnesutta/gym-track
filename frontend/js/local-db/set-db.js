import { dbStore } from "../common/state.js";
import { toYYYYMMDD } from "../lib/date.js";
import { deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";
import { updateExercise } from "./exercise-db.js";

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
  // return
  // const date = new Date()
  // date.setDate(date.getDate() - 3)
  // await putOne('sets', {
  //   exerciseKey: 1,
  //   weight: 1,
  //   reps: 2,
  //   volume: weight * reps,
  //   date
  // });
  // return
  const exerciseKey = exercise._key || 0;
  /** @type {Set} */
  const set = {
    exerciseKey,
    weight,
    reps,
    volume: weight * reps,
    date: new Date(),
  };

  set._key = await putOne('sets', set);

  const stringExerciseKey = exerciseKey.toString();
  if (!dbStore.setsForExercise[stringExerciseKey]) {
    dbStore.setsForExercise[stringExerciseKey] = [];
  }
  dbStore.setsForExercise[stringExerciseKey].unshift(set);

  exercise.lastSet = set;
  await updateExercise(exercise);

  return { data: set };
}

/**
 * Returns the sets for the given exercise.
 * If they are cached, return the cache, otherwise fetch and cache.
 * @param {import("./exercise-db.js").StoreKey} exerciseKey 
 * @returns {Promise<Array<Set>>}
 */
async function getSetsForExercise(exerciseKey) {
  const _exerciseKey = exerciseKey.toString();
  if (dbStore.setsForExercise[_exerciseKey]) {
    // cached
    return dbStore.setsForExercise[_exerciseKey];
  }

  const nodeForExercise = {};

  const data = await getAllWithIndex('sets', 'setsExerciseKeyIdx', exerciseKey,
    /**
     * 
     * @param {Set} set 
     */
    (set) => {
      // Group by date:
      if (!set.date) { return }
      const date = toYYYYMMDD(set.date)
      if (!nodeForExercise[date]) {
        nodeForExercise[date] = {};
      }
      if (!nodeForExercise[date][set.weight]) {
        nodeForExercise[date][set.weight] = [];
      }
      nodeForExercise[date][set.weight].unshift(set.reps);
    }
  );

  dbStore.setsForExerciseByDate[_exerciseKey] = nodeForExercise;

  // cache the value: 
  // @ts-ignore 
  dbStore.setsForExercise[_exerciseKey] = data;
  // @ts-ignore
  return dbStore.setsForExercise[_exerciseKey];
}

/**
 * Delete one Set from DB 
 * TODO: Remove from dbStore cache
 * @param {StoreKey} key 
 */
async function deleteSet(key) {
  return await deleteOne('sets', key);
}

export { createSet, getSetsForExercise, deleteSet };