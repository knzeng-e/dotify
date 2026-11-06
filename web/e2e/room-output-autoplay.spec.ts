import { expect, test } from '@playwright/test';

test.afterEach(async ({ page }) => {
  const close = page.getByRole('button', { name: 'Close room', exact: true });
  if (await close.isVisible()) await close.click();
});

test('a device-blocked host start offers explicit resume without preparing the track again', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.srcObject && !Reflect.get(window, '__allowHostAudio')) return Promise.reject(new DOMException('A gesture is required', 'NotAllowedError'));
      return play.call(this);
    };
  });
  await page.goto('/?e2eRoom=public&e2eAutoplay=on&e2eSync=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Blocked start host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const room = page.getByRole('region', { name: 'Shared listening room' });
  await expect(room).toBeVisible();
  await expect(room.getByRole('status').filter({ hasText: 'Tap play to start' })).toBeVisible();
  const source = await page.locator('audio').first().getAttribute('src');
  await page.evaluate(() => Reflect.set(window, '__allowHostAudio', true));
  await page.getByRole('button', { name: 'Resume audio', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((audio: HTMLAudioElement) => audio.currentTime)
    )
    .toBeGreaterThan(0.2);
  expect(await page.locator('audio').first().getAttribute('src')).toBe(source);
  await page.getByRole('button', { name: 'Close room', exact: true }).click();
});
