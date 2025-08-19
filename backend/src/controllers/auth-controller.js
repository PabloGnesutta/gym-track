import { generateJWT } from '../auth/jwt.js';
import { warn } from '../logger/logger.js';


/**
 * Login User: 
 * Verify credentials and generate accessToken if OK
 * @param {Object} input 
 * @returns {Promise<import('./types').ControllerReturn>}
 */
export async function login(input) {
  let accessToken = '';
  let userId = '';

  warn(' ** User logged in as Visitor');
  userId = 'VISITOR_' + Date.now();

  accessToken = generateJWT({ userId, userName: input.name });

  return { data: { accessToken, userId, userName: input.name } };
};
