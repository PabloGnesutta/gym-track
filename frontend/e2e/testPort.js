/**
 * Fixed port dedicated to the e2e suite's own backend instance, deliberately
 * decoupled from whatever PORT is in backend/.env (used by `npm run serve`
 * for manual dev). playwright.config.js passes this to the webServer it
 * spawns via `env: { PORT: ... }`, so the e2e backend always listens here
 * regardless of .env - without this, an e2e run and a manually-running dev
 * server would be the same process on the same port talking to the same
 * database file, and resetting/wiping the e2e database for a clean run (or
 * Playwright's `reuseExistingServer` picking up "whatever's already
 * listening") could wipe or hijack real local dev data. Pick a different
 * value here if this one ever collides with something else on your machine.
 */
export const TEST_PORT = '3999';
