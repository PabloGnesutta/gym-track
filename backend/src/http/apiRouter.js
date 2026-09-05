import { db } from '../db/db.js';
import { readJsonBody, INVALID_JSON_MESSAGE, PAYLOAD_TOO_LARGE_MESSAGE } from './bodyParser.js';
import { errorResponse, successResponse } from './httpResponses.js';
import { createAuthService } from '../services/authService.js';
import { createExerciseService } from '../services/exerciseService.js';
import { createSessionService } from '../services/sessionService.js';
import { createAnalyticsService } from '../services/analyticsService.js';
import { createMuscleService } from '../services/muscleService.js';
import { ServiceError } from '../services/ServiceError.js';
import { isRateLimited } from './rateLimit.js';
import { error } from '../logger/logger.js';


const authService = createAuthService(db);
const exerciseService = createExerciseService(db);
const sessionService = createSessionService(db, exerciseService);
const analyticsService = createAnalyticsService(db, exerciseService);
const muscleService = createMuscleService(db);

const TOO_MANY_ATTEMPTS_MESSAGE = 'Demasiados intentos. Probá de nuevo más tarde.';
// Login is throttled per-email (catches an attacker brute-forcing one
// account regardless of source IP); signup/password-reset are throttled
// per-IP (there's no account to key on yet, or the target of the attempt is
// someone else's inbox/allow-list slot, not the caller's).
const LOGIN_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const SIGNUP_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
const PASSWORD_RESET_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

/**
 * @param {import('./types').ApiRequest} req
 */
function getBearerUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const [, token] = authHeader.split(' ');
  return token ? authService.getUserBySessionToken(token) : null;
}

/**
 * @param {import('./types').ApiRequest} req
 * @returns {string}
 */
function getClientIp(req) {
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Routes /api/* requests. All routes are POST-only, matching the frontend's
 * apiCaller.js, which always does `fetch('/api/' + path, {method: 'POST'})`.
 * @param {import('./types').ApiRequest} req
 * @param {import('./types').ApiResponse} res
 * @param {string[]} segments - path segments after 'api', e.g. ['exercises','create']
 */
export async function handleApiRequest(req, res, segments) {
  const route = segments.join('/');
  try {
    const body = await readJsonBody(req);

    if (route === 'signup') {
      if (isRateLimited('signup:' + getClientIp(req), SIGNUP_RATE_LIMIT.max, SIGNUP_RATE_LIMIT.windowMs)) {
        return errorResponse(res, TOO_MANY_ATTEMPTS_MESSAGE, 429);
      }
      const user = authService.createUser(body.email, body.password, body.name);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }
    if (route === 'login') {
      const emailKey = String(body.email || '').trim().toLowerCase();
      if (isRateLimited('login:' + emailKey, LOGIN_RATE_LIMIT.max, LOGIN_RATE_LIMIT.windowMs)) {
        return errorResponse(res, TOO_MANY_ATTEMPTS_MESSAGE, 429);
      }
      const user = authService.verifyLogin(body.email, body.password);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }
    if (route === 'requestPasswordReset') {
      if (isRateLimited('resetRequest:' + getClientIp(req), PASSWORD_RESET_RATE_LIMIT.max, PASSWORD_RESET_RATE_LIMIT.windowMs)) {
        return errorResponse(res, TOO_MANY_ATTEMPTS_MESSAGE, 429);
      }
      return successResponse(res, await authService.requestPasswordReset(body.email));
    }
    if (route === 'resetPassword') {
      if (isRateLimited('resetPassword:' + getClientIp(req), PASSWORD_RESET_RATE_LIMIT.max, PASSWORD_RESET_RATE_LIMIT.windowMs)) {
        return errorResponse(res, TOO_MANY_ATTEMPTS_MESSAGE, 429);
      }
      return successResponse(res, authService.resetPassword(body.token, body.newPassword));
    }

    // Every route below requires a valid bearer token.
    const user = getBearerUser(req);
    if (!user) { return errorResponse(res, 'No autorizado', 401); }

    if (route === 'whoami') { return successResponse(res, user); }
    if (route === 'logout') {
      const [, token] = (req.headers['authorization'] || '').split(' ');
      authService.deleteSession(token);
      return successResponse(res, { ok: true });
    }

    if (route === 'exercises/fetch') { return successResponse(res, exerciseService.listExercises(user.id)); }
    if (route === 'exercises/create') { return successResponse(res, exerciseService.createExercise(user.id, body.name, body.muscles)); }
    if (route === 'exercises/update') { return successResponse(res, exerciseService.updateExercise(user.id, body.exerciseId, body)); }
    if (route === 'exercises/favorite') {
      return successResponse(res, exerciseService.setFavorite(user.id, body.exerciseId, !!body.isFavorite));
    }
    if (route === 'exercises/delete') {
      exerciseService.deleteExercise(user.id, body.exerciseId);
      return successResponse(res, { ok: true });
    }

    if (route === 'muscles/fetch') { return successResponse(res, muscleService.listMuscles(user.id)); }
    if (route === 'muscles/rename') { return successResponse(res, muscleService.renameMuscle(user.id, body.muscleId, body.name)); }
    if (route === 'muscles/delete') {
      muscleService.deleteMuscle(user.id, body.muscleId);
      return successResponse(res, { ok: true });
    }

    if (route === 'sessions/fetch') { return successResponse(res, sessionService.listSessionsForExercise(user.id, body.exerciseId)); }
    if (route === 'sessions/addSet') {
      return successResponse(res, sessionService.addSet(user.id, body.exerciseId, { weight: body.weight, reps: body.reps }, body.date));
    }
    if (route === 'sessions/update') { return successResponse(res, sessionService.updateSession(user.id, body.sessionId, body)); }
    if (route === 'sessions/delete') {
      sessionService.deleteSession(user.id, body.sessionId);
      return successResponse(res, { ok: true });
    }

    if (route === 'analytics/summary') { return successResponse(res, analyticsService.getSummary(user.id)); }
    if (route === 'analytics/exerciseHistory') {
      return successResponse(res, analyticsService.getExerciseHistory(user.id, body.exerciseId));
    }

    return errorResponse(res, 'Ruta de API no encontrada: ' + route, 404);
  } catch (err) {
    if (err instanceof ServiceError) { return errorResponse(res, err.message, 400); }
    if (err instanceof Error && err.message === INVALID_JSON_MESSAGE) {
      return errorResponse(res, err.message, 400);
    }
    if (err instanceof Error && err.message === PAYLOAD_TOO_LARGE_MESSAGE) {
      return errorResponse(res, err.message, 413);
    }
    error('---Error @handleApiRequest', err);
    return errorResponse(res, 'Something went wrong', 500);
  }
}
