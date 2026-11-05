import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: '**/listening-controls.spec.ts',
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
