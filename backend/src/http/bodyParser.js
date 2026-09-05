export const INVALID_JSON_MESSAGE = 'JSON inválido';
export const PAYLOAD_TOO_LARGE_MESSAGE = 'Cuerpo de la petición demasiado grande';

// Every real payload this app sends (exercise/session/muscle JSON, including
// a full session's sets and notes) is a few KB at most - 1MB is generous
// headroom while still bounding how much an unauthenticated request (this
// runs before the bearer-token check, on signup/login too) can force the
// process to buffer in memory.
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Reads and JSON-parses a request body. Resolves {} for an empty body.
 * @param {import('./types').ApiRequest} req
 * @returns {Promise<Object>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) { return; }
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        // Stop accumulating (caps memory use) but don't destroy the
        // request's socket - req/res share it, so destroying it here would
        // drop the connection before apiRouter.js's catch block ever gets a
        // chance to send back a clean 413. The rest of the body still
        // arrives and is discarded below.
        tooLarge = true;
        reject(new Error(PAYLOAD_TOO_LARGE_MESSAGE));
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (tooLarge) { return; }
      if (!raw) { return resolve({}); }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error(INVALID_JSON_MESSAGE));
      }
    });
    req.on('error', reject);
  });
}
