import { defineConfig } from '@playwright/test';
import identity from './playwright.product-identity.config';

const servers = Array.isArray(identity.webServer) ? identity.webServer : [];
export default defineConfig({
  ...identity,
  testMatch: '**/session-logout.spec.ts',
  webServer: servers.map(server => ({ ...server, env: { ...server.env, VITE_DOTIFY_API_URL: 'https://logout-api.test' } }))
});
