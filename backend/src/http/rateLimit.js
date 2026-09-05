/**
 * Minimal in-memory sliding-window rate limiter for the unauthenticated auth
 * routes (signup/login/password-reset) - there's no external store (Redis
 * etc) in this app's stack, and at personal-app scale a per-process Map is
 * plenty. Not meant to survive a restart or work across multiple processes;
 * good enough to blunt naive brute-force/credential-stuffing against a
 * single-instance deployment.
 *
 * Disabled under the e2e test backend (see playwright.config.js's webServer
 * `env.NODE_ENV`), which signs up dozens of accounts from the same loopback
 * address in a single run - the same reasoning as that config's own
 * `DB_NAME` isolation, just for this instead of the database file.
 */
const RATE_LIMITING_ENABLED = process.env.NODE_ENV !== 'test';

/** @type {Map<string, number[]>} */
const attemptsByKey = new Map();

/**
 * Records one attempt for `key` and reports whether it should be blocked.
 * @param {string} key
 * @param {number} maxAttempts
 * @param {number} windowMs
 * @returns {boolean} true if this attempt exceeds the allowed rate
 */
function isRateLimited(key, maxAttempts, windowMs) {
  if (!RATE_LIMITING_ENABLED) { return false; }

  const now = Date.now();
  const attempts = (attemptsByKey.get(key) || []).filter(t => now - t < windowMs);
  attempts.push(now);
  attemptsByKey.set(key, attempts);

  return attempts.length > maxAttempts;
}

export { isRateLimited };
