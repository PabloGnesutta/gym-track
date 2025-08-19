import jwt from 'jsonwebtoken';
import { warn } from '../logger/logger.js';


/**
 * @param {Object} payload 
 * @returns {String}
 */
export function generateJWT(payload) {
  const token = jwt.sign(
    { payload },
    process.env.TOKEN_SECRET || '',
    { expiresIn: 999 },
  );

  return token;
}

/**
 * @param {String} token 
 * @returns {import('../http/types').ReqUser | null}
 */
export function verifyJWT(token) {
  try {
    /** @type {{ payload: import('../http/types').ReqUser} | string} */
    // @ts-ignore
    const verified = jwt.verify(token, process.env.TOKEN_SECRET || '');
    if (typeof verified === 'string') {
      return null;
    }
    return verified.payload;
  } catch (_err) {
    warn('Error @verifyJWT:', _err.message);
    return null;
  }
}
