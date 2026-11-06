import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['**/listening-controls.spec.ts', '**/room-output-autoplay.spec.ts'],
  use: { ...base.use, trace: 'retain-on-failure' },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
