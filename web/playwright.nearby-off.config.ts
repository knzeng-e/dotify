import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Verify operational rollback independently from the default Web/Product build.
export default defineConfig({
  ...base,
  testMatch: ['**/nearby-off.spec.ts'],
  testIgnore: [],
  workers: 1,
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(server => ({
    ...server,
    env: { ...server.env, SIGNAL_NEARBY: 'off', VITE_DOTIFY_NEARBY: 'off' }
  }))
});
