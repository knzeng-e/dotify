import { defineConfig, devices } from '@playwright/test';
import shared from './playwright.config';

export default defineConfig({
  ...shared,
  testMatch: '**/mobile-host-playback.spec.ts',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } }
  ]
});
