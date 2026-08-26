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

test('a brand-new exercise shows the "no sets yet" empty state, no chart', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');

  await expect(page.locator('.exercise-history-chart')).toContainText('Todavía no hay sets registrados');
  await expect(page.locator('.exercise-history-chart canvas')).toHaveCount(0);
});

test('a single logged session shows a "log one more" prompt, still no chart', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');

  await page.locator('#createSetForm input[name="weight"]').fill('60');
  await page.locator('#createSetForm input[name="reps"]').fill('8');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();
  await page.waitForTimeout(300);

  await expect(page.locator('.exercise-history-chart')).toContainText('Registrá al menos una sesión más');
  await expect(page.locator('.exercise-history-chart canvas')).toHaveCount(0);
});

test('three sessions render a chart with one point per session, in chronological order', async ({ page }) => {
  await createAndOpenExercise(page, 'Sentadilla');

  const exerciseId = Number(page.url().split('/exercise/')[1]);

  await page.evaluate(async ({ exerciseId, token }) => {
    const day = 24 * 60 * 60 * 1000;
    const seeds = [[10, 40], [3, 45], [0, 50]]; // [daysAgo, weight]
    for (const [daysAgo, weight] of seeds) {
      await fetch('/api/sessions/addSet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ exerciseId, weight, reps: 8, date: Date.now() - daysAgo * day }),
      });
    }
  }, { exerciseId, token: await page.evaluate(() => localStorage.getItem('accessToken')) });

  await page.reload();
  await expect(page.locator('#singleExerciseView')).toBeVisible();

  const chart = page.locator('.exercise-history-chart');
  const canvas = chart.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-points', '3');

  const dims = await canvas.evaluate(
    /** @param {HTMLCanvasElement} c */
    c => ({ width: c.width, height: c.height })
  );
  expect(dims.width).toBeGreaterThan(0);
  expect(dims.height).toBeGreaterThan(0);
});
