import { test, expect } from '@playwright/test';
import { loginAsMaster } from './helpers';

test.describe.serial('team management (master dashboard)', () => {
  // These tests mutate shared DB state permanently (promote/delete/move a
  // fixed seeded worker) and aren't idempotent - a retry after a passing
  // server-side mutation but a flaky UI-assertion timeout re-runs against
  // already-changed state and fails differently. Reliable in one pass
  // standalone; opt out of the global retry policy rather than risk that.
  test.describe.configure({ retries: 0 });

  test.beforeEach(async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/#/master/team');
  });

  test('promote a worker to master', async ({ page }) => {
    const row = page.getByRole('row', { name: /worker\.promote@e2e\.local/ });
    await row.getByTitle('Promouvoir en Master').click();
    await page.getByRole('button', { name: 'Promouvoir' }).click();
    await expect(row.getByText('master', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('reassign a worker to a different store', async ({ page }) => {
    const row = page.getByRole('row', { name: /worker\.store@e2e\.local/ });
    await expect(row.getByText('Demo Store')).toBeVisible();

    await row.getByTitle('Changer de magasin').click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Second Store E2E' }).click();
    await page.getByRole('button', { name: 'Confirmer' }).click();

    await expect(row.getByText('Second Store E2E')).toBeVisible({ timeout: 10_000 });
  });

  test('delete a worker', async ({ page }) => {
    const row = page.getByRole('row', { name: /worker\.delete@e2e\.local/ });
    await row.getByRole('button').last().click(); // trash icon is the last action button
    await page.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('row', { name: /worker\.delete@e2e\.local/ })).toHaveCount(0, { timeout: 10_000 });
  });

  test('creating a worker without a configured Supabase key fails gracefully', async ({ page }) => {
    // This test env deliberately has no SUPABASE_SERVICE_KEY set (see
    // playwright.config.ts) - verifies the ConfigMissing error path added
    // this session surfaces as a toast instead of hanging/crashing.
    await page.getByRole('button', { name: /ajouter un (employé|personnel)/i }).click();
    await page.getByLabel(/nom complet/i).fill('Nouveau Test');
    await page.getByLabel('Email').fill(`new-worker-${Date.now()}@e2e.local`);
    await page.getByLabel(/mot de passe/i).fill('Password123!');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Demo Store' }).click();
    await page.getByRole('button', { name: /créer/i }).click();
    await expect(page.getByText(/Supabase/i)).toBeVisible({ timeout: 10_000 });
  });
});
