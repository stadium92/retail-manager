import { test } from '@playwright/test';
import { loginAsWorker } from './helpers';

/**
 * Second pass over the six modules the sweep flagged.
 *
 * Every one of them was the FIRST entry of its menu group, which points at the
 * crawler rather than the app: the sweep pressed Escape after enumerating
 * labels, then clicked the trigger again, toggling the already-open menu shut,
 * so the first click landed on nothing. This opens each one from a known-clean
 * state with a generous timeout to find out whether the modules are actually
 * broken or the sweep was.
 */
const FLAGGED: Array<[string, string]> = [
  ['Ventes', 'VENTE au détail'],
  ['Achats', 'Réception/Achats'],
  ['Fichiers', 'Produits/Articles'],
  ['Edition', 'Situation CLIENT'],
  ['Stock', 'Fiche stock produit'],
  ['Programme', 'Préférences'],
];

test('the six flagged modules open cleanly', async ({ page }) => {
  const results: string[] = [];
  let current = '';
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`${current} :: ${e.message}`));

  await loginAsWorker(page, 'worker.gate@e2e.local');

  for (const [group, label] of FLAGGED) {
    current = `${group} > ${label}`;
    errors.length = 0;
    // Always start from a closed-menu state.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    let opened = false;
    try {
      await page.getByRole('menuitem', { name: group, exact: true }).first().click({ timeout: 15000 });
      await page.waitForTimeout(500);
      await page.getByRole('menuitem', { name: label, exact: true }).first().click({ timeout: 15000 });
      await page.waitForTimeout(2000);
      opened = true;
    } catch (e) {
      results.push(`STILL FAILS  ${current}  ${String(e).split('\n')[0].slice(0, 100)}`);
    }

    const overlay = await page.locator('h1', { hasText: 'RUNTIME ERROR' }).count();
    if (opened) {
      results.push(
        `${overlay ? 'RED PAGE   ' : 'opens ok   '}${current}` +
        (errors.length ? `  errors: ${errors.join(' | ').slice(0, 200)}` : '')
      );
    }
    if (overlay) { await page.reload(); await page.waitForTimeout(1500); }
  }

  console.log('\n=== VERIFY RESULT ===');
  results.forEach(r => console.log('  ' + r));
});
