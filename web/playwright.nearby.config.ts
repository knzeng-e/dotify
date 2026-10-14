import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['**/nearby.spec.ts', '**/nearby-product.spec.ts'],
  testIgnore: [],
  workers: 1,
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(server => ({
    ...server,
    env: { ...server.env, SIGNAL_NEARBY: 'on', VITE_DOTIFY_NEARBY: 'on', VITE_DOTIFY_PRODUCT_NEARBY_LOCATION: 'on' }
  }))
});
