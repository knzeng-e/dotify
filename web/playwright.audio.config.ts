import { defineConfig } from '@playwright/test';

// Real media/crypto pipeline with local synthetic audio; no wallet or live API.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'audio-continuity.spec.ts',
  outputDir: './.data/audio-continuity-results',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 2,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5286 --strictPort',
    url: 'http://127.0.0.1:5286',
    reuseExistingServer: false,
    env: { VITE_DOTIFY_API_URL: 'http://api.audio.test', VITE_DOTIFY_RUNTIME_ADAPTER: 'viem', VITE_PINATA_GATEWAY: 'https://gateway.pinata.cloud' }
  },
  use: { baseURL: 'http://127.0.0.1:5286', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
