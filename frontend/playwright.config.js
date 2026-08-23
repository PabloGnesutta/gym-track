import { defineConfig, devices } from '@playwright/test';


export default defineConfig({
  testDir: './e2e',
  // Parallel workers each launch their own Chromium instance, which is
  // unnecessary for a suite this small and mirrors the sibling
  // fridge-track/car-track configs' own single-worker choice.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3033',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node ../backend/src/index.gym-track.js',
    url: 'http://localhost:3033',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
