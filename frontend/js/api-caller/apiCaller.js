import { _error } from "../lib/logger.js";


const ACCESS_TOKEN_KEY = 'accessToken';
const USER_ID_KEY = 'userId';
const USER_EMAIL_KEY = 'userEmail';
const USER_NAME_KEY = 'userName';

/**
 * @typedef {object} ApiCallResult
 * @property {*} [data]
 * @property {string} [error]
 * @property {number} [status]
 */

/**
 * @param {{accessToken: string, userId: number, email: string, name: string}} session
 */
function persistSession(session) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_ID_KEY, String(session.userId));
  localStorage.setItem(USER_EMAIL_KEY, session.email);
  localStorage.setItem(USER_NAME_KEY, session.name || '');
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(USER_NAME_KEY);
}

/** @returns {string|null} */
function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** @returns {string|null} */
function getUserEmail() {
  return localStorage.getItem(USER_EMAIL_KEY);
}

/** @returns {boolean} */
function isLoggedIn() {
  return !!getAccessToken();
}

/**
 * Calls a backend /api/* route. Every route is POST-only (matches the
 * backend's flat apiRouter.js). Never throws - resolves {data} on success or
 * {error, status} on failure, so callers can decide how to degrade (e.g.
 * show a "sin conexión" state) instead of crashing.
 * @param {string} path
 * @param {Object} [payload]
 * @returns {Promise<ApiCallResult>}
 */
async function apiCall(path, payload = {}) {
  const token = getAccessToken();
  try {
    const response = await fetch('/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: body.error || 'Error de red', status: response.status };
    }
    return { data: body.data };
  } catch (err) {
    _error(' - apiCall failed (offline or unreachable):', path, err);
    return { error: 'Sin conexión', status: 0 };
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} [name]
 */
async function apiSignup(email, password, name = '') {
  const result = await apiCall('signup', { email, password, name });
  if (result.data) { persistSession(result.data); }
  return result;
}

/**
 * @param {string} email
 * @param {string} password
 */
async function apiLogin(email, password) {
  const result = await apiCall('login', { email, password });
  if (result.data) { persistSession(result.data); }
  return result;
}

async function apiLogout() {
  const result = await apiCall('logout', {});
  clearSession();
  return result;
}

/**
 * @param {string} name
 * @param {string[]} [muscles]
 */
async function apiCreateExercise(name, muscles) {
  return apiCall('exercises/create', { name, muscles });
}

async function apiFetchExercises() {
  return apiCall('exercises/fetch', {});
}

/**
 * @param {number} exerciseId
 * @param {{name?: string, muscles?: string[]}} patch
 */
async function apiUpdateExercise(exerciseId, patch) {
  return apiCall('exercises/update', { exerciseId, ...patch });
}

/**
 * @param {number} exerciseId
 */
async function apiDeleteExercise(exerciseId) {
  return apiCall('exercises/delete', { exerciseId });
}

/**
 * @param {number} exerciseId
 */
async function apiFetchSessions(exerciseId) {
  return apiCall('sessions/fetch', { exerciseId });
}

/**
 * @param {number} exerciseId
 * @param {{weight: number, reps: number, date?: number}} setData
 */
async function apiAddSet(exerciseId, setData) {
  return apiCall('sessions/addSet', { exerciseId, ...setData });
}

/**
 * @param {number} sessionId
 * @param {{sets?: {w: number, r: number[]}[], notes?: string}} patch
 */
async function apiUpdateSession(sessionId, patch) {
  return apiCall('sessions/update', { sessionId, ...patch });
}

/**
 * @param {number} sessionId
 */
async function apiDeleteSession(sessionId) {
  return apiCall('sessions/delete', { sessionId });
}

async function apiFetchAnalyticsSummary() {
  return apiCall('analytics/summary', {});
}

/**
 * @param {number} exerciseId
 */
async function apiGetExerciseHistory(exerciseId) {
  return apiCall('analytics/exerciseHistory', { exerciseId });
}

async function apiFetchMuscles() {
  return apiCall('muscles/fetch', {});
}

/**
 * @param {number} muscleId
 * @param {string} name
 */
async function apiRenameMuscle(muscleId, name) {
  return apiCall('muscles/rename', { muscleId, name });
}

/**
 * @param {number} muscleId
 */
async function apiDeleteMuscle(muscleId) {
  return apiCall('muscles/delete', { muscleId });
}


export {
  apiCall, apiSignup, apiLogin, apiLogout, isLoggedIn, getAccessToken, getUserEmail, clearSession,
  apiCreateExercise, apiFetchExercises, apiUpdateExercise, apiDeleteExercise,
  apiFetchSessions, apiAddSet, apiUpdateSession, apiDeleteSession,
  apiFetchAnalyticsSummary, apiGetExerciseHistory,
  apiFetchMuscles, apiRenameMuscle, apiDeleteMuscle,
};
