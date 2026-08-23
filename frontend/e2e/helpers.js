import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addAllowedEmail } from '../../backend/src/db/allowedEmails.js';


const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../backend/data/gymtrack.test.db');

/**
 * Allow-lists an email directly against the e2e backend's own sqlite file
 * (see playwright.config.js's webServer `env.DB_NAME`) so signup can
 * succeed - signup is gated behind `allowed_emails`, matching car-track's
 * own e2e helper for the same gate.
 * @param {string} email
 */
function allowTestEmail(email) {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000');
  try {
    addAllowedEmail(db, email);
  } finally {
    db.close();
  }
}

/**
 * Signs up a brand-new account and waits for the app to reach the ready
 * state. Every test starts from a fresh browser context (empty IndexedDB,
 * no cached session), so this always runs on the very first navigation.
 * Always creates a unique account - the backend's sqlite file is NOT reset
 * between test runs the way a fresh context resets IndexedDB.
 * @param {import('@playwright/test').Page} page
 */
async function ensureAuth(page) {
  const uniqueEmail = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'password123';
  allowTestEmail(uniqueEmail);

  // The form opens in login mode (no name field) - switch to signup first.
  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', uniqueEmail);
  await page.fill('#authForm input[name="authPassword"]', password);
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await page.waitForSelector('#authForm', { state: 'hidden' });
}

export { allowTestEmail, ensureAuth };
