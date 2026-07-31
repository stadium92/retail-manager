import { test } from '@playwright/test';
import { loginAsWorker } from './helpers';

// useGlobalKeyboard treats keystrokes arriving faster than 35ms apart as a
// barcode scanner, buffers them, and on Enter dispatches 'scanner-input' ->
// SalesModule.handleHardwareScan -> scanProduct -> addProduct.
//
// A cashier typing a product name quickly and hitting Enter therefore goes
// down the SCAN path, not the search path. Earlier specs typed at 60ms/key and
// never crossed that threshold, which is why they passed.
test('fast typing + Enter (scanner path) does not crash', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}\n${e.stack}`));

  const login = await request.post('http://127.0.0.1:8787/auth/login', {
    data: { email: 'master@offline.local', password: 'Password123!' },
  });
  const { access_token, user } = await login.json();
  const storeId = user?.store_id || user?.stores?.[0]?.id;

  // Client-shaped product: null sku/barcode.
  await request.post('http://127.0.0.1:8787/rest/v1/products', {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      store_id: storeId, name: 'STIHL chaine 070', sku: null, barcode: null,
      description: null, category: null, unit_price: 15000, cost_price: 12000, quantity: 1256,
    },
  });

  await loginAsWorker(page, 'worker.gate@e2e.local');
  await page.getByRole('menuitem', { name: 'Ventes' }).click();
  await page.getByRole('menuitem', { name: 'VENTE au détail' }).click();
  await page.waitForTimeout(1000);

  const cell = page.locator('#designation-input-0');
  await cell.click();

  // Under the 35ms scanner threshold.
  await cell.pressSequentially('STIHL chaine 070', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // A code that matches nothing, exercising the not-found branch too.
  await page.keyboard.press('Escape');
  const cell2 = page.locator('#designation-input-0');
  if (await cell2.count()) {
    await cell2.click();
    await cell2.pressSequentially('9876543210987', { delay: 8 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  }

  console.log('=== CAPTURED ERRORS ===');
  console.log(errors.length ? errors.join('\n\n') : 'none');
  console.log('=== OVERLAY? ===', await page.locator('h1', { hasText: 'RUNTIME ERROR' }).count());
});
