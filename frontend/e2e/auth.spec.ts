import { test, expect } from '@playwright/test';
import { loginAsMaster, loginAsWorker, login, MASTER } from './helpers';

test('master can log in', async ({ page }) => {
  await loginAsMaster(page);
});

test('seeded worker can log in', async ({ page }) => {
  await loginAsWorker(page, 'worker.gate@e2e.local');
});

test('wrong password is rejected and stays on the login page', async ({ page }) => {
  await login(page, MASTER.email, 'not-the-real-password');
  await expect(page).not.toHaveURL(/\/master\/dashboard/);
  await expect(page.locator('#login-email')).toBeVisible();
});

test('session survives a reload', async ({ page }) => {
  await loginAsMaster(page);
  await page.reload();
  await expect(page).toHaveURL(/\/master\/dashboard/, { timeout: 15_000 });
});
