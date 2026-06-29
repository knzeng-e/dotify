import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 6_000
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5274',
    url: 'http://127.0.0.1:5274',
    reuseExistingServer: false,
    env: {
      VITE_E2E_CLASSIC_UNLOCK: 'true',
      VITE_E2E_ARTIST_PUBLISH: 'true',
      VITE_SIGNAL_URL: 'http://127.0.0.1:65535'
    }
  },
  use: {
    baseURL: 'http://127.0.0.1:5274',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
