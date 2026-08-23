import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();

  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();
  await page.locator('.row', { hasText: 'Press banca' }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();
});

test('a fresh exercise has no recorded sets', async ({ page }) => {
  await expect(page.locator('.current-date-log')).toContainText('No hay sets registrados');
});

test('adding a set records it in today\'s history and on the exercise row', async ({ page }) => {
  await page.locator('#createSetForm input[name="weight"]').fill('40');
  await page.locator('#createSetForm input[name="reps"]').fill('10');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();

  await expect(page.locator('.current-date-log .row')).toContainText('40kg X 10');

  await page.locator('#goBack2 .btn').click();
  await expect(page.locator('#exerciseListView')).toBeVisible();
  await expect(page.locator('.row', { hasText: 'Press banca' }).locator('.last-set-data')).toContainText('40kg x 10');
});

test('adding a second set at the same weight groups reps under one row', async ({ page }) => {
  await page.locator('#createSetForm input[name="weight"]').fill('40');
  await page.locator('#createSetForm input[name="reps"]').fill('10');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();

  await page.locator('#createSetForm input[name="weight"]').fill('40');
  await page.locator('#createSetForm input[name="reps"]').fill('8');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();

  await expect(page.locator('.current-date-log .row')).toHaveCount(1);
  await expect(page.locator('.current-date-log .row')).toContainText('40kg X 10,8');
});
