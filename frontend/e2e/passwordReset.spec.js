import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowTestEmail } from './helpers.js';


const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../backend/data/gymtrack.test.db');

/**
 * Reads the reset token straight out of the e2e backend's own sqlite file -
 * there's no real inbox in e2e, same reasoning as helpers.js's
 * allowTestEmail() reaching into the same database directly.
 * @param {string} email
 * @returns {string}
 */
function readResetToken(email) {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000');
  try {
    const row = db.prepare('SELECT password_reset_token FROM users WHERE email = ?').get(email);
    return /** @type {string} */ (row && row.password_reset_token);
  } finally {
    db.close();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
});

test('requesting a reset, then submitting a new password via the emailed link, lets the user log in with it', async ({ page }) => {
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const oldPassword = 'password123';
  const newPassword = 'newPassword456';
  allowTestEmail(email);

  // Sign up first - password reset only makes sense for an existing account.
  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', oldPassword);
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.locator('#headerMenuBtn .btn').click();
  await page.locator('#logoutBtn .btn').click();
  await expect(page.locator('#authView')).toBeVisible();

  // Request the reset link.
  await page.click('#authForgotPasswordBtn');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.locator('#authForm .submit').getByText('Enviar Link').click();
  await expect(page.locator('.dialog-message')).toContainText('Si el email existe');
  await page.click('#dialogConfirmBtn');

  const token = readResetToken(email);
  expect(token).toBeTruthy();

  // Follow the link, submit a new password.
  await page.goto(`/?resetToken=${token}`);
  await expect(page.locator('#authNewPasswordField')).toBeVisible();
  await page.fill('#authForm input[name="authNewPassword"]', newPassword);
  await page.fill('#authForm input[name="authNewPasswordConfirm"]', newPassword);
  await page.locator('#authForm .submit').getByText('Guardar Contraseña').click();
  await expect(page.locator('.dialog-title')).toContainText('Contraseña actualizada');
  await page.click('#dialogConfirmBtn');

  // Old password no longer works, new one does.
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', oldPassword);
  await page.locator('#authForm .submit').getByText('Iniciar Sesión').click();
  await expect(page.locator('#authView')).toBeVisible();
  // The failed login opens the debug logger panel (lib/logger.js's
  // _error() -> openLogs()), which then overlaps the form.
  await page.locator('#closeLogsBtn').click();

  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', newPassword);
  await page.locator('#authForm .submit').getByText('Iniciar Sesión').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('a mismatched confirm-password shows an error and does not submit', async ({ page }) => {
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  allowTestEmail(email);

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.locator('#headerMenuBtn .btn').click();
  await page.locator('#logoutBtn .btn').click();

  await page.click('#authForgotPasswordBtn');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.locator('#authForm .submit').getByText('Enviar Link').click();
  await page.click('#dialogConfirmBtn');

  const token = readResetToken(email);
  await page.goto(`/?resetToken=${token}`);
  await page.fill('#authForm input[name="authNewPassword"]', 'newPassword456');
  await page.fill('#authForm input[name="authNewPasswordConfirm"]', 'somethingElse');
  await page.locator('#authForm .submit').getByText('Guardar Contraseña').click();

  await expect(page.locator('.dialog-message')).toContainText('no coinciden');
  await page.click('#dialogConfirmBtn');
  await expect(page.locator('#authNewPasswordField')).toBeVisible();
});
