import { defineConfig, devices } from '@playwright/test';
import shared from './playwright.config';

// A layout smoke suite, not a substitute for a physical iPhone keyboard check.
export default defineConfig({
  ...shared,
  testMatch: [
    '**/catalog-browser.spec.ts',
    '**/catalog-journey.spec.ts',
    '**/room-arrival.spec.ts',
    '**/room-workspace.spec.ts',
    '**/player-presence.spec.ts',
    '**/design-surfaces.spec.ts',
    '**/clear-interface.spec.ts'
  ],
  grep: /clear interface|room presence stays quiet|catalog row|catalog journey|room arrival|composer remains above|tapped tab|focus waits|keyboard restores|keyboard rotation|player essentials|design review surfaces/,
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
});
