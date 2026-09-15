import { defineConfig, devices } from '@playwright/test';
import shared from './playwright.config';

// Host profile behavior through the real SDK adapter and React providers.
// The fake SDK host exists only in an e2e HTML entry, never a production import.
const servers = Array.isArray(shared.webServer) ? shared.webServer : [];
export default defineConfig({
  ...shared,
  testMatch: '**/product-identity.spec.ts',
  testIgnore: [],
  webServer: servers.map(server => ({
    ...server,
    env: { ...server.env, VITE_E2E_CLASSIC_UNLOCK: 'false', VITE_E2E_ARTIST_PUBLISH: 'false', VITE_DOTIFY_HOST_MODE: 'auto' }
  })),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
