import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';

const output = path.resolve('..', 'docs/images/release-preview');
const artist = '0x000000000000000000000000000000000000a711';
const runtime = '0x000000000000000000000000000000000000a712';
const titles = ['Riverlight', 'Night Crossing', 'Open Skies'];

function artwork(title: string, color: string, index: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#0b2341"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="640" height="640" fill="url(#a)"/><circle cx="${160 + index * 90}" cy="220" r="180" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/><circle cx="390" cy="390" r="220" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><path d="M0 460 Q160 240 320 460 T640 460" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none"/><text x="48" y="540" fill="#fff" font-family="sans-serif" font-size="44">${title}</text><text x="50" y="580" fill="#fff" fill-opacity=".7" font-family="sans-serif" font-size="17" letter-spacing="5">MINA · DEMO RELEASE</text></svg>`;
  return svg;
}

const covers = titles.map((title, index) => {
  const body = artwork(title, ['#176b67', '#693d70', '#285387'][index], index);
  const cid = CID.createV1(0x55, digest(0x12, createHash('sha256').update(body).digest())).toString();
  return { body, cid };
});

const tracks = titles.map((title, index) => ({
  id: `${runtime}:0x${String(index + 1).padStart(64, '0')}`,
  hash: `0x${String(index + 1).padStart(64, '0')}`,
  artistAddress: artist,
  title,
  artist: 'Mina',
  active: true,
  source: 'artist',
  zone: 'Demo',
  audioRef: '/e2e/fixtures/continuity-tone.mp3',
  localUrl: '/e2e/fixtures/continuity-tone.mp3',
  imageRef: `ipfs://${covers[index].cid}`,
  priceDot: '0',
  description: 'A local demonstration release for the Dotify documentation.',
  bulletinRef: '',
  metadataRef: 'e2e:documentation',
  royaltyBps: 10000,
  durationLabel: 'Demo',
  accessMode: 'free',
  royaltySplits: [],
  personhoodLevel: 'DIM1',
  encrypted: false
}));

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
    await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
  });
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
  await seed(guestContext);
  try {
    await host.goto('/?e2eArtist=happy');
    await expect(host.getByTestId('track-card')).toHaveCount(3);
    await capture(host, 'music-desktop');
    await host.getByRole('button', { name: 'Open a room', exact: true }).click();
    await host.getByRole('button', { name: 'Select Riverlight', exact: true }).click();
    await host.getByLabel('Your name or nickname', { exact: true }).fill('Mina');
    await host.locator('summary').filter({ hasText: 'Name your room' }).click();
    await host.getByLabel('Room name', { exact: false }).fill('Riverlight sessions');
    await host.getByLabel('A short invitation', { exact: false }).fill('Come share a discovery. Stay for the conversation.');
    await host.getByRole('radio', { name: 'Everyone', exact: true }).check();
    await host.getByRole('button', { name: 'Open the room', exact: true }).click();
    await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
    const code = (await host.getByTestId('room-code').innerText()).trim();
    const guest = await guestContext.newPage();
    await guest.goto(`/?e2eRoom=listener#/rooms/${code}`);
    await guest.getByLabel('Your name or nickname').fill('Alex');
    await guest.getByRole('button', { name: 'Join and listen' }).click();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
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
    await host.bringToFront();
    await host.getByRole('button', { name: 'Rooms', exact: true }).click();
    const radar = host.getByRole('region', { name: 'Room galaxy', exact: true });
    await expect(radar.getByRole('button', { name: /^Inspect / }), await radar.innerText()).toHaveCount(1, { timeout: 20_000 });
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
          data: 'Local synthetic releases, artwork, accounts and participants; not live activity.',
          validation: 'Visual documentation only, not native Product or pilot acceptance.'
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await Promise.allSettled([guestContext.close(), context.close()]);
  }
});
