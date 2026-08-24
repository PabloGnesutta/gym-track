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

/**
 * Same idea as seedLegacyExercise, but with two sessions on two different
 * past days attached, for testing the actual session-replay path (not just
 * the exercise-only path the other tests cover).
 * @param {import('@playwright/test').Page} page
 */
async function seedLegacyExerciseWithSessions(page) {
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('GymTrack');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['exercises', 'sessions'], 'readwrite');
        const addExercise = tx.objectStore('exercises').add({
          name: 'Ejercicio Legado',
          muscles: ['legado'],
          normalizedName: 'ejercicio legado',
          normalizedMuscles: 'legado',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSession: null,
        });
        addExercise.onsuccess = () => {
          const exerciseKey = addExercise.result;
          const sessions = tx.objectStore('sessions');
          const tenDaysAgo = new Date();
          tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          sessions.add({ exerciseKey, date: tenDaysAgo, sets: [{ w: 40, r: [10, 8] }], notes: '' });
          sessions.add({ exerciseKey, date: threeDaysAgo, sets: [{ w: 42.5, r: [8, 6] }], notes: 'segunda sesión' });
        };
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test('importing an exercise with session history uploads both past sessions, and re-running the import does not duplicate them', async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;
  allowTestEmail(email);

  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
  await seedLegacyExerciseWithSessions(page);

  page.on('dialog', dialog => dialog.accept());

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'password123');
  await page.locator('#authForm .submit').getByText('Crear Cuenta').click();
  await expect(page.locator('.row', { hasText: 'Ejercicio Legado' })).toBeVisible();

  await page.locator('.row', { hasText: 'Ejercicio Legado' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();
  await expect(page.locator('.previous-days-log .row')).toHaveCount(2);

  // Force the status back to 'pending' (as if a prior run had failed
  // partway) and reload - this re-triggers maybeImportLegacyData() with no
  // re-prompt (status isn't unset), exercising the exact retry path the
  // real bug needed: importBatch() must reconcile against what's already
  // there rather than blindly re-posting everything.
  await page.evaluate(() => localStorage.setItem('legacyImportStatus', JSON.stringify({ status: 'pending' })));
  await page.reload();
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await expect(page.locator('#exerciseListView .row')).toHaveCount(1);
  await page.locator('.row', { hasText: 'Ejercicio Legado' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();
  await expect(page.locator('.previous-days-log .row')).toHaveCount(2);
  await expect(page.locator('.previous-days-log .row', { hasText: '40kg X 10,8' })).toBeVisible();
  await expect(page.locator('.previous-days-log .row', { hasText: '42.5kg X 8,6' })).toBeVisible();
});

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
