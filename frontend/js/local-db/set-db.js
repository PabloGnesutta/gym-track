import { dbStore } from "../common/state.js";
import { toYYYYMMDD } from "../lib/date.js";
import { deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";
import { updateExercise } from "./exercise-db.js";


const SHOW_TODAY_IN_DS_HISTORY = true

/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./exercise-db.js").StoreKey} StoreKey
 */

/**
 * @typedef {[number, number[]]} DS2Unit
 * @typedef {Record<
 *  string, 
 *  Array<DS2Unit>
 * >} DS2
 *
 * @typedef {{ w: number, r: number[] }} DS3Unit
 * @typedef {Record<
 *  string,
 *  Array<DS3Unit>
 * >} DS3
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
  const strExerciseKey = exerciseKey.toString();
  if (dbStore.setsForExercise[strExerciseKey]) {
    // cached
    return dbStore.setsForExercise[strExerciseKey];
  }
  // This all also is grouped at the top by Exercise Key

  /**
   * DS1: No va porque no quedan en orden los ejercicios
   * (las keys se ordenan numéricamente cuando se iteran)
   * @example 
   *  2025-01-01: {
   *    8: [1,2,3],
   *    9: [2,3,4],
   *  }
   */
  const dataStructure1 = {};

  /**
   * @type {DS2}
   * @example
   *  2025-01-01: [
   *    [8, [1,2,3]],
   *    [9, [2,3,4]],
   *  ]
   */
  const dataStructure2 = {};

  /**
   * @type {DS3}
   * @example
   *  2025-01-01: [
   *    {w:8, s:[1,2,3]},
   *    {w:9, s:[2,3,4]},
   *  ]
   */
  const dataStructure3 = {}

  const sets = await getAllWithIndex('sets', 'setsExerciseKeyIdx', exerciseKey, [
    (set) => convertToDataStructure1(set, dataStructure1),
    (set) => convertToDataStructure2(set, dataStructure2),
    (set) => convertToDataStructure3(set, dataStructure3),
  ]);

  _log({ sets })
  _log({ dataStructure2 })
  _log({ dataStructure3 })

  // cache values: 
  dbStore.dataStructure1[strExerciseKey] = dataStructure1;
  dbStore.dataStructure2[strExerciseKey] = dataStructure2;
  dbStore.dataStructure3[strExerciseKey] = dataStructure3;
  // @ts-ignore 
  dbStore.setsForExercise[strExerciseKey] = sets;
  // @ts-ignore
  return dbStore.setsForExercise[strExerciseKey];
}


/**
 * @param {Set} set
 * @param {DS3} obj
*/
function convertToDataStructure3(set, obj) {
  if (!set.date) { return }
  const today = toYYYYMMDD(new Date())
  const date = toYYYYMMDD(set.date)
  if (date === today && !SHOW_TODAY_IN_DS_HISTORY) { return }
  if (!obj[date]) {
    obj[date] = [];
  }
  /** weight and sets for a date */
  const workForDate = obj[date];
  const weightAndSets = workForDate
  let weightRow = weightAndSets.find(row => row.w === set.weight)
  if (!weightRow) {
    weightRow = { w: set.weight, r: [] }
    workForDate.unshift(weightRow)
  }
  weightRow.r.push(set.reps)
}


/**
 * @param {Set} set
 * @param {DS2} obj
*/
function convertToDataStructure2(set, obj) {
  if (!set.date) { return }
  const today = toYYYYMMDD(new Date())
  const date = toYYYYMMDD(set.date)
  if (date === today && !SHOW_TODAY_IN_DS_HISTORY) { return }
  if (!obj[date]) {
    obj[date] = [];
  }
  /** weight and sets for a date */
  const workForDate = obj[date];

  const weightAndSets = workForDate
  let weightRow = weightAndSets.find(row => row[0] === set.weight)
  if (!weightRow) {
    weightRow = [set.weight, []]
    workForDate.unshift(weightRow)
  }
  weightRow[1].push(set.reps)
}

/**
 * Canceled due to sorting weight
 * @param {Set} set
 * @param {Record<string, *>} obj
*/
function convertToDataStructure1(set, obj) {
  if (!set.date) { return }
  const today = toYYYYMMDD(new Date())
  const date = toYYYYMMDD(set.date)
  if (date === today && !SHOW_TODAY_IN_DS_HISTORY) { return }

  if (!obj[date]) {
    obj[date] = {};
  }
  if (!obj[date][set.weight]) {
    obj[date][set.weight] = [];
  }
  obj[date][set.weight].unshift(set.reps);
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