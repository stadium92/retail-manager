import { test, expect } from '@playwright/test';
import { loginAsWorker } from './helpers';

// Regression coverage for the "can't type successive digits" bug (state
// was storing the Number()-coerced value back into the controlled input
// on every keystroke instead of the raw string).
test('quantity and price fields accept successive digits while typing', async ({ page }) => {
  await loginAsWorker(page, 'worker.gate@e2e.local');

  await page.getByRole('menuitem', { name: 'Ventes' }).click();
  await page.getByRole('menuitem', { name: 'VENTE au détail' }).click();

  await page.getByRole('button', { name: 'Rechercher' }).click();
  await page.getByPlaceholder('Rechercher').fill('Riz');
  await page.getByText('Riz local 5kg').click();

  const qtyInput = page.locator('#quantity-input-0');
  await qtyInput.click();
  await qtyInput.fill('25');
  await expect(qtyInput).toHaveValue('25');

  const priceInput = page.locator('#price-input-0');
  await priceInput.click();
  await priceInput.fill('4750');
  await expect(priceInput).toHaveValue('4750');

  // Blur with an empty quantity coerces to 1, not left blank/NaN.
  await qtyInput.fill('');
  await priceInput.click(); // moves focus off qtyInput, triggering its blur
  await expect(qtyInput).toHaveValue('1');
});
