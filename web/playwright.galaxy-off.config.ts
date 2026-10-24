import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['**/room-galaxy-off.spec.ts'],
  testIgnore: [],
  workers: 1,
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(server => ({
    ...server,
    env: { ...server.env, VITE_DOTIFY_ROOM_GALAXY: 'off' }
  }))
});
