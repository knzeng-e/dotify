import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Opt-in documentation capture only. Never a deployment profile or pilot proof.
export default defineConfig({
  ...base,
  testMatch: ['**/documentation-capture.spec.ts'],
  testIgnore: [],
  workers: 1,
  timeout: 90_000,
  webServer: [
    {
      command: 'node e2e/fixtures/signaling-server.mjs',
      url: 'http://127.0.0.1:8796/health',
      reuseExistingServer: false,
      env: { SIGNAL_HOST: '127.0.0.1', SIGNAL_PORT: '8796', SIGNAL_ORIGINS: 'http://127.0.0.1:5340' }
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5340',
      url: 'http://127.0.0.1:5340',
      reuseExistingServer: false,
      env: {
        VITE_E2E_ARTIST_PUBLISH: 'true',
        VITE_E2E_ROOM_JOIN: 'true',
        VITE_E2E_CLASSIC_UNLOCK: 'false',
        VITE_DOTIFY_API_URL: '',
        VITE_DOTIFY_HOST_MODE: 'off',
        VITE_SIGNAL_URL: 'http://127.0.0.1:8796',
        VITE_DOTIFY_NEARBY: 'on',
        VITE_DOTIFY_ROOM_GALAXY: 'off'
      }
    }
  ],
  use: { ...base.use, actionTimeout: 10_000, baseURL: 'http://127.0.0.1:5340', viewport: { width: 1440, height: 1000 } }
});
