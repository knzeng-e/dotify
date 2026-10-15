import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  // Each audience gets a fresh server through test:nearby. Independent browser
  // scenarios otherwise share the real six-searches/minute loopback-IP budget.
  testMatch: ['**/nearby.spec.ts'],
  testIgnore: [],
  workers: 1
});
