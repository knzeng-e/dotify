import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  // Each audience gets a fresh server through test:nearby. Independent browser
  // scenarios share the bounded loopback network budget.
  testMatch: ['**/nearby.spec.ts'],
  testIgnore: [],
  workers: 1
});
