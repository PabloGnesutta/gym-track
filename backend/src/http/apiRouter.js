import { db } from '../db/db.js';
import { readJsonBody, INVALID_JSON_MESSAGE } from './bodyParser.js';
import { errorResponse, successResponse } from './httpResponses.js';
import { createAuthService } from '../services/authService.js';
import { createExerciseService } from '../services/exerciseService.js';
import { createSessionService } from '../services/sessionService.js';
import { createAnalyticsService } from '../services/analyticsService.js';
import { createMuscleService } from '../services/muscleService.js';
import { ServiceError } from '../services/ServiceError.js';
import { error } from '../logger/logger.js';


const authService = createAuthService(db);
const exerciseService = createExerciseService(db);
const sessionService = createSessionService(db, exerciseService);
const analyticsService = createAnalyticsService(db, exerciseService);
const muscleService = createMuscleService(db);

/**
 * @param {import('./types').ApiRequest} req
 */
function getBearerUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const [, token] = authHeader.split(' ');
  return token ? authService.getUserBySessionToken(token) : null;
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
      const user = authService.createUser(body.email, body.password, body.name);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }
    if (route === 'login') {
      const user = authService.verifyLogin(body.email, body.password);
      const accessToken = authService.createSession(user.id);
      return successResponse(res, { accessToken, userId: user.id, email: user.email, name: user.name });
    }
    if (route === 'requestPasswordReset') {
      return successResponse(res, await authService.requestPasswordReset(body.email));
    }
    if (route === 'resetPassword') {
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
    error('---Error @handleApiRequest', err);
    return errorResponse(res, 'Something went wrong', 500);
  }
}
