import { test, expect } from '@playwright/test';
import { loginAsWorker, loginAsMaster } from './helpers';

/**
 * Sweeps every screen looking for the full-screen red "RUNTIME ERROR" overlay.
 *
 * That overlay is a GLOBAL window.onerror handler in index.html, so it fires
 * for an uncaught throw anywhere in the app and replaces the whole UI - a till
 * that hits one is unusable until restart. This walks the worker menubar and
 * the master routes, recording for each screen whether the overlay appeared
 * and what was thrown.
 *
 * It deliberately does NOT stop at the first failure: the point is an
 * inventory of every broken screen, not the first one.
 */

type Finding = { screen: string; error: string; overlay: boolean };

const overlayText = async (page: any): Promise<string | null> => {
  const el = page.locator('h1', { hasText: 'RUNTIME ERROR' });
  if (!(await el.count())) return null;
  const body = await page.locator('body').innerText().catch(() => '');
  return body.slice(0, 400);
};

test('worker modules: sweep for red pages', async ({ page }) => {
  const findings: Finding[] = [];
  let current = 'startup';
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`${current} :: ${e.message}`));

  await loginAsWorker(page, 'worker.gate@e2e.local');

  const triggers = page.locator('[id^="worker-menubar-trigger-"]');
  const triggerCount = await triggers.count();

  // Radix menubar TRIGGERS also carry role="menuitem", so an unfiltered
  // getByRole('menuitem') returns the 7 group names on top of the real
  // entries - the first run therefore visited each group name 7 times and
  // spent its whole budget re-opening menus instead of reaching modules.
  const groupNames: string[] = [];
  for (let i = 0; i < triggerCount; i++) {
    groupNames.push((await triggers.nth(i).innerText().catch(() => '')).trim());
  }
  console.log(`menubar groups: ${triggerCount} -> ${groupNames.join(', ')}`);
  const visited = new Set<string>();

  for (let g = 0; g < triggerCount; g++) {
    await page.keyboard.press('Escape').catch(() => {});
    // NOTE: every menubar trigger renders with the SAME id
    // (worker-menubar-trigger-0) - duplicate DOM ids, so an id selector
    // matches all 7. Index positionally instead.
    const trigger = triggers.nth(g);
    if (!(await trigger.count())) continue;
    const groupName = (await trigger.innerText().catch(() => `group${g}`)).trim();

    await trigger.click();
    await page.waitForTimeout(300);
    const items = page.getByRole('menuitem');
    const labels: string[] = [];
    for (let i = 0; i < (await items.count()); i++) {
      const t = (await items.nth(i).innerText().catch(() => '')).trim();
      if (t && !groupNames.includes(t) && !visited.has(t)) {
        labels.push(t);
        visited.add(t);
      }
    }
    await page.keyboard.press('Escape').catch(() => {});

    for (const label of labels) {
      current = `${groupName} > ${label}`;
      errors.length = 0;
      try {
        // Short explicit timeouts. With Playwright's 30s default, ONE screen
        // that leaves a modal open (swallowing the next click) burns half the
        // run's budget and the sweep dies before reaching later groups - which
        // is exactly what happened twice. A screen that will not open in 5s is
        // itself a finding worth recording, not a reason to stall.
        await triggers.nth(g).click({ timeout: 5000 });
        await page.waitForTimeout(150);
        const item = page.getByRole('menuitem', { name: label, exact: true }).first();
        await item.click({ timeout: 5000 });
        await page.waitForTimeout(600);
      } catch (e) {
        errors.push(`could not open (${String(e).split('\n')[0].slice(0, 90)})`);
        // Clear whatever is blocking - modal, open menu - so the sweep can go on.
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape').catch(() => {});
      }

      const overlay = await overlayText(page);
      if (overlay || errors.length) {
        findings.push({ screen: current, error: errors.join(' | ') || '(overlay only)', overlay: !!overlay });
        console.log(`RED  ${current}\n     ${(errors[0] || overlay || '').slice(0, 200)}`);
        if (overlay) {
          // The overlay covers everything; reload to keep sweeping.
          await page.reload();
          await page.waitForTimeout(1500);
        }
      } else {
        console.log(`ok   ${current}`);
      }
    }
  }

  console.log('\n=== WORKER SUMMARY ===');
  console.log(findings.length ? JSON.stringify(findings, null, 2) : 'no red pages');
});

test('master routes: sweep for red pages', async ({ page }) => {
  const findings: Finding[] = [];
  let current = 'startup';
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`${current} :: ${e.message}`));

  await loginAsMaster(page);

  const routes = [
    'dashboard', 'analytics', 'sales', 'inventory', 'purchases', 'files',
    'team', 'deliverers', 'deliveries', 'stores', 'invitations',
    'audit-logs', 'cloud-sync', 'help',
  ];

  for (const r of routes) {
    current = `/master/${r}`;
    errors.length = 0;
    await page.goto(`/#/master/${r}`).catch(() => {});
    await page.waitForTimeout(1500);

    const overlay = await overlayText(page);
    if (overlay || errors.length) {
      findings.push({ screen: current, error: errors.join(' | ') || '(overlay only)', overlay: !!overlay });
      console.log(`RED  ${current}\n     ${(errors[0] || overlay || '').slice(0, 200)}`);
      if (overlay) { await page.reload(); await page.waitForTimeout(1200); }
    } else {
      console.log(`ok   ${current}`);
    }
  }

  console.log('\n=== MASTER SUMMARY ===');
  console.log(findings.length ? JSON.stringify(findings, null, 2) : 'no red pages');
});
