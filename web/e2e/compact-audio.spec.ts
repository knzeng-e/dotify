import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BulletinCodecFixture } from '../../services/api/src/scripts/bulletinCodecTypes.test';
type Harness = typeof import('./fixtures/compact-audio').harness;

const fixture: BulletinCodecFixture = JSON.parse(readFileSync(path.join(process.cwd(), '.data/compact-streaming-fixture.json'), 'utf8'));
if (fixture.schema !== 'dotify.synthetic-bulletin-codec.v1' || fixture.keyHex !== '47'.repeat(32)) throw new Error('Public synthetic codec fixture required');
const api = 'http://127.0.0.1:5294';
const nativeBlocks = Object.fromEntries(
  [...new Set(Object.values(fixture.graphs).flatMap(graph => graph.playbackBlockCids))].map(cid => [cid, fixture.blocks[cid]])
);
const snapshot = (page: Page) => page.evaluate(() => (Reflect.get(window, '__compactAudio') as Harness).snapshot());
const start = (page: Page, layout: 'standard' | 'compact', compatibility = false, ahead = 4) =>
  page.evaluate(({ layout, compatibility, ahead }) => Reflect.get(window, '__compactAudio').start(layout, compatibility, ahead), {
    layout,
    compatibility,
    ahead
  });
async function hear(page: Page) {
  await page.getByRole('button', { name: 'Play synthetic audio' }).click();
  await expect.poll(async () => (await snapshot(page)).currentTime).toBeGreaterThan(0.15);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__compactAudio').power())).toBeGreaterThan(0.01);
  expect(await snapshot(page)).toMatchObject({ paused: false, errors: [], mediaError: null, liveCaptureTracks: 1 });
}
const blocked = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, request }, testInfo) => {
  await request.post(`${api}/reset`);
  const denied: string[] = [];
  blocked.set(page, denied);
  // No wallet, live API, IPFS gateway, font or Bulletin endpoint is used.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'blob:' && url.origin === new URL(page.url()).origin) return route.continue();
    if (url.hostname === '127.0.0.1' && ['5293', '5294', '5295'].includes(url.port)) return route.continue();
    denied.push(url.origin + url.pathname);
    return route.abort();
  });
  await page.addInitScript(input => Reflect.set(window, '__codecFixture', input), {
    mode: testInfo.project.metadata.mode,
    keyHex: fixture.keyHex,
    scope: fixture.scope,
    graphs: Object.fromEntries(Object.entries(fixture.graphs).map(([name, g]) => [name, { root: g.root, ref: g.ref }])),
    blocks: nativeBlocks
  });
  // Controlled latency exercises the unchanged estimator; these are not
  // network speed measurements. The real API still authenticates each object.
  await page.route('**/api/media/**/segment-*.bin', async route => {
    await new Promise(resolve => setTimeout(resolve, 30));
    await route.continue();
  });
  await page.goto('/e2e/fixtures/compact-audio.html');
  await page.waitForFunction(() => Reflect.has(window, '__compactAudio'));
});
test.afterEach(async ({ page, request }, testInfo) => {
  const state = await snapshot(page);
  const rtc = await page.evaluate(() => (Reflect.get(window, '__compactAudio') as Harness).rtcStats());
  await page.evaluate(() => Reflect.get(window, '__compactAudio').dispose());
  const stats = (await (await request.get(`${api}/stats`)).json()) as { calls: string[]; objects: string[]; blockBytes: number };
  await testInfo.attach('synthetic-codec-evidence', {
    body: JSON.stringify({ ...state, rtc, api: stats, externalRequests: blocked.get(page) }, null, 2),
    contentType: 'application/json'
  });
  expect(state.errors).toEqual([]);
  expect(state.mediaError).toBeNull();
  expect(blocked.get(page)).toEqual([]);
  const archive = new Set(Object.values(fixture.graphs).flatMap(graph => graph.archiveBlockCids));
  expect([...state.nativeCalls, ...stats.calls].some(cid => archive.has(cid))).toBe(false);
  expect(stats.objects.some(object => /archive|pack\.bin|layout\.json|\?/.test(object))).toBe(false);
  if (testInfo.project.metadata.mode === 'host') {
    // Four compatibility reads can saturate the shared two-SDK-lookup budget.
    // Recovery is supported, but only through the registered format's API.
    if (state.progressive) expect(stats.objects).toEqual([]);
    for (const url of stats.objects) {
      expect(
        Object.entries(fixture.graphs).some(([layout, graph]) => url.startsWith(`/api/media/${graph.root}/${layout === 'compact' ? 'compact-v1' : 'stream'}/`))
      ).toBe(true);
    }
  } else expect(state.nativeCalls).toEqual([]);
});

test('compact AAC produces signal and seeks forward and back without a silent clock', async ({ page, browserName }) => {
  // WebKit's MediaSource-to-WebAudio capture is not a reliable energy probe;
  // exercise its real full-rendition compatibility reader instead. Existing
  // streaming-format tests separately retain WebKit progressive codec checks.
  const compatibility = browserName === 'webkit';
  expect(await start(page, 'compact', compatibility)).toEqual({ progressive: !compatibility });
  await hear(page);
  await page.evaluate(() => Reflect.get(window, '__compactAudio').seek(18));
  await expect.poll(async () => (await snapshot(page)).currentTime).toBeGreaterThan(18.1);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__compactAudio').power())).toBeGreaterThan(0.01);
  await page.evaluate(() => Reflect.get(window, '__compactAudio').seek(5));
  await expect.poll(async () => (await snapshot(page)).currentTime).toBeGreaterThan(5.1);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__compactAudio').power())).toBeGreaterThan(0.01);
  expect((await snapshot(page)).firstSignalMs).toBeGreaterThan(0);
});

test('standard and compact selections share the real audio element without reinterpreting old references', async ({ page, browserName }) => {
  const compatibility = browserName === 'webkit';
  for (const layout of ['standard', 'compact', 'standard'] as const) {
    expect(await start(page, layout, compatibility)).toEqual({ progressive: !compatibility });
    await hear(page);
    const state = await snapshot(page);
    expect(state.currentTime).toBeLessThan(4);
    expect(state.metrics.some(metric => metric.phase === 'first-segment-decrypted')).toBe(true);
  }
});

test('a cold transport restart reopens the same compact graph with measurable output', async ({ page, request, browserName }) => {
  const compatibility = browserName === 'webkit';
  await start(page, 'compact', compatibility);
  await hear(page);
  await page.evaluate(() => Reflect.get(window, '__compactAudio').dispose());
  await page.goto('about:blank');
  await request.post(`${api}/reset`);
  await page.goto('/e2e/fixtures/compact-audio.html');
  await page.waitForFunction(() => Reflect.has(window, '__compactAudio'));
  await start(page, 'compact', compatibility);
  await hear(page);
});

test('compact compatibility AAC reaches a WebRTC guest and plays to its authenticated end', async ({ page }) => {
  // Full authenticated rendition, the same portable fallback used by managed
  // Room capture. This is a loopback guest, not physical iPhone background proof.
  expect(await start(page, 'compact', true)).toEqual({ progressive: false });
  await page.evaluate(() => Reflect.get(window, '__compactAudio').connectGuest());
  await hear(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__compactAudio').guestPower())).toBeGreaterThan(0.01);
  await expect.poll(async () => (await snapshot(page)).ended, { timeout: 28_000 }).toBe(true);
  const state = await snapshot(page);
  expect(state.currentTime).toBeCloseTo(24.2, 0);
  expect(state.metrics.filter(metric => metric.phase === 'first-segment-decrypted')).toHaveLength(1);
});

test('every compact quality decodes into real PCM without accessing the archive', async ({ page }) => {
  const qualities = await page.evaluate(() => (Reflect.get(window, '__compactAudio') as Harness).decodeQualities());
  expect(qualities.map(q => q.bitrate)).toEqual([96, 160, 320]);
  for (const quality of qualities) {
    expect(quality.seconds).toBeCloseTo(24.2, 0);
    expect(quality.rms).toBeGreaterThan(0.01);
  }
});

test('Web compact delivery decodes 96 → 320 → 160 after measured headroom and congestion', async ({ page, browserName }, testInfo) => {
  test.skip(
    testInfo.project.metadata.mode !== 'web' || browserName === 'webkit',
    'HTTP congestion and progressive capture energy apply to Chromium/Firefox; WebKit has full-rendition PCM and compatibility/guest signal coverage.'
  );
  await page.route('**/api/media/**/segment-*.bin', async route => {
    await new Promise(resolve => setTimeout(resolve, route.request().url().endsWith('/320/segment-004.bin') ? 2500 : 30));
    await route.continue();
  });
  await start(page, 'compact', false, 30);
  await hear(page);
  await expect
    .poll(async () => (await snapshot(page)).metrics.filter(metric => metric.phase === 'rendition-selected').map(metric => metric.bitrateKbps), {
      timeout: 20_000
    })
    .toEqual(expect.arrayContaining([96, 320, 160]));
  await expect.poll(async () => (await snapshot(page)).ended, { timeout: 28_000 }).toBe(true);
  expect((await snapshot(page)).currentTime).toBeCloseTo(24.2, 0);
});
