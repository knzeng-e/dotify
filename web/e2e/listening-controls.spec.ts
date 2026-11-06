import { expect, test, type Page } from '@playwright/test';
import { installMediaSessionProbe, readMediaSessionProbe } from './fixtures/mediaSessionProbe';

async function unlockFixture(page: Page, scenario: string) {
  await installMediaSessionProbe(page);
  await page.route('https://eth-rpc-testnet.polkadot.io/**', async route => {
    const rpc = route.request().postDataJSON();
    if (rpc?.method === 'eth_chainId') return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: '0x190f1b41' } });
    return route.continue();
  });
  // Some tests deliberately hold a cover response. App interaction must not
  // wait for that image's load event, particularly in WebKit.
  await page.goto(`/?e2eClassic=${scenario}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('track-card-open').click();
  await page.getByRole('button', { name: 'Unlock listening', exact: true }).click();
  await page.getByTestId('classic-unlock-button').click();
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Access verified');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}

for (const width of [320, 390, 430]) {
  test(`mobile player account access and generated system artwork at ${width}px`, async ({ page }, testInfo) => {
    // Cold Vite/WebKit startup, unlock, artwork decoding and screenshots share
    // this scenario budget. Keep account actions bounded independently below.
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await unlockFixture(page, 'bulletin-generated-cover');
    await expect.poll(async () => (await readMediaSessionProbe(page)).title).toBe('Deterministic Classic Unlock');
    await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
    const png = (await readMediaSessionProbe(page)).artwork[0];
    expect(png).toMatchObject({ sizes: '640x640', type: 'image/png' });
    expect(
      await page.evaluate(async src => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, png.src)
    ).toEqual([640, 640]);
    const account = page.locator('.solo-player-header .player-account-trigger');
    await expect(account).toBeVisible();
    expect(
      await account.evaluate(button => {
        const box = button.getBoundingClientRect();
        return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth;
      })
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`player-account-${width}.png`), fullPage: true, animations: 'disabled' });
    await account.click({ timeout: 6_000 });
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Connected');
    await sheet.getByRole('button', { name: 'Disconnect', exact: true }).click({ timeout: 6_000 });
    await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
    await expect(page.locator('.solo-player-header').getByRole('button', { name: 'Connect account' })).toBeVisible();
    await expect(page.locator('audio[src]')).toHaveCount(0);
    await expect.poll(async () => await readMediaSessionProbe(page)).toMatchObject({ title: null, actions: [], state: 'none' });
  });
}

test('a public artwork response arriving after disconnect cannot restore system metadata', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  let requests = 0;
  const root = 'QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu';
  await page.route(`**/ipfs/${root}/cover/*.webp`, async route => {
    requests++;
    await held;
    await route.fulfill({
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64'),
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' }
    });
  });
  await unlockFixture(page, 'bulletin-delayed-cover');
  await expect.poll(() => requests).toBeGreaterThan(0);
  await page.locator('.solo-player-header .player-account-trigger').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
  release();
  await expect
    .poll(() =>
      page.evaluate(async path => {
        const cache = await caches.open('dotify-public-artwork-v1');
        return Boolean(await cache.match(`https://dotify.artwork.invalid/ipfs/${path}/cover/640.webp`));
      }, root)
    )
    .toBe(true);
  expect(await readMediaSessionProbe(page)).toMatchObject({ title: null, artwork: [], actions: [], state: 'none' });
  await expect(page.locator('audio[src]')).toHaveCount(0);
});

test('room system artwork retains attribution and retires room context on exit', async ({ page }, testInfo) => {
  await installMediaSessionProbe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eAutoplay=on&e2eSync=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name or nickname').fill('Room host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).album).toContain('Dotify · Hosting live · 1 here');
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  const session = await readMediaSessionProbe(page);
  expect(session.title).toBe('E2E Public Room Track');
  expect(session.artist).toBe('Dotify Room Host');
  await testInfo.attach('room-system-artwork', { body: Buffer.from(session.artwork[0].src.split(',')[1], 'base64'), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close room', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).album ?? '').toBe('');
});
