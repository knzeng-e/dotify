import { syntheticWav } from './fixtures/syntheticWav';
import { expect, test, type Page } from '@playwright/test';

const fixture = '/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence&e2eAutoplay=on';
const source = (page: Page) => page.locator('audio').first();
async function play(page: Page) {
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await expect(source(page)).toHaveJSProperty('paused', false);
}
async function browseMusic(page: Page, width: number) {
  const back = page.getByRole('button', { name: 'Back to Music', exact: true });
  if (await back.isVisible()) await back.click();
  else
    await page
      .locator(width <= 768 ? '.bottom-nav' : '.topbar')
      .getByRole('button', { name: 'Music', exact: true })
      .click();
}

async function installSystemProbe(page: Page) {
  await page.addInitScript(() => {
    const handlers = new Map<string, MediaSessionActionHandler | null>();
    Reflect.set(window, '__systemHandlers', handlers);
    Object.defineProperty(navigator, 'mediaSession', {
      value: {
        metadata: null,
        playbackState: 'none',
        setPositionState() {},
        setActionHandler: (name: string, handler: MediaSessionActionHandler | null) => handlers.set(name, handler)
      }
    });
  });
}

test('system controls are idempotent, follow the selected track and clear after dismissal', async ({ page }) => {
  await installSystemProbe(page);
  await play(page);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('E2E Public Room Track');
  const action = (name: string, detail = {}) =>
    page.evaluate(
      ({ name, detail }) => {
        const handler = (Reflect.get(window, '__systemHandlers') as Map<string, MediaSessionActionHandler>).get(name);
        handler?.({ action: name as MediaSessionAction, ...detail });
      },
      { name, detail }
    );
  await action('pause');
  await action('pause');
  await expect(source(page)).toHaveJSProperty('paused', true);
  await action('play');
  await action('play');
  await expect(source(page)).toHaveJSProperty('paused', false);
  await action('seekto', { seekTime: 17 });
  await expect.poll(() => source(page).evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(17);
  await action('nexttrack');
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe('Second room track');
  await page.locator('.topbar').getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('none');
  expect(await page.evaluate(() => [...(Reflect.get(window, '__systemHandlers') as Map<string, unknown>).values()].every(value => value === null))).toBe(true);
});

for (const width of [320, 1440])
  test(`returning offers local listening without autoplay at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await play(page);
    await source(page).evaluate(audio => {
      audio.currentTime = 17;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    const saved = await page.evaluate(() => localStorage.getItem('dotify:listening-checkpoint:v1'));
    expect(saved).toContain('e2e-room-public');
    expect(saved).not.toMatch(/contentKey|blob:|data:audio|roomId/);
    await page.reload();
    const offer = page.getByRole('region', { name: 'Saved listening' });
    await expect(offer).toContainText('E2E Public Room Track');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`resume-${width}.png`) });
    await expect(source(page)).toHaveJSProperty('paused', true);
    await offer.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(source(page)).toHaveJSProperty('paused', false);
    await expect.poll(() => source(page).evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(17);
    await browseMusic(page, width);
    await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
    await page.reload();
    await expect(offer).toHaveCount(0);
    await expect(source(page)).toHaveJSProperty('paused', true);
  });

test('a system Pause during source preparation prevents deferred autoplay', async ({ page }) => {
  await installSystemProbe(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const wav = syntheticWav();
  await page.route('**/__dotify_e2e__/room-sequence.wav', async route => {
    await held;
    await route.fulfill({ body: wav, contentType: 'audio/wav' });
  });
  await page.goto(fixture + '&e2eTrackDelay=on');
  await page.getByRole('button', { name: /^Play Second room track by/ }).click();
  await expect.poll(() => page.evaluate(() => typeof (Reflect.get(window, '__systemHandlers') as Map<string, unknown>).get('pause') === 'function')).toBe(true);
  await page.evaluate(() => (Reflect.get(window, '__systemHandlers') as Map<string, MediaSessionActionHandler>).get('pause')!({ action: 'pause' }));
  release();
  await expect.poll(() => source(page).evaluate(audio => audio.readyState)).toBeGreaterThanOrEqual(3);
  await expect(source(page)).toHaveJSProperty('paused', true);
  await page.locator('.transport-play').click();
  await expect(source(page)).toHaveJSProperty('paused', false);
});
