import { test, expect } from '@playwright/test';
import { loginAsWorker } from './helpers';

/**
 * Guards the product-search list against unreadable text.
 *
 * The selected row and the header both paint on `bg-primary`. They used to
 * hardcode `text-white`, which is fine in light mode (primary is a DARK gold,
 * 5.49:1) and unreadable in dark mode, where the palette flips primary to a
 * LIGHT gold and white drops to 1.86:1. The palette already defines the right
 * ink per mode; the fix is to use the token (`text-primary-foreground`)
 * instead of a hardcoded colour, so this asserts the RENDERED contrast rather
 * than the class name.
 */
const relLum = ([r, g, b]: number[]) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const parse = (c: string) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const contrast = (a: string, b: string) => {
  const [la, lb] = [relLum(parse(a)), relLum(parse(b))];
  const [hi, lo] = [Math.max(la, lb), Math.min(la, lb)];
  return (hi + 0.05) / (lo + 0.05);
};

test('product search list: selected row and header are readable', async ({ page }) => {
  await loginAsWorker(page, 'worker.gate@e2e.local');
  await page.getByRole('menuitem', { name: 'Ventes', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'VENTE au détail', exact: true }).first().click();
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'Rechercher' }).click();
  const box = page.getByPlaceholder('Rechercher');
  await box.fill('a');
  await page.waitForTimeout(2500);

  // The selected row is the one painted with the primary background.
  const target = page.locator('.bg-primary').filter({ hasText: /./ }).first();
  await expect(target).toBeVisible({ timeout: 10000 });

  const { fg, bg } = await target.evaluate(el => {
    const s = getComputedStyle(el as HTMLElement);
    return { fg: s.color, bg: s.backgroundColor };
  });

  const ratio = contrast(fg, bg);
  console.log(`  text ${fg} on ${bg} -> ${ratio.toFixed(2)}:1`);
  // WCAG AA for normal text. The old hardcoded white scored 1.86:1 here.
  expect(ratio, `contrast ${ratio.toFixed(2)}:1 is unreadable`).toBeGreaterThan(4.5);
});
