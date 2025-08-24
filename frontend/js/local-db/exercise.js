import { getOneWithIndex, putOne } from "../lib/indexedDb.js";
import { _info, _warn } from "../lib/logger.js";


/**
 * @template T
 * @typedef {import("../common/common.js").ServiceReturn<T>} ServiceReturn<T>
 */


/**
 * @typedef {object} Exercise
 * @property {string} name
 * @property {string[]} muscles
 * @property {IDBValidKey} [_key]
 */


/**
 * @param {string} name 
 * @param {string[]} muscles 
 * @returns {ServiceReturn<Exercise>}
 */
async function createExercise(name, muscles = []) {
  name = name.trim();
  const nameExists = await getOneWithIndex('exercises', 'nameIndex', name);
  if (nameExists) {
    return { errorMsg: `El ejercicio "${name}" ya existe` };
  }

  /** @type {Exercise} */
  const exercise = { name, muscles };
  const _key = await putOne('exercises', exercise);
  exercise._key = _key;

  return { data: exercise };
}


/** Test */
async function testLocalDbEndpoint() {
  const result = await createExercise('    Ejercicio 6     ');
  if (result.errorMsg) {
    _warn(result.errorMsg);
  } else {
    _info(' // Ejercicio creado', result.data);
  }
}


export { createExercise, testLocalDbEndpoint };