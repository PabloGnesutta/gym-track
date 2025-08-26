import { dbStore } from "../common/state.js";
import { getAll, getAllWithIndex, getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/common.js").ServiceReturn<T>} ServiceReturn<T>
 */


/**
 * @typedef {object} Set
 * @property {IDBValidKey} exerciseKey
 * @property {number} weight
 * @property {number} reps
 * @property {Date} [date]
 * @property {number} [volume] Result of computing weight*reps
 * @property {IDBValidKey} [_key]
 */


/**
 * @param {IDBValidKey} exerciseKey 
 * @param {number} weight 
 * @param {number} reps
 * @returns {ServiceReturn<Set>} The exercise object with its key
 */
async function createSet(exerciseKey, weight, reps) {
  _log({ exerciseKey, weight, reps });
  if (!exerciseKey || !weight || !reps) {
    return { errorMsg: 'Completar todos los campos' };
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
  dbStore.sets.push(set);
  return { data: set };
}


/** TODO: Cache */
async function fetchSets() {
  /**@type {Set[]} */ // @ts-ignore
  const sets = await getAll('sets');
  dbStore.sets = sets;
}

/**
 * 
 * @param {import("../lib/indexedDb.js").StoreKey[]} setKeys 
 */
async function fetchLastSets(setKeys) {
  
}
/**
 * @param {import("./exercise.js").StoreKey} exerciseKey 
 * @returns {Promise<null | Array<import("../lib/indexedDb.js").DbRecord>>}
 */
async function setsForExercise(exerciseKey) {
  if (!dbStore.sets.length) {
    return null;
  }
  const data = await getAllWithIndex('sets', 'setsExerciseKeyIdx', exerciseKey);
  _log(data);
  return data;
}

export { createSet, fetchSets, setsForExercise };