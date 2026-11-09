import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  // Real media/artwork work is CPU-heavy in headless WebKit. Keep renderer
  // startup from competing with another page inside the 30-second test budget.
  workers: 1,
  testMatch: ['**/listening-controls.spec.ts', '**/room-output-autoplay.spec.ts'],
  use: { ...base.use, trace: 'retain-on-failure' },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
