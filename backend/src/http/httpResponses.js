import { debug } from '../logger/logger.js';


/**
 * @param {import('./types').ApiResponse} res
 * @param {Object} data
 * @param {number} [status=200] - Default 200
 */
export function jsonResponse(res, data = {}, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  return res.end(JSON.stringify({ data }));
}

/**
 * @param {import('./types').ApiResponse} res
 * @param {string} msg
 * @param {number} [status=400] - Default 400
 */
export function errorResponse(res, msg, status = 400) {
  debug(' @errorResponse:', msg);
  res.writeHead(status, { 'content-type': 'application/json' });
  return res.end(JSON.stringify({ error: msg }));
}
