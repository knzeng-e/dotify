import { defineConfig, devices } from '@playwright/test';
import shared from './playwright.config';

export default defineConfig({
  ...shared,
  testMatch: ['**/classic-unlock.spec.ts', '**/artist-gift.spec.ts'],
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
