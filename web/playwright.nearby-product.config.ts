import { defineConfig } from '@playwright/test';
import nearby from './playwright.nearby.config';

export default defineConfig({
  ...nearby,
  testMatch: ['**/nearby-product.spec.ts']
});
