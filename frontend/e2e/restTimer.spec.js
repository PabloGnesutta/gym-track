import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

async function createAndOpenExercise(page, name) {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill(name);
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();
  await page.locator('.row', { hasText: name }).click();
  await expect(page.locator('#singleExerciseView')).toBeVisible();
}

async function logSet(page, weight, reps) {
  await page.locator('#createSetForm input[name="weight"]').fill(String(weight));
  await page.locator('#createSetForm input[name="reps"]').fill(String(reps));
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();
  await page.waitForTimeout(200);
}

function parseRestTime(text) {
  const [min, sec] = text.split(':').map(Number);
  return min * 60 + sec;
}

test('logging a set auto-starts the rest timer', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');
  await logSet(page, 60, 8);

  await expect(page.locator('.rest-timer')).toBeVisible();
  await expect(page.locator('.rest-timer-time')).toHaveText(/^\d:\d{2}$/);
});

test('+15s increases the remaining time, "Saltar" hides the timer', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');
  await logSet(page, 60, 8);

  const before = parseRestTime(await page.locator('.rest-timer-time').innerText());
  await page.locator('.rest-timer-btn', { hasText: '+15s' }).click();
  const after = parseRestTime(await page.locator('.rest-timer-time').innerText());
  expect(after).toBeGreaterThanOrEqual(before + 13); // loose bound, tolerates real elapsed time

  await page.locator('.rest-timer-btn', { hasText: 'Saltar' }).click();
  await expect(page.locator('.rest-timer')).toBeHidden();
});

test('opening a different exercise hides a running timer', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');
  await logSet(page, 60, 8);
  await expect(page.locator('.rest-timer')).toBeVisible();

  await page.locator('[data-click-action="openExerciseList"]').click();
  await createAndOpenExercise(page, 'Press banca');
  await expect(page.locator('.rest-timer')).toBeHidden();
});

test('the header-menu toggle disables and re-enables auto-start', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');

  await page.locator('#headerMenuBtn .btn').click();
  await page.locator('#restTimerToggleBtn').click();

  await logSet(page, 60, 8);
  await expect(page.locator('.rest-timer')).toBeHidden();

  await page.locator('#headerMenuBtn .btn').click();
  await page.locator('#restTimerToggleBtn').click();

  await logSet(page, 65, 6);
  await expect(page.locator('.rest-timer')).toBeVisible();
});
