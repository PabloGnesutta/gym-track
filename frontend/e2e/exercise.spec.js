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

test('favoriting an exercise from the list pins it above a more recently created one', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Sentadilla');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  const sentadillaRow = page.locator('.row[data-exercise-key]', { hasText: 'Sentadilla' });
  const pressRow = page.locator('.row[data-exercise-key]', { hasText: 'Press banca' });
  await pressRow.locator('.favorite-btn').click();
  await expect(pressRow).toHaveClass(/favorited/);

  // The list is a flex column reordered via CSS `order`, not DOM position
  // (see style.css's `.favorited`/`[data-timestamp="hoy"]` rules) - so the
  // pin-to-top has to be asserted on computed style, not locator .first().
  const pressOrder = await pressRow.evaluate(el => Number(getComputedStyle(el).order));
  const sentadillaOrder = await sentadillaRow.evaluate(el => Number(getComputedStyle(el).order));
  expect(pressOrder).toBeLessThan(sentadillaOrder);
});

test('unfavoriting an exercise drops it back out of the pinned position', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  const row = page.locator('.row[data-exercise-key]', { hasText: 'Press banca' });
  await row.locator('.favorite-btn').click();
  await expect(row).toHaveClass(/favorited/);

  await row.locator('.favorite-btn').click();
  await expect(row).not.toHaveClass(/favorited/);
});

test('toggling favorite from the single-exercise view stays in sync with the list row', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  await page.locator('#singleExerciseView .favorite-btn .btn').click();
  await expect(page.locator('#singleExerciseView .favorite-btn')).toHaveClass(/active/);

  await page.locator('#goBack2 .btn').click();
  await expect(page.locator('.row[data-exercise-key]', { hasText: 'Press banca' })).toHaveClass(/favorited/);
});

test('a favorited exercise stays favorited after a page reload', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row[data-exercise-key]', { hasText: 'Press banca' }).locator('.favorite-btn').click();

  await page.reload();
  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('.row[data-exercise-key]', { hasText: 'Press banca' })).toHaveClass(/favorited/);
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
