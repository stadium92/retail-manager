import { Page, expect } from '@playwright/test';

export const MASTER = { email: 'master@offline.local', password: 'Password123!' };
export const E2E_PASSWORD = 'Password123!';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  // Cold Vite dev-server compilation on the very first request of a fresh
  // run can be slow enough to blow past a short gate-detection timeout -
  // give the app room to finish its first paint before probing for gates.
  await page.waitForLoadState('networkidle').catch(() => {});

  // Fresh DB has no license activation on file - dismiss the trial gate
  // that otherwise blocks the whole app before the login form ever shows.
  const trialButton = page.getByRole('button', { name: /version d'essai/i });
  if (await trialButton.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await trialButton.click();
  }
  // A EULA dialog follows the trial gate on first launch.
  const eulaCheckbox = page.getByRole('checkbox', { name: /accepte les conditions/i });
  if (await eulaCheckbox.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await eulaCheckbox.click();
    await page.getByRole('button', { name: /confirmer et accéder/i }).click();
  }
  // Marketing landing page ("/") sits in front of the actual auth form.
  const getStartedButton = page.getByRole('button', { name: 'Commencer' });
  if (await getStartedButton.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await getStartedButton.click();
  }
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

export async function loginAsMaster(page: Page) {
  await login(page, MASTER.email, MASTER.password);
  await expect(page).toHaveURL(/\/master\/dashboard/, { timeout: 15_000 });
}

export async function loginAsWorker(page: Page, email: string) {
  await login(page, email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/worker\/dashboard/, { timeout: 15_000 });
}

/** Opens the worker menubar's "Fichiers" group and clicks "Produits/Articles". */
export async function openWorkerProductsModule(page: Page) {
  await page.getByRole('menuitem', { name: 'Fichiers' }).click();
  await page.getByRole('menuitem', { name: 'Produits/Articles' }).click();
}
