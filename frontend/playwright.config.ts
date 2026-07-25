import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// E2E data dir is isolated from normal dev data (backend/local-bridge's
// default DATA_DIR) so running this suite never touches real dev/demo data.
const E2E_DATA_DIR = path.resolve(__dirname, '../.e2e-data');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared backend/DB across specs - avoid cross-test races
  workers: 1,
  // The trial/EULA/landing gate sequence in front of every test's login
  // occasionally stalls under this dev-server-backed setup (Vite on-demand
  // compilation, first-paint timing) - one retry absorbs that without
  // masking a real app regression, since a genuine bug fails consistently.
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // rm -rf ensures every run starts from the same fixture state -
      // SEED_E2E=1 adds the worker/store fixtures the specs depend on
      // (see backend/local-bridge/src/seed.ts's seedE2EFixtures).
      command: `rm -rf ${E2E_DATA_DIR} && SEED_E2E=1 npm run seed && npm run dev`,
      cwd: path.resolve(__dirname, '../backend/local-bridge'),
      url: 'http://127.0.0.1:8787/health',
      env: { DATA_DIR: E2E_DATA_DIR, PORT: '8787' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: __dirname,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
