import { defineConfig } from '@playwright/test';

// Both ordinary Web and native dispatch use real decoding and the same public
// synthetic graph. The Host's SDK seam is injected; no live Host is contacted.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'compact-audio.spec.ts',
  outputDir: './.data/compact-audio-results',
  timeout: 35_000,
  expect: { timeout: 12_000 },
  workers: 1,
  reporter: 'list',
  webServer: [
    {
      command: 'node --import tsx src/scripts/compactMediaServer.test.ts ../../web/.data/compact-streaming-fixture.json',
      cwd: '../services/api',
      url: 'http://127.0.0.1:5294/health',
      reuseExistingServer: false
    },
    ...(['web', 'host'] as const).map((mode, index) => ({
      command: `npm run dev -- --host 127.0.0.1 --port ${index ? 5295 : 5293} --strictPort`,
      url: `http://127.0.0.1:${index ? 5295 : 5293}`,
      reuseExistingServer: false,
      env: {
        VITE_DOTIFY_API_URL: 'http://127.0.0.1:5294',
        VITE_DOTIFY_RUNTIME_ADAPTER: 'viem',
        VITE_DOTIFY_HOST_MODE: mode === 'web' ? 'off' : 'required',
        VITE_DOTIFY_MEDIA_EDGE_URL: ''
      }
    }))
  ],
  use: { trace: 'retain-on-failure', launchOptions: { timeout: 20_000 } },
  projects: (['chromium', 'webkit', 'firefox'] as const).flatMap(browserName =>
    (['web', 'host'] as const).map(mode => ({
      name: `${browserName}-${mode}`,
      metadata: { mode },
      use: {
        browserName,
        baseURL: `http://127.0.0.1:${mode === 'host' ? 5295 : 5293}`,
        // Same-runner ICE uses real host candidates without depending on mDNS.
        launchOptions: { timeout: 20_000, ...(browserName === 'chromium' ? { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } : {}) }
      }
    }))
  )
});
