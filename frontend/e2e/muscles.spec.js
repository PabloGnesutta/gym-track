import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} [muscles]
 */
async function createExercise(page, name, muscles) {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill(name);
  if (muscles) { await page.locator('#exerciseForm input[name="muscles"]').fill(muscles); }
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();
}

/** @param {import('@playwright/test').Page} page */
async function openMusclesView(page) {
  await page.locator('#headerMenuBtn .btn').click();
  await page.locator('#musclesMenuBtn .btn').click();
  await expect(page.locator('#musclesView')).toBeVisible();
}

test('lists every muscle tag with its exercise count', async ({ page }) => {
  await createExercise(page, 'Press banca', 'pecho,triceps');
  await createExercise(page, 'Sentadilla', 'piernas,pecho');
  await openMusclesView(page);

  await expect(page.locator('.muscle-row', { hasText: 'pecho' })).toContainText('2 ejercicios');
  await expect(page.locator('.muscle-row', { hasText: 'triceps' })).toContainText('1 ejercicio');
});

test('renaming a muscle to a new name updates it everywhere', async ({ page }) => {
  await createExercise(page, 'Press banca', 'pecho');
  await openMusclesView(page);

  await page.locator('.muscle-row', { hasText: 'pecho' }).locator('[data-action="edit"]').click();
  await page.locator('.muscle-row-input').fill('torso');
  await page.locator('.muscle-row [data-action="save"]').click();

  await expect(page.locator('.muscle-row', { hasText: 'torso' })).toBeVisible();
  await expect(page.locator('.muscle-row', { hasText: 'pecho' })).toHaveCount(0);
});

test('renaming a muscle to an existing name merges the two tags', async ({ page }) => {
  await createExercise(page, 'Press banca', 'pecho');
  await createExercise(page, 'Aperturas', 'torso');
  await openMusclesView(page);

  await page.locator('.muscle-row', { hasText: 'torso' }).locator('[data-action="edit"]').click();
  await page.locator('.muscle-row-input').fill('pecho');
  await page.locator('.muscle-row [data-action="save"]').click();

  await expect(page.locator('.muscle-row', { hasText: 'pecho' })).toContainText('2 ejercicios');
  await expect(page.locator('.muscle-row', { hasText: 'torso' })).toHaveCount(0);
});

test('deleting a used muscle warns with the affected count, cascades on confirm', async ({ page }) => {
  await createExercise(page, 'Press banca', 'pecho');
  await createExercise(page, 'Aperturas', 'pecho');
  await openMusclesView(page);

  await page.locator('.muscle-row', { hasText: 'pecho' }).locator('[data-action="delete"]').click();
  await expect(page.locator('.dialog-message')).toContainText('2 ejercicios');
  await page.locator('#dialogConfirmBtn').click();

  await expect(page.locator('.muscle-row', { hasText: 'pecho' })).toHaveCount(0);
});

test('cancelling a muscle delete leaves it untouched', async ({ page }) => {
  await createExercise(page, 'Press banca', 'pecho');
  await openMusclesView(page);

  await page.locator('.muscle-row', { hasText: 'pecho' }).locator('[data-action="delete"]').click();
  await page.locator('#dialogCancelBtn').click();

  await expect(page.locator('.muscle-row', { hasText: 'pecho' })).toBeVisible();
});

test('deleting an unused muscle needs no exercise-count warning', async ({ page }) => {
  await createExercise(page, 'Press banca', 'temporal');
  // Editing the exercise's muscles to blank orphans 'temporal' - updateExercise
  // deliberately leaves now-unused muscles rows in place (see exerciseService.js).
  await page.locator('.row', { hasText: 'Press banca' }).click();
  await page.locator('#singleExerciseView .edit-btn .btn').click();
  await page.locator('#exerciseForm input[name="muscles"]').fill('');
  await page.locator('#exerciseForm .submit').getByText('Guardar Cambios').click();
  await page.locator('#goBack2 .btn').click();

  await openMusclesView(page);
  await expect(page.locator('.muscle-row', { hasText: 'temporal' })).toContainText('0 ejercicios');

  await page.locator('.muscle-row', { hasText: 'temporal' }).locator('[data-action="delete"]').click();
  await page.locator('#dialogConfirmBtn').click();
  await expect(page.locator('.muscle-row', { hasText: 'temporal' })).toHaveCount(0);
});
