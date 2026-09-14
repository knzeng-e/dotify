import { defineConfig, devices } from '@playwright/test';
import shared from './playwright.config';

// A layout smoke suite, not a substitute for a physical iPhone keyboard check.
export default defineConfig({
  ...shared,
  testMatch: ['**/catalog-browser.spec.ts', '**/room-workspace.spec.ts'],
  grep: /catalog row|composer remains above|tapped tab/,
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
