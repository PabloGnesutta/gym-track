import { test, expect } from '@playwright/test';
import { ensureAuth } from './helpers.js';


test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ensureAuth(page);
  await expect(page.locator('#exerciseListView')).toBeVisible();
});

test('a fresh account shows the empty state in every analytics section', async ({ page }) => {
  await page.locator('[data-tab="analytics"]').click();
  await expect(page.locator('#analyticsView')).toBeVisible();

  await expect(page.locator('.muscle-balance-list .analytics-empty')).toBeVisible();
  await expect(page.locator('.pr-list .analytics-empty')).toBeVisible();
  await expect(page.locator('.frequency-chart .frequency-col')).toHaveCount(8);
});

test('logging sets today shows up in muscle balance, this week\'s frequency bar, and personal records', async ({ page }) => {
  await page.locator('#newExerciseBtn').click();
  await page.locator('#exerciseForm input[name="exerciseName"]').fill('Press banca');
  await page.locator('#exerciseForm input[name="muscles"]').fill('pecho,triceps');
  await page.locator('#exerciseForm .submit').getByText('Crear Ejercicio').click();

  await page.locator('.row', { hasText: 'Press banca' }).click();
  await page.locator('#createSetForm input[name="weight"]').fill('60');
  await page.locator('#createSetForm input[name="reps"]').fill('8');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();
  await page.waitForTimeout(300);
  await page.locator('#createSetForm input[name="weight"]').fill('60');
  await page.locator('#createSetForm input[name="reps"]').fill('6');
  await page.locator('#createSetForm .submit').getByText('Agregar Set').click();
  await page.waitForTimeout(300);

  await page.locator('[data-tab="analytics"]').click();
  await expect(page.locator('#analyticsView')).toBeVisible();

  // Muscle balance: two sets logged, tagged on both muscles.
  const pechoRow = page.locator('.muscle-balance-row', { hasText: 'pecho' });
  await expect(pechoRow).toBeVisible();
  await expect(pechoRow.locator('.muscle-count')).toHaveText('2');
  const tricepsRow = page.locator('.muscle-balance-row', { hasText: 'triceps' });
  await expect(tricepsRow.locator('.muscle-count')).toHaveText('2');

  // Frequency: the last (current week) bar should show 1 trained day.
  const lastBar = page.locator('.frequency-col').last();
  await expect(lastBar.locator('.frequency-count')).toHaveText('1');
  await expect(lastBar.locator('.frequency-bar')).toHaveClass(/current/);

  // Personal records: heaviest weight logged was 60kg.
  const prRow = page.locator('.pr-row', { hasText: 'Press banca' });
  await expect(prRow).toBeVisible();
  await expect(prRow.locator('.pr-stats')).toContainText('60kg máx');
});
