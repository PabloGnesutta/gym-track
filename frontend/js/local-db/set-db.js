import { toYYYYMMDD } from "../lib/date.js";
import { dbStore } from "../common/state.js";
import { _error, _info, _log } from "../lib/logger.js";
import { deleteMany, deleteOne, getAllWithIndex, putOne } from "../lib/indexedDb.js";
import { updateExercise } from "./exercise-db.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./exercise-db.js").StoreKey} StoreKey
 */

/**
 * Exercise Session - DB Model
 * @typedef {object} Session
 * @property {IDBValidKey} exerciseKey
 * @property {Date} date
 * @property {WeightRow[]} sets
 * @property {string} [notes]
 * @property {IDBValidKey} [_key]
 * @example 
 * {
 *   exerciseKey: 1,
 *   date: new Date(),
 *   sets: [
 *     { w: 8, r: [1, 2, 3] },
 *     { w: 9, r: [2, 3, 4] },
 *   ]
 * }
 * 
 * @typedef {object} WeightRow
 * @property {number} w Weight used with {r} reps
 * @property {number[]} r Amount of reps for each set, using {w} weight
 * 
 * @typedef {object} SetData
 * @property {number} weight
 * @property {number} reps
 * @property {Date} [date]
 */

/**
 * Appends the number of reps to the sets array for the weight.
 * If the session doesn't exist, create it and set it as exercise.lastSession
 * Append the reps to the weight row. If weight row doesn't exist create it.
 * 
 * TODO: This should only receive exerciseKey and session, not the entire exercise:
 * the exercise should be updated in its own part of the code.
 * TODO: Add validation for session existing for the date.
 * @param {import("./exercise-db.js").Exercise} exercise 
 * @param {SetData} setData
 * @returns {ServiceReturn<Session>}
 */
async function createSet(exercise, setData) {
  const exerciseKey = exercise._key;
  if (!exerciseKey) {
    return { errorMsg: 'Exercise had no _key' };
  }

  const date = setData.date || new Date();

  /** @type {Session|null} */
  let session = exercise.lastSession;

  if (!session || toYYYYMMDD(date) !== toYYYYMMDD(session.date)) {
    // New session. Either the Exercise has no lastSession, or it has one with a different date as the Set's
    session = {
      exerciseKey,
      date,
      sets: [],
    };
    exercise.lastSession = session;
  }

  let weightRow = session.sets.find(weightRow => weightRow.w === setData.weight);
  if (!weightRow) {
    weightRow = { w: setData.weight, r: [] };
    session.sets.push(weightRow);
  }
  weightRow.r.push(setData.reps);

  session._key = await putOne('sessions', session, session._key);

  await updateExercise(exercise, null, null, date);

  // Update DBStore:
  let exerciseSessions = dbStore.sessions[exerciseKey.toString()];
  if (!exerciseSessions) {
    exerciseSessions = [];
    dbStore.sessions[exerciseKey.toString()] = exerciseSessions;
  }
  const index = exerciseSessions.findIndex(s => s._key === session._key);
  if (index === -1) {
    exerciseSessions.push(session);
  } else {
    exerciseSessions[index] = session;
  }

  return { data: session };
}

/**
 * Returns the sets for the given exercise.
 * If they are cached, return the cache, otherwise fetch and cache.
 * @param {import("./exercise-db.js").StoreKey} exerciseKey 
 * @returns {Promise<Array<Session>>}
 */
async function getSessionsForExercise(exerciseKey) {
  const strExerciseKey = exerciseKey.toString();
  if (dbStore.sessions[strExerciseKey]) {
    // cached
    return dbStore.sessions[strExerciseKey];
  }

  /** @type {Session[]} */ // @ts-ignore
  const sessions = await getAllWithIndex('sessions', 'exerciseKey', exerciseKey);

  // cache all sessions for exercise: 
  dbStore.sessions[strExerciseKey] = sessions;
  // @ts-ignore
  return sessions;
}


/**
 * @param {Session} session 
 */
async function deleteSession(session) {
  if (!session._key) {
    return;
  }
  await deleteOne('sessions', session._key);
  // TODO: Remove session from state memory and UI
}

/**
 * Deletes all the sessions for the given exercise
 * @param {StoreKey} exerciseKey 
 * @returns {Promise<boolean>}
 */
async function deleteExerciseSessions(exerciseKey) {
  return deleteMany('sessions', 'exerciseKey', exerciseKey);
}


export { createSet, getSessionsForExercise, deleteSession, deleteExerciseSessions };