import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/host-qualification.spec.ts',
  timeout: 30_000,
  webServer: {
    command: 'npm run dev:qualification',
    url: 'http://127.0.0.1:5278',
    reuseExistingServer: false,
    env: { DOTIFY_E2E_LOCAL_FONTS: 'true', VITE_E2E_CLASSIC_UNLOCK: 'false', VITE_E2E_ARTIST_PUBLISH: 'false', VITE_E2E_ROOM_JOIN: 'false' }
  },
  use: { baseURL: 'http://127.0.0.1:5278', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
