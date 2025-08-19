import { log } from '../logger/logger.js';
import { login } from '../controllers/auth-controller.js';
import { authorize } from './middleware.js';


/**
 * Handles the routing of requests done to the API
 * TODO: Support URL search params
 * @param {import('./types.js').ApiRequest} req
 * @returns {Promise<import('../controllers/types.js').ControllerReturn>}
 */
export async function apiRouter(req) {
  log(' [**]', req.url);

  // ------------------------- 
  // Non-authenticated routes:
  // -------------------------
  switch (req.url) {
    case '/api/login':
      return login(req.body);
    default: break;
  }

  // ---------------------------------- 
  // Routes that require Authorization:
  // ----------------------------------
  const authError = authorize(req);
  if (authError) {
    return { error: authError, status: 401 };
  } else {
    log(' - User data from token:', req.user);
  }

  switch (req.url) {
    case '/api/test':
      return { data: { test: 'OK' } };
    case '/api/whoami':
      return { data: req.user };
    default:
      return { error: 'Route not found' };
  }
}
