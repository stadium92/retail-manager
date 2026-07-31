import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_DATA_DIR = path.resolve(__dirname, '../.e2e-prod-data');

/**
 * Same harness as playwright.config.ts but serves the PRODUCTION bundle via
 * `vite preview` instead of the dev server.
 *
 * The reported "Cannot read properties of undefined (reading 'length')" crash
 * comes from a packaged Tauri build, and did not reproduce against the dev
 * server. A dev-only pass is not evidence the shipped app is fine, so the
 * money-path specs need to be runnable against the artefact the client
 * actually installs.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `rm -rf ${E2E_DATA_DIR} && SEED_E2E=1 npm run seed && npm run dev`,
      cwd: path.resolve(__dirname, '../backend/local-bridge'),
      url: 'http://127.0.0.1:8787/health',
      env: { DATA_DIR: E2E_DATA_DIR, PORT: '8787' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      cwd: __dirname,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
