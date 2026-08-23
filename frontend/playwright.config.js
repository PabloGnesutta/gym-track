import { defineConfig, devices } from '@playwright/test';
import { TEST_PORT } from './e2e/testPort.js';


export default defineConfig({
  testDir: './e2e',
  // Parallel workers each launch their own Chromium instance, which is
  // unnecessary for a suite this small and mirrors the sibling
  // fridge-track/car-track configs' own single-worker choice.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node ../backend/src/index.gym-track.js',
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    // Isolates the e2e backend from a manually-run dev server: its own port
    // (so Playwright never mistakes/reuses a dev server for its test
    // server) and its own sqlite file (so accounts/data created by e2e runs
    // can never touch real local dev data). See e2e/testPort.js.
    env: {
      PORT: TEST_PORT,
      DB_NAME: 'gymtrack.test.db',
    },
  },
});
