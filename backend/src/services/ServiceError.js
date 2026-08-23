/**
 * A rejection with a user-facing message (bad input, duplicate name, not
 * found) - once routes exist to call these services, the API router can map
 * a ServiceError to a 400 instead of logging it as an unexpected server
 * error, the same split `httpResponses.js`'s `jsonResponse`/`errorResponse`
 * already draw.
 */
class ServiceError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
  }
}

export { ServiceError };
