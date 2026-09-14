// Local-only rollback rehearsal. Synthetic catalog/audio; no real location,
// wallet, external signaling service, or production deployment is involved.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import { startSignalingServer } from '../server/signaling.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const signal = startSignalingServer({ port: 0, host: '127.0.0.1', logger: () => {} });
let vite;
let browser;
try {
  const signalPort = await signal.listen();
  vite = await createViteServer({
    root,
    server: { host: '127.0.0.1', port: 0, open: false },
    define: {
      'import.meta.env.VITE_E2E_ROOM_JOIN': JSON.stringify('true'),
      'import.meta.env.VITE_E2E_CLASSIC_UNLOCK': JSON.stringify('true'),
      'import.meta.env.VITE_SIGNAL_URL': JSON.stringify(`http://127.0.0.1:${signalPort}`),
      'import.meta.env.VITE_DOTIFY_HOST_LINEUP': JSON.stringify('off'),
      'import.meta.env.VITE_DOTIFY_ROOM_GALAXY': JSON.stringify('off'),
      'import.meta.env.VITE_DOTIFY_NEARBY_PREVIEW': JSON.stringify('off')
    }
  });
  await vite.listen();
  const address = vite.httpServer.address();
  assert.equal(typeof address, 'object');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const nearbyFrames = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:')) nearbyFrames.push(String(frame.payload));
    })
  );
  await page.addInitScript(() => {
    // eslint-disable-next-line no-undef -- evaluated inside Chromium, not Node
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      get() {
        throw new Error('Unexpected geolocation access');
      }
    });
  });
  await page.goto(`http://127.0.0.1:${address.port}/?e2eRoom=public`);
  await page.getByTestId('track-card').first().waitFor();
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: 'Room discovery view' }).count(), 0);
  assert.equal(await page.locator('.nearby-preview').count(), 0);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await page.getByTestId('room-code').waitFor();
  await page.getByRole('tab', { name: /Requests/ }).click();
  assert.equal(await page.locator('.host-lineup').count(), 0);
  await page.getByRole('tab', { name: /People/ }).click();
  assert.equal(await page.locator('.nearby-preview').count(), 0);
  assert.equal(nearbyFrames.length, 0);
  console.log('PASS: flags-off room works; galaxy, queue and nearby controls absent; zero nearby frames.');
} finally {
  await browser?.close();
  await vite?.close();
  await signal.close();
}
