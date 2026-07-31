import { test, expect } from '@playwright/test';
import { loginAsWorker } from './helpers';

// Reproduction for the reported crash: searching a product from the Ventes
// grid blows up with
//   Uncaught TypeError: Cannot read properties of undefined (reading 'length')
//
// The seeded fixtures alone do NOT reproduce it - they are too clean. Every
// one of the 312 products on the real client catalogue has NULL sku, NULL
// barcode, NULL description and NULL category, so this first inserts products
// with that exact shape before searching. Runs against the dev server so the
// stack is unminified.
const REAL_SHAPE = [
  'STIHL chaine 070',
  'Chaînes 070 STIHL',
  'Chaine Capot Nigeria',
  'NITRAS/CHAUSSURE DE SECURITE',
];

test('product search from the sales grid does not crash', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}\n${e.stack}`));

  // Insert products shaped like the client's real data (null sku/barcode).
  const login = await request.post('http://127.0.0.1:8787/auth/login', {
    data: { email: 'master@offline.local', password: 'Password123!' },
  });
  const loginBody = await login.json();
  const { access_token, user } = loginBody;
  const storeId = user?.store_id || user?.stores?.[0]?.id;
  console.log('LOGIN status', login.status(), 'storeId', storeId);

  for (const name of REAL_SHAPE) {
    const ins = await request.post('http://127.0.0.1:8787/rest/v1/products', {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        store_id: storeId,
        name,
        sku: null,
        barcode: null,
        description: null,
        category: null,
        unit_price: 15000,
        cost_price: 12000,
        quantity: 1256,
      },
    });
    console.log('INSERT', name, '->', ins.status());
  }

  await loginAsWorker(page, 'worker.gate@e2e.local');
  await page.getByRole('menuitem', { name: 'Ventes' }).click();
  await page.getByRole('menuitem', { name: 'VENTE au détail' }).click();
  await page.waitForTimeout(1000);

  // Path 1: type straight into the inline designation cell, as in the report.
  const cell = page.locator('#designation-input-0');
  console.log('designation cell present:', await cell.count());
  if (await cell.count()) {
    await cell.click();
    await cell.pressSequentially('STIHL cha', { delay: 60 });
    await page.waitForTimeout(2500);
  }

  // Path 2: the explicit Rechercher dialog.
  const btn = page.getByRole('button', { name: 'Rechercher' });
  console.log('Rechercher button present:', await btn.count());
  if (await btn.count()) {
    await btn.click();
    const box = page.getByPlaceholder('Rechercher');
    if (await box.count()) {
      await box.fill('STIHL');
      await page.waitForTimeout(2000);
      // Selecting a result is part of the reported flow.
      const hit = page.getByText('STIHL chaine 070').first();
      console.log('result row present:', await hit.count());
      if (await hit.count()) {
        await hit.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  console.log('=== CAPTURED ERRORS ===');
  console.log(errors.length ? errors.join('\n\n') : 'none');
  expect(errors, errors.join('\n')).toHaveLength(0);
});
