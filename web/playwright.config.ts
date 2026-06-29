import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 6_000
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5274',
    url: 'http://127.0.0.1:5274',
    reuseExistingServer: false,
    env: {
      // VITE_E2E_CLASSIC_UNLOCK and VITE_E2E_ARTIST_PUBLISH are both always active for
      // every Playwright run — a single dev server is shared across all specs, so we
      // cannot toggle these per test. The mocks therefore coexist: each scenario keys
      // off its own URL signal (e.g. the artist flow's `?e2eArtist=` param), and the
      // artist-publish mode takes precedence over the classic-unlock auto-connect when
      // its param is present (see useWallet.ts).
      //
      // Because both modes write to window/localStorage, test isolation relies entirely
      // on Playwright's default per-test browser context: each test gets a fresh context
      // with empty storage and cookies, so mock state cannot leak between tests. Do not
      // disable that isolation (e.g. by sharing a context or page across tests) without
      // adding explicit per-test state resets.
      VITE_E2E_CLASSIC_UNLOCK: 'true',
      VITE_E2E_ARTIST_PUBLISH: 'true',
      VITE_SIGNAL_URL: 'http://127.0.0.1:65535'
    }
  },
  use: {
    baseURL: 'http://127.0.0.1:5274',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
