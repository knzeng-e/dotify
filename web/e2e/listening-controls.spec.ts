import { expect, test, type Page } from '@playwright/test';
import { installMediaSessionProbe, readMediaSessionHistory, readMediaSessionProbe } from './fixtures/mediaSessionProbe';

type ArtworkEvidence = { attempt: number; phase: string; kind?: string; elapsedMs: number };
async function readArtworkEvidence(page: Page): Promise<ArtworkEvidence[]> {
  return page.evaluate(async () => {
    const path = '/src/features/catalog/audioStartupTelemetry.ts';
    const telemetry = await import(path);
    return JSON.parse(telemetry.serializeAudioDiagnostics(telemetry.getAudioStartupTelemetrySnapshot())).artwork;
  });
}

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
    const observations = await readArtworkEvidence(page);
    expect(observations.some(event => event.phase === 'composed')).toBe(true);
    const publication = observations.filter(event => event.phase === 'metadata-published' && event.kind === 'png').at(-1)!;
    expect(publication).toBeDefined();
    const owner = observations.filter(event => event.attempt === publication.attempt);
    expect(owner.some(event => event.phase === 'decoded' || event.phase === 'prepared-hit')).toBe(true);
    expect(owner.map(event => event.elapsedMs)).toEqual(owner.map(event => event.elapsedMs).sort((a, b) => a - b));
    expect(JSON.stringify(observations)).not.toMatch(/Deterministic Classic|data:image|ipfs|0x[0-9a-f]{8}/i);

    expect((await readMediaSessionProbe(page)).album).toBe('Dotify');
    await testInfo.attach('solo-system-artwork', { body: Buffer.from(png.src.split(',')[1], 'base64'), contentType: 'image/png' });
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
  await expect.poll(async () => (await readArtworkEvidence(page)).some(event => event.phase === 'image-load-started')).toBe(true);
  const pending = (await readArtworkEvidence(page)).filter(event => event.phase === 'image-load-started').at(-1)!.attempt;
  await page.locator('.solo-player-header .player-account-trigger').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
  release();
  // Public delivery finishes independently of best-effort disk persistence.
  // Await that same immutable image before checking the retired metadata owner.
  await page.evaluate(async path => {
    const modulePath = '/src/services/publicArtworkCache.ts';
    const { loadPublicArtwork } = await import(modulePath);
    await loadPublicArtwork([`https://gateway.pinata.cloud/ipfs/${path}/cover/640.webp`]);
  }, root);
  expect(await readMediaSessionProbe(page)).toMatchObject({ title: null, artwork: [], actions: [], state: 'none' });
  await expect(page.locator('audio[src]')).toHaveCount(0);
  const retired = (await readArtworkEvidence(page)).filter(event => event.attempt === pending);
  expect(retired.at(-1)?.phase).toBe('cancelled');
  expect(retired.some(event => event.phase === 'composed' || (event.phase === 'metadata-published' && event.kind === 'png'))).toBe(false);
});

test('a stalled disk write cannot hold back system artwork', async ({ page }) => {
  await page.addInitScript(() => {
    const put = Cache.prototype.put;
    Reflect.set(window, '__heldArtworkWrites', 0);
    Cache.prototype.put = function (request, response) {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      if (url.startsWith('https://dotify.artwork.invalid/')) {
        Reflect.set(window, '__heldArtworkWrites', Reflect.get(window, '__heldArtworkWrites') + 1);
        return new Promise<void>(() => {});
      }
      return put.call(this, request, response);
    };
  });
  const root = 'QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu';
  await page.route(`**/ipfs/${root}/cover/*.webp`, route =>
    route.fulfill({
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64'),
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' }
    })
  );
  await unlockFixture(page, 'bulletin-delayed-cover');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__heldArtworkWrites'))).toBe(1);
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  await expect(page.locator('audio[src]')).toHaveCount(1);
  // Additional rendered variants share bounded persistence even while put stalls.
  expect(await page.evaluate(() => Reflect.get(window, '__heldArtworkWrites'))).toBe(1);
});

test('room system artwork keeps track attribution and a stable Dotify signature without room text', async ({ page }, testInfo) => {
  await installMediaSessionProbe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eAutoplay=on&e2eSync=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name or nickname').fill('Room host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).album).toBe('Dotify');
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  const session = await readMediaSessionProbe(page);
  expect(session.title).toBe('E2E Public Room Track');
  expect(session.artist).toBe('Dotify Room Host');
  await testInfo.attach('room-system-artwork', { body: Buffer.from(session.artwork[0].src.split(',')[1], 'base64'), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close room', exact: true }).click();
  await page.getByRole('button', { name: 'Close room and keep listening', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).album ?? '').toBe('Dotify');
});

test('reopening a prepared cover publishes its PNG immediately without composing it again', async ({ page }) => {
  await installMediaSessionProbe(page);
  await page.addInitScript(() => {
    const encode = HTMLCanvasElement.prototype.toDataURL;
    Reflect.set(window, '__systemPngCompositions', 0);
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      if (this.width === 640 && this.height === 640 && args[0] === 'image/png') {
        Reflect.set(window, '__systemPngCompositions', Reflect.get(window, '__systemPngCompositions') + 1);
      }
      return encode.apply(this, args);
    };
  });
  await page.goto('/?e2eRoom=public&e2eAutoplay=on&e2eSync=on&e2eCatalog=sequence');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name or nickname').fill('Cover host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  const prepared = (await readMediaSessionProbe(page)).artwork[0].src;
  await page.getByRole('button', { name: 'Close room', exact: true }).click();
  await page.getByRole('button', { name: 'Close room and keep listening', exact: true }).click();
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).title).toBeNull();
  const historyStart = (await readMediaSessionHistory(page)).length;
  const compositions = await page.evaluate(() => Reflect.get(window, '__systemPngCompositions'));
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).title).toBe('E2E Public Room Track');
  const registrations = (await readMediaSessionHistory(page)).slice(historyStart).filter(entry => entry.title !== null);
  expect(registrations[0]).toEqual({ title: 'E2E Public Room Track', artist: 'Dotify Room Host', preparedPng: true });
  expect((await readMediaSessionProbe(page)).artwork[0].src).toBe(prepared);
  expect(await page.evaluate(() => Reflect.get(window, '__systemPngCompositions'))).toBe(compositions);
  // A second track on the same cover reuses pixels, never the old attribution.
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).title).toBeNull();
  const nextStart = (await readMediaSessionHistory(page)).length;
  await page.getByRole('button', { name: /^Play Second room track by/ }).click();
  await expect.poll(async () => (await readMediaSessionProbe(page)).title).toBe('Second room track');
  const next = (await readMediaSessionHistory(page)).slice(nextStart).filter(entry => entry.title !== null);
  expect(next[0]).toEqual({ title: 'Second room track', artist: 'Dotify Room Host', preparedPng: true });
  const observations = await readArtworkEvidence(page);
  const published = observations.filter(event => event.phase === 'metadata-published' && event.kind === 'png').at(-1)!;
  expect(observations.filter(event => event.attempt === published.attempt).map(event => event.phase)).toContain('prepared-hit');

  expect((await readMediaSessionProbe(page)).artwork[0].src).toBe(prepared);
  expect(await page.evaluate(() => Reflect.get(window, '__systemPngCompositions'))).toBe(compositions);
});

test('a Host that rejects system metadata cannot break account disconnect or the player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await unlockFixture(page, 'bulletin-generated-cover');
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  await page.evaluate(() => {
    const session = Reflect.get(window, '__TEST_MUSIC_SESSION__');
    Object.defineProperty(session, 'metadata', {
      configurable: true,
      get: () => null,
      set: () => {
        throw new Error('Host rejected metadata');
      }
    });
  });
  await page.locator('.solo-player-header .player-account-trigger').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.locator('audio[src]')).toHaveCount(0);
  await expect(page.locator('.solo-player-header').getByRole('button', { name: 'Connect account' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('returning to the app retries a failed cover once without restarting playback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const NativeImage = window.Image;
    const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    Reflect.set(window, '__systemDecodeAttempts', 0);
    window.Image = function (...args: ConstructorParameters<typeof Image>) {
      const image = new NativeImage(...args);
      Object.defineProperty(image, 'src', {
        get: () => source.get!.call(image),
        set: (value: string) => {
          if (value.startsWith('blob:')) {
            const attempts = Number(Reflect.get(window, '__systemDecodeAttempts')) + 1;
            Reflect.set(window, '__systemDecodeAttempts', attempts);
            if (attempts === 1) {
              queueMicrotask(() => image.dispatchEvent(new Event('error')));
              return;
            }
          }
          source.set!.call(image, value);
        }
      });
      return image;
    } as typeof Image;
  });
  const root = 'QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu';
  await page.route(`**/ipfs/${root}/cover/*.webp`, route =>
    route.fulfill({
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64'),
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' }
    })
  );
  await unlockFixture(page, 'bulletin-delayed-cover');
  await expect.poll(async () => (await readArtworkEvidence(page)).some(event => event.phase === 'fallback')).toBe(true);
  expect((await readMediaSessionProbe(page)).artwork[0].src).toMatch(/^https?:/);
  await page.evaluate(() => {
    Reflect.get(window, '__TEST_MUSIC_SESSION__').handlers.pause();
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await expect.poll(async () => (await readMediaSessionProbe(page)).artwork[0]?.src).toMatch(/^data:image\/png;base64,/);
  await expect.poll(async () => (await readMediaSessionProbe(page)).state).toBe('paused');
  expect(await page.evaluate(() => Reflect.get(window, '__systemDecodeAttempts'))).toBe(2);
  await page.evaluate(() => {
    for (const state of ['hidden', 'visible', 'hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  expect(await page.evaluate(() => Reflect.get(window, '__systemDecodeAttempts'))).toBe(2);
});
