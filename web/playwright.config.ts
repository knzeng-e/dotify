import { defineConfig, devices } from '@playwright/test';

const SIGNAL_PORT = '8789';
const SIGNAL_URL = `http://127.0.0.1:${SIGNAL_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 6_000
  },
  // Two servers: the real Socket.IO signaling server (room-join coverage needs a
  // live signaling backend) and the Vite dev server. The signaling server is
  // harmless to the classic-unlock / artist-publish suites, which never open a
  // socket; pointing VITE_SIGNAL_URL at it simply lets the room-join suite run.
  webServer: [
    {
      command: 'node server/signaling.mjs',
      url: `${SIGNAL_URL}/health`,
      reuseExistingServer: false,
      env: {
        SIGNAL_PORT,
        SIGNAL_HOST: '127.0.0.1'
      }
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5274',
      url: 'http://127.0.0.1:5274',
      reuseExistingServer: false,
      env: {
        // VITE_E2E_CLASSIC_UNLOCK, VITE_E2E_ARTIST_PUBLISH and VITE_E2E_ROOM_JOIN
        // are all always active for every Playwright run - a single dev server is
        // shared across all specs, so we cannot toggle these per test. The mocks
        // coexist: each scenario keys off its own URL signal (the artist flow's
        // `?e2eArtist=` param, the room flow's `?e2eRoom=` param), and the
        // artist-publish mode takes precedence over the classic-unlock
        // auto-connect when its param is present (see useWallet.ts).
        //
        // Because the mocks write to window/localStorage, test isolation relies on
        // Playwright's default per-test browser context: each test gets a fresh
        // context with empty storage and cookies, so mock state cannot leak between
        // tests. Do not disable that isolation (e.g. by sharing a context or page
        // across tests) without adding explicit per-test state resets.
        VITE_E2E_CLASSIC_UNLOCK: 'true',
        VITE_E2E_ARTIST_PUBLISH: 'true',
        VITE_E2E_ROOM_JOIN: 'true',
        VITE_SIGNAL_URL: SIGNAL_URL
      }
    }
  ],
  use: {
    baseURL: 'http://127.0.0.1:5274',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Room-join coverage drives real WebRTC between two contexts with a
        // synthetic audio stream; allow autoplay and fake media so the host can
        // start streaming without a user-gesture or a real capture device.
        launchOptions: {
          args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        }
      }
    }
  ]
});
