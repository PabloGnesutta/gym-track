import { test, expect } from '@playwright/test';
import { allowTestEmail } from './helpers.js';


/**
 * Writes an exercise directly into the browser's IndexedDB, bypassing the
 * app entirely - reproducing what a real pre-accounts installation would
 * have sitting locally. Deliberately opens with no version argument (just
 * "whatever version already exists") rather than pinning `dbVersion` - the
 * app's own connection is already open at that version by the time
 * #authView is visible (see callers), and a second `open()` pinned to the
 * *same* version still fires `blocked` in practice instead of `success`.
 * @param {import('@playwright/test').Page} page
 */
async function seedLegacyExercise(page) {
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('GymTrack');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('exercises', 'readwrite');
        tx.objectStore('exercises').add({
          name: 'Ejercicio Legado',
          muscles: ['legado'],
          normalizedName: 'ejercicio legado',
          normalizedMuscles: 'legado',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSession: null,
        });
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test('a device with pre-existing IndexedDB data is offered a one-time import on first login, and accepting it uploads the exercise to the account', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  allowTestEmail(email);

  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
  await seedLegacyExercise(page);

  page.on('dialog', dialog => dialog.accept());

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();

  await expect(page.locator('.row', { hasText: 'Ejercicio Legado' })).toBeVisible();
});

test('declining the import leaves the account with no exercises', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  allowTestEmail(email);

  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
  await seedLegacyExercise(page);

  page.on('dialog', dialog => dialog.dismiss());

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();

  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('#exerciseListView .row')).toHaveCount(0);
});

test('the import is only offered once - a second login on the same device does not ask again', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  allowTestEmail(email);

  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
  await seedLegacyExercise(page);

  page.on('dialog', dialog => dialog.accept());

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await expect(page.locator('.row', { hasText: 'Ejercicio Legado' })).toBeVisible();

  let dialogFired = false;
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => { dialogFired = true; dialog.dismiss(); });

  await page.locator('#logoutBtn .btn').click();
  await expect(page.locator('#authView')).toBeVisible();
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Iniciar Sesión').click();

  await expect(page.locator('.row', { hasText: 'Ejercicio Legado' })).toBeVisible();
  expect(dialogFired).toBe(false);
});
