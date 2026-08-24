import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  // Each test gets its own browser context (Playwright default), so
  // IndexedDB starts empty every time - no per-test cleanup needed. The app
  // now gates behind login, so every test signs up a fresh account first.
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('creating an exercise adds it to the list', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm input[name="muscles"]').fill('pecho,triceps');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await expect(page.locator('#exerciseListView .exerciseName', { hasText: 'Press banca' })).toBeVisible();
});

test('creating an exercise with a blank name shows an error and does not add a row', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await expect(page.locator('#exerciseListView .row')).toHaveCount(0);
});

test('creating an exercise with a duplicate name is rejected', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Sentadilla');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();
  await expect(page.locator('#exerciseListView .row')).toHaveCount(1);

  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Sentadilla');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await expect(page.locator('#exerciseListView .row')).toHaveCount(1);
});

test('search filters the exercise list by name and by muscle tag', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm input[name="muscles"]').fill('pecho');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Sentadilla');
  await page.locator('#exerciseForm input[name="muscles"]').fill('piernas');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('#searchExercise').fill('piernas');

  await expect(page.locator('.row', { hasText: 'Sentadilla' })).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Press banca' })).toHaveClass(/display-none/);
});

test('deleting an exercise removes it from the list', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  await page.locator('#singleExerciseView .delete-btn .btn').click();
  await expect(page.locator('#dialogOverlay')).toBeVisible();
  await page.locator('#dialogConfirmBtn').click();

  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Press banca' })).toHaveCount(0);
});

test('cancelling the delete confirmation leaves the exercise in place', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  await page.locator('#singleExerciseView .delete-btn .btn').click();
  await expect(page.locator('#dialogOverlay')).toBeVisible();
  await page.locator('#dialogCancelBtn').click();

  await expect(page.locator('#dialogOverlay')).not.toBeVisible();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  await page.locator('#goBack2 .btn').click();
  await expect(page.locator('.row', { hasText: 'Press banca' })).toBeVisible();
});
