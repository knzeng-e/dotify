import { expect, test } from '@playwright/test';
type FixtureWindow = typeof window & { w34: ReturnType<typeof import('./fixtures/playback-key-preparation').mount> };

test('automatic key preparation waits for audio headroom, coalesces and stops for a room guest', async ({ page }) => {
  await page.route('**/w34-prefetch', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Playback preparation lifecycle</title>' })
  );
  await page.route('**/ipfs/**', route => route.fulfill({ body: 'synthetic ciphertext', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/api/media/**', route => route.fulfill({ body: 'synthetic ciphertext', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/w34-prefetch');
  await page.evaluate(async () => {
    const path = '/e2e/fixtures/playback-key-preparation.ts';
    const fixture = (await import(path)) as typeof import('./fixtures/playback-key-preparation');
    Object.assign(window, { w34: fixture.mount() });
  });
  await expect(page.getByText('Host playback')).toBeVisible();
  const fixture = () =>
    page.evaluate(() => (window as typeof window & { w34: ReturnType<typeof import('./fixtures/playback-key-preparation').mount> }).w34.count());
  expect(await fixture()).toBe(0);
  await page.evaluate(() => (window as FixtureWindow).w34.headroom(true));
  await expect.poll(fixture).toBe(1);
  await page.evaluate(() => {
    (window as FixtureWindow).w34.headroom(true);
    (window as FixtureWindow).w34.headroom(true);
  });
  expect(await fixture()).toBe(1);
  await page.evaluate(() => (window as FixtureWindow).w34.enabled(false));
  await expect(page.getByText('Room guest')).toBeVisible();
  expect(await page.evaluate(() => (window as FixtureWindow).w34.aborted())).toEqual([true]);
  await page.evaluate(() => (window as FixtureWindow).w34.headroom(true));
  await page.waitForTimeout(600);
  expect(await fixture()).toBe(1);
  await page.evaluate(() => (window as FixtureWindow).w34.enabled(true));
  await expect.poll(fixture).toBe(2);
  await page.evaluate(() => (window as FixtureWindow).w34.unmount());
  expect(await page.evaluate(() => (window as FixtureWindow).w34.aborted())).toEqual([true, true]);
});
