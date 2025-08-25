import { dbStore } from "../common/state.js";
import { getAll, getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _log, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/common.js").ServiceReturn<T>} ServiceReturn<T>
 */


/**
 * @typedef {object} Set
 * @property {TODO::} name
 * @property {string[]} muscles
 * @property {IDBValidKey} [_key]
 */


/**
 * @param {string} name 
 * @param {string[]} muscles 
 * @returns {ServiceReturn<Exercise>} The exercise object with its key
 */
async function createSet(name, muscles = []) {
  // name = name.trim();
  // const nameExists = await getOneWithIndex('sets', 'setsExerciseIdIdx', name);
  // if (nameExists) {
  //   return { errorMsg: `El ejercicio "${name}" ya existe` };
  // }

  /** @type {Set} */
  const set = { name, muscles };
  const _key = await putOne('exercises', exercise);
  exercise._key = _key;

  return { data: exercise };
}


/** TODO: Cache */
async function fetchSets() {
  const sets = await getAll('sets')
  // TODO: Use helper functions like clear array and clear obj
  // @ts-ignore
  dbStore.sets = sets
}


export { createSet, fetchSets };