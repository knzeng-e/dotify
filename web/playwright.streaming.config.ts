import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'streaming-format.spec.ts',
  outputDir: './.data/streaming-results',
  timeout: 30_000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '.data/streaming-report.json' }]],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5291 --strictPort',
    url: 'http://127.0.0.1:5291',
    reuseExistingServer: false,
    env: { VITE_DOTIFY_API_URL: 'http://127.0.0.1:5291', VITE_DOTIFY_RUNTIME_ADAPTER: 'viem', VITE_DOTIFY_MEDIA_EDGE_URL: 'https://media.edge.test' }
  },
  use: { baseURL: 'http://127.0.0.1:5291', trace: 'retain-on-failure', launchOptions: { timeout: 20_000 } },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({
    name: browserName,
    use: { browserName: browserName as 'chromium' | 'webkit' | 'firefox' }
  }))
});
