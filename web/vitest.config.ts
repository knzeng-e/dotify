import { defineConfig } from 'vitest/config';

// Unit tests cover extracted pure domain logic (access policy, room state).
// They take no DOM, so the lightweight node environment is enough; helpers that
// read window.location accept an explicit URL argument in tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
