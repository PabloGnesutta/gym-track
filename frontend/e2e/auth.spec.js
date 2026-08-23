import { test, expect } from '@playwright/test';
import { allowTestEmail, ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
});

test('signing up with a non-allow-listed email is rejected', async ({ page }) => {
  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', `not-allowed-${Date.now()}@test.local`);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();

  await expect(page.locator('#authView')).toBeVisible();
  await expect(page.locator('#exerciseListView')).not.toBeVisible();
});

test('signup with an allow-listed email logs the user straight in', async ({ page }) => {
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('logging out returns to the login form', async ({ page }) => {
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.locator('#logoutBtn .btn').click();

  await expect(page.locator('#authView')).toBeVisible();
  await expect(page.locator('#exerciseListView')).not.toBeVisible();
});

test('logging back in with the right password succeeds', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  const password = 'password123';
  allowTestEmail(email);

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', password);
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.locator('#logoutBtn .btn').click();
  await expect(page.locator('#authView')).toBeVisible();

  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', password);
  await page.locator('#authForm .submit').getByText('Iniciar Sesión').click();

  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('logging in with the wrong password is rejected', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  allowTestEmail(email);

  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'wrong-password');
  await page.locator('#authForm .submit').getByText('Iniciar Sesión').click();

  await expect(page.locator('#authView')).toBeVisible();
});

test('a session persists across a page reload', async ({ page }) => {
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.reload();

  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('#authView')).not.toBeVisible();
});
