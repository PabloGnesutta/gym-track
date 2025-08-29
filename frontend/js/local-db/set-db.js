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
 * Amount of reps done for a given weight
 * @typedef {object} WeightAndReps
 * @property {number} w - The weight
 * @property {number[]} r - Reps for that weight
 * 
 * @typedef {Record<
 *  string,
 *  Array<WeightAndReps>
 * >} WeightAndRepsByDate
 * @example {
 *  '2025-01-01': [
 *    {w:8, r:[13,12,12]},
 *    {w:9, r:[8,8,7]},
 *  ],
 *  '2025-8-01': [
 *    {w:9, r:[10,10,10]},
 *    {w:10, r:[8,7,7]},
 *  ],
 * }
 */


/**
 * ExerciseSession
 * @typedef {object} ExerciseSession Potential DB Model
 * @property {IDBValidKey} exerciseKey
 * @property {Date} date
 * @property {SetData[]} sets
 * @property {IDBValidKey} [_key]
 * 
 * @typedef {object} SetData
 * @property {number} w Weight
 * @property {number} r Reps
 * 
*/

/**
 * @type {ExerciseSession}
 */
let ExerciseSession = {
  exerciseKey: 1,
  date: new Date(),
  sets: [
    { w: 9, r: 10 },
    { w: 9, r: 10 },
    { w: 9, r: 10 },
  ]
}

/**
 * Set
 * @typedef {object} Set - DB Model
 * @property {IDBValidKey} exerciseKey
 * @property {number} weight
 * @property {number} reps
 * @property {Date} [date]
 * @property {number} [volume] weight*reps
 * @property {IDBValidKey} [_key]
 */

/**
 * Creates a Set. Puts it into the cache.
 * Updates Exercise with last set data.
 * @param {import("./exercise-db.js").Exercise} exercise 
 * @param {number} weight 
 * @param {number} reps
 * @returns {ServiceReturn<ExerciseSession>}
 */
async function createSet(exercise, weight, reps) {
  const exerciseKey = exercise._key || 0;

  /** @type {ExerciseSession | null} */
  let session = exercise.lastSession
  if (!session) {
    session = {
      exerciseKey,
      date: new Date(),
      sets: [],
    }
    exercise.lastSession = session
  }
  session.sets.push({ w: weight, r: reps })

  session._key = await putOne('sessions', session, session._key);

  await updateExercise(exercise);

  return { data: session };
}

/**
 * Returns the sets for the given exercise.
 * If they are cached, return the cache, otherwise fetch and cache.
 * @param {import("./exercise-db.js").StoreKey} exerciseKey 
 * @returns {Promise<Array<ExerciseSession>>}
 */
async function getSessionsForExercise(exerciseKey) {
  const strExerciseKey = exerciseKey.toString();
  if (dbStore.sessions[strExerciseKey]) {
    // cached
    return dbStore.sessions[strExerciseKey];
  }

  const sessions = await getAllWithIndex('sessions', 'exerciseKey', exerciseKey)

  // cache all sessions for exercise: 
  dbStore.sessions[strExerciseKey] = sessions;
  // @ts-ignore
  return sessions
}


/**
 * @param {Set} set
 * @param {WeightAndRepsByDate} obj
*/
function convertSessionData(set, obj) {
  // TODO: MAKE THIS WORK
  if (!set.date) { return }
  const date = toYYYYMMDD(set.date)
  if (!obj[date]) {
    obj[date] = [];
  }

  /** weight and reps for the date */
  const workForDate = obj[date];
  let weightAndReps = workForDate.find(row => row.w === set.weight)
  if (!weightAndReps) {
    weightAndReps = { w: set.weight, r: [] }
    workForDate.unshift(weightAndReps)
  }
  weightAndReps.r.push(set.reps)
}


/**
 * Delete one Set from DB 
 * TODO: Remove from dbStore cache
 * @param {StoreKey} key 
 */
async function deleteSet(key) {
  return await deleteOne('sets', key);
}

export { createSet, getSessionsForExercise, deleteSet, convertSessionData };