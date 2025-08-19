import { verifyJWT } from '../auth/jwt.js';


/**
 * Checks for valid JWT and populates req.user
 * Returns null if OK
 * @param {import('./types').ApiRequest} req
 * @returns {string | null}
 */
export function authorize(req) {
  if (!req.headers.authorization) {
    return 'Not authenticated';
  }
  const accessToken = req.headers.authorization.substring(7)
  if (!accessToken) {
    return 'No token present'
  }
  const userData = verifyJWT(accessToken);
  if (!userData) {
    return 'Invalid token';
  }
  req.user = userData;
  return null;
}