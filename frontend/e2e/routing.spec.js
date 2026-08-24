import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('opening an exercise updates the URL, and refreshing there stays on that exercise instead of resetting to the list', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();
  await expect(page).toHaveURL(/\/exercise\/\d+$/);

  await page.reload();

  await expect(page.locator('#singleExerciseView')).toBeVisible();
  await expect(page.locator('#singleExerciseView .name')).toHaveText('Press banca');
  await expect(page.locator('#exerciseListView')).not.toBeVisible();
});

test('going back to the list from an exercise replaces the URL back to /', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page).toHaveURL(/\/exercise\/\d+$/);

  await page.locator('#goBack2 .btn').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('the browser back button returns from an exercise to the list', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  await page.goBack();

  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('#singleExerciseView')).not.toBeVisible();
});

test('a deep link straight to a nonexistent exercise falls back to the list instead of a blank page', async ({ page }) => {
  await page.goto('/exercise/999999');

  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('the bottom tab bar navigates between the exercise list and the analytics placeholder, keeping the URL in sync', async ({ page }) => {
  await page.locator('[data-tab="analytics"]').click();

  await expect(page.locator('#analyticsView')).toBeVisible();
  await expect(page.locator('#exerciseListView')).not.toBeVisible();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.locator('[data-tab="analytics"]')).toHaveCSS('color', 'rgb(169, 123, 255)');

  await page.locator('[data-tab="exercises"]').click();

  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('#analyticsView')).not.toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('a direct deep link to /analytics renders the placeholder on load', async ({ page }) => {
  await page.goto('/analytics');

  await expect(page.locator('#analyticsView')).toBeVisible();
});

test('the header menu shows the logged-in user\'s email', async ({ page }) => {
  await page.locator('#headerMenuBtn .btn').click();

  await expect(page.locator('#headerMenuUserEmail')).toBeVisible();
  await expect(page.locator('#headerMenuUserEmail')).not.toHaveText('');
});
