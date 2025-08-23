import { getOneWithIndex, putOne } from "../lib/indexedDb.js"
import { _info, _warn } from "../lib/logger.js"


/**
 * @template T
 * @typedef {object} ServiceReturnObj
 * @property {T} [data]
 * @property {string} [errorMsg]
 */

/**
 * @template T
 * @typedef {Promise<ServiceReturnObj<T>>} ServiceReturn
 */

/**
 * @typedef {object} Exercise
 * @property {IDBValidKey} [_key]
 * @property {string} name
 * @property {string[]} muscles
 */


/**
 * @param {string} name 
 * @param {string[]} muscles 
 * @returns {ServiceReturn<Exercise>}
 */
async function createExercise(name, muscles = []) {
  name = name.trim()
  const nameExists = await getOneWithIndex('exercises', 'nameIndex', name)
  if (nameExists) {
    return { errorMsg: `El ejercicio "${name}" ya existe` }
  }

  /** @type {Exercise} */
  const exercise = { name, muscles }
  const _key = await putOne('exercises', exercise)
  exercise._key = _key

  return { data: exercise }
}


/** For testing */
async function testLocalDbEndpoint() {
  const result = await createExercise('    Ejercicio 6     ')
  if (result.errorMsg) {
    _warn(result.errorMsg)
  } else {
    _info(' // Ejercicio creado', result.data)
  }
}


export { createExercise, testLocalDbEndpoint }