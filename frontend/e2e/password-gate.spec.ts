import { test, expect } from '@playwright/test';
import { loginAsWorker, openWorkerProductsModule, MASTER } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAsWorker(page, 'worker.gate@e2e.local');
  await openWorkerProductsModule(page);
});

test('gate shows and the product catalog is not mounted behind it', async ({ page }) => {
  await expect(page.getByText('Accès Restreint')).toBeVisible();
  // Regression check for the "freezes when opening product file" fix -
  // children must not be in the DOM at all while locked, not just hidden.
  await expect(page.getByText('Riz local 5kg')).toHaveCount(0);
});

test('wrong master password stays locked', async ({ page }) => {
  await page.getByPlaceholder('Mot de passe Master...').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Mot de passe incorrect').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Accès Restreint')).toBeVisible();
});

test('correct master password unlocks the module', async ({ page }) => {
  await page.getByPlaceholder('Mot de passe Master...').fill(MASTER.password);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Accès Restreint')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('Riz local 5kg')).toBeVisible();
});
