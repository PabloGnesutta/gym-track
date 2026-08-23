import { dbStore } from "../common/state.js";
import { _error, _info, _log } from "../lib/logger.js";
import { apiAddSet, apiDeleteSession, apiFetchSessions, apiUpdateSession } from "../api-caller/apiCaller.js";


/**
 * @template T
 * @typedef {import("../common/types.js").ServiceReturn<T>} ServiceReturn<T>
 */

/**
 * @typedef {import("./exercise-db.js").StoreKey} StoreKey
 */

/**
 * Exercise Session - server-backed model (mirrors backend/src/services/sessionService.js)
 * @typedef {object} Session
 * @property {number} exerciseKey
 * @property {Date} date
 * @property {WeightRow[]} sets
 * @property {string} [notes]
 * @property {number} [_key]
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
 * @param {*} data - the `data` field of a sessions/* API response
 * @returns {Session}
 */
function sessionFromApi(data) {
  return {
    _key: data.id,
    exerciseKey: data.exerciseId,
    date: new Date(data.date),
    sets: data.sets,
    notes: data.notes || '',
  };
}

/**
 * Appends the number of reps to the sets array for the weight.
 * Updates exercise.lastSession and bumps its updatedAt server-side (used
 * for "most recently used" list sorting - see sessionService.js's addSet).
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
  const result = await apiAddSet(exerciseKey, { weight: setData.weight, reps: setData.reps, date: date.getTime() });
  if (!result.data) {
    return { errorMsg: result.error };
  }

  const session = sessionFromApi(result.data);
  exercise.lastSession = session;
  exercise.updatedAt = date;

  // Update DBStore:
  let exerciseSessions = dbStore.sessions[exerciseKey.toString()];
  if (!exerciseSessions) {
    exerciseSessions = [];
    dbStore.sessions[exerciseKey.toString()] = exerciseSessions;
  }
  const index = exerciseSessions.findIndex(s => s._key === session._key);
  if (index === -1) {
    exerciseSessions.unshift(session);
  } else {
    exerciseSessions[index] = session;
  }

  return { data: session };
}

/**
 * Returns the sets for the given exercise.
 * If they are cached, return the cache, otherwise fetch and cache.
 * @param {import("./exercise-db.js").StoreKey | ''} exerciseKey
 * @returns {Promise<Array<Session>>}
 */
async function getSessionsForExercise(exerciseKey) {
  const strExerciseKey = exerciseKey.toString();
  if (dbStore.sessions[strExerciseKey]) {
    // cached
    return dbStore.sessions[strExerciseKey];
  }

  const result = await apiFetchSessions(Number(exerciseKey));
  if (!result.data) {
    _error(' __ Error fetching sessions', result.error);
    return [];
  }

  const sessions = result.data.map(sessionFromApi);
  dbStore.sessions[strExerciseKey] = sessions;
  return sessions;
}

/**
 * Full replace of a Session's sets/notes (used by set-ui.js's submitSession,
 * which overwrites the whole `sets` array from the edit form).
 * @param {Session} session
 * @param {WeightRow[]} sets
 * @param {string} [notes]
 * @returns {ServiceReturn<Session>}
 */
async function updateSessionData(session, sets, notes) {
  if (!session._key) { return { errorMsg: 'Sesión sin llave' }; }

  const result = await apiUpdateSession(session._key, { sets, notes });
  if (!result.data) { return { errorMsg: result.error }; }

  const updated = sessionFromApi(result.data);
  return { data: updated };
}

/**
 * @param {Session} session
 */
async function deleteSession(session) {
  if (!session._key) {
    return;
  }
  await apiDeleteSession(session._key);

  const strExerciseKey = session.exerciseKey.toString();
  const exerciseSessions = dbStore.sessions[strExerciseKey];
  if (exerciseSessions) {
    const index = exerciseSessions.findIndex(s => s._key === session._key);
    if (index !== -1) { exerciseSessions.splice(index, 1); }
  }
}


export { createSet, getSessionsForExercise, updateSessionData, deleteSession, sessionFromApi };
