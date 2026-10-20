import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { artist, covers, tracks } from './fixtures/documentation-releases.mjs';

const output = path.resolve('..', 'docs/images/release-preview');

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
  });
  // Room geometry follows the visual viewport on the next animation frame.
  // Wait for that layout after resizing instead of photographing a stale width.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('[style*="--room-viewport-width"]');
        return !shell || Number.parseFloat(shell.style.getPropertyValue('--room-viewport-width')) === innerWidth;
      })
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 85, animations: 'disabled' });
}

async function seed(context: BrowserContext) {
  // Local mock delivery for synthetic, content-addressed artwork; no pinning.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const cover = covers.find(item => url.pathname === `/ipfs/${item.cid}` || url.hostname.startsWith(`${item.cid}.`));
    if (cover) return route.fulfill({ contentType: 'image/svg+xml', body: cover.body, headers: { 'access-control-allow-origin': '*' } });
    return url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:' ? route.continue() : route.abort();
  });
  await context.addInitScript(
    ({ tracks, artist }) => {
      localStorage.setItem('dotify:e2e:artist-publish', JSON.stringify({ runtimeCreated: true, tracks }));
      localStorage.setItem(`dotify:artist-name:${artist}`, 'Mina');
    },
    { tracks, artist }
  );
}

async function openRoom(page: Page, title: string, nickname: string, name: string, visibility: 'Everyone' | 'Nearby') {
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: `Select ${title}`, exact: true }).click();
  await page.getByLabel('Your name or nickname', { exact: true }).fill(nickname);
  await page.locator('summary').filter({ hasText: 'Name your room' }).click();
  await page.getByLabel('Room name', { exact: false }).fill(name);
  await page.getByLabel('A short invitation', { exact: false }).fill('Come share a discovery. Stay for the conversation.');
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
  return (await page.getByTestId('room-code').innerText()).trim();
}

async function joinRoom(page: Page, code: string, nickname: string) {
  await page.goto(`/?e2eRoom=listener#/rooms/${code}`);
  await page.getByLabel('Your name or nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join and listen' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
}

test('capture current documentation surfaces with disclosed local demo data', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ['geolocation'],
    geolocation: { latitude: 0.392, longitude: 9.454, accuracy: 100 },
    reducedMotion: 'reduce'
  });
  // No external API, chain, gateway, wallet or real participant is contacted.
  await seed(context);
  const host = await context.newPage();
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const contexts = [context, guestContext];
  await seed(guestContext);
  try {
    await host.goto('/?e2eArtist=happy');
    await expect(host.getByTestId('track-card')).toHaveCount(3);
    await capture(host, 'music-desktop');
    const code = await openRoom(host, 'Riverlight', 'Mina', 'Riverlight sessions', 'Everyone');
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Alex');
    await guest.getByLabel('Message the room').fill('This feels like a good place to start.');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByRole('log')).toContainText('This feels like a good place to start.');
    await host.bringToFront();
    await host.setViewportSize({ width: 1440, height: 1400 });
    await host.getByLabel('Message the room').fill('Welcome! What are you listening to today?');
    await host.getByRole('button', { name: 'Send message' }).click();
    await expect(guest.getByRole('log')).toContainText('Welcome! What are you listening to today?');
    await expect(host.getByLabel('Message the room')).toHaveValue('');
    await guest.bringToFront();
    await capture(guest, 'room-desktop');
    await guest.setViewportSize({ width: 390, height: 844 });
    await capture(guest, 'room-mobile');
    await expect(guest.getByLabel('Message the room')).toBeInViewport();
    // Open additional actual rooms before the galaxy capture, rather than
    // painting planets or injecting discovery counts into the interface.
    for (const room of [
      { title: 'Night Crossing', nickname: 'Sam', name: 'After-hours discoveries', visibility: 'Everyone' as const, guests: ['Jamie', 'Lea'] },
      { title: 'Open Skies', nickname: 'Noor', name: 'A little closer', visibility: 'Nearby' as const, guests: [] }
    ]) {
      const roomContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        permissions: ['geolocation'],
        geolocation: { latitude: 0.395, longitude: 9.454, accuracy: 100 },
        reducedMotion: 'reduce'
      });
      contexts.push(roomContext);
      await seed(roomContext);
      const roomHost = await roomContext.newPage();
      await roomHost.goto('/?e2eArtist=happy');
      const roomCode = await openRoom(roomHost, room.title, room.nickname, room.name, room.visibility);
      for (const nickname of room.guests) {
        const listenerContext = await browser.newContext({ reducedMotion: 'reduce' });
        contexts.push(listenerContext);
        await seed(listenerContext);
        await joinRoom(await listenerContext.newPage(), roomCode, nickname);
      }
    }
    await host.bringToFront();
    await host.getByRole('button', { name: 'Rooms', exact: true }).click();
    const radar = host.getByRole('region', { name: 'Room galaxy', exact: true });
    await expect(radar.getByRole('button', { name: /^Inspect / }), await radar.innerText()).toHaveCount(3, { timeout: 20_000 });
    await expect(radar.locator('.radar-invitations').getByText(/3 listening/)).toBeVisible();
    await expect(radar.locator('.radar-room-sphere img')).toHaveCount(3);
    await capture(host, 'rooms-desktop');
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.goto('/artists?e2eArtist=happy');
    await host.getByRole('tab', { name: 'Releases', exact: true }).click();
    await expect(host.getByText('Riverlight', { exact: true }).first()).toBeVisible();
    await capture(host, 'artist-desktop');
    await writeFile(
      path.join(output, 'capture.json'),
      JSON.stringify(
        {
          source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          applicationTree: execFileSync('git', ['rev-parse', 'HEAD:web/src'], { encoding: 'utf8' }).trim(),
          profile: 'web/playwright.docs.config.ts',
          capturedAt: new Date().toISOString(),
          browser: browser.version(),
          surfaces: ['music-desktop', 'rooms-desktop', 'room-desktop', 'room-mobile', 'artist-desktop'],
          galaxy: { rooms: 3, connectedSessions: [2, 3, 1], visibility: ['Worldwide', 'Worldwide', 'Nearby'] },
          data: 'Local synthetic releases, artwork, accounts and participants; not live activity.',
          validation: 'Visual documentation only, not native Product or pilot acceptance.'
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
