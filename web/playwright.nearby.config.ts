import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['**/nearby.spec.ts', '**/nearby-product.spec.ts'],
  testIgnore: [],
  workers: 1
});
