import { expect, test, type Page } from '@playwright/test';

async function expectControlsFit(page: Page) {
  const controls = page.getByRole('group', { name: 'Playback controls', exact: true });
  await expect(controls.getByRole('slider')).toBeVisible();
  for (const name of ['Shuffle', 'Previous track', 'Next track', 'Repeat this track', 'Mute']) {
    const button = controls.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  const boxes = await controls.locator('button').evaluateAll(buttons =>
    buttons
      .map(button => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right };
      })
      .sort((a, b) => a.left - b.left)
  );
  for (let index = 1; index < boxes.length; index++) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [844, 390],
  [1435, 833],
  [1440, 1000]
]) {
  test(`player essentials remain available solo and in a room at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eSync=on');
    await page.getByRole('button', { name: /^Open E2E Public Room Track by Dotify Room Host,/ }).click();
    const stage = page.locator('.player-stage');
    await expect(stage).toBeVisible();
    await expectControlsFit(page);
    const cover = await stage.locator('.cover').boundingBox();
    const status = await stage.getByRole('status', { name: 'Playback status' }).boundingBox();
    expect(status!.y + status!.height).toBeLessThanOrEqual(cover!.y);
    if (width <= 768) {
      const metadata = await stage.locator('.track-copy').boundingBox();
      expect(metadata!.y - (cover!.y + cover!.height)).toBeLessThanOrEqual(24);
    }
    await expect(stage.getByRole('status', { name: 'Playback status' })).not.toContainText('Hosting');
    const repeat = stage.getByRole('button', { name: 'Repeat this track', exact: true });
    await expect(repeat).toBeEnabled();
    await repeat.click();
    await expect(repeat).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page
        .locator('audio')
        .first()
        .evaluate((audio: HTMLAudioElement) => audio.loop)
    ).toBe(true);
    await repeat.click();
    await expect(repeat).toHaveAttribute('aria-pressed', 'false');
    await stage.getByRole('button', { name: 'Shuffle', exact: true }).click();
    await expect(stage.getByRole('button', { name: 'Shuffle', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: testInfo.outputPath('solo-player.png') });
    await page.getByRole('button', { name: 'Open room', exact: true }).click();
    await page.getByLabel('Your name in the room').fill('Player host');
    await page.getByRole('button', { name: 'Open the room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
    await expectControlsFit(page);
    await expect(stage.getByRole('slider', { name: 'Seek', exact: true })).toBeEnabled();
    if (width >= 769 && height >= 800) {
      const artworkColumn = await stage.locator('.player-cover-column').boundingBox();
      const progress = await stage.locator('.transport-progress').boundingBox();
      expect(progress!.x).toBeGreaterThanOrEqual(artworkColumn!.x + artworkColumn!.width - 1);
    }
    await page.screenshot({ path: testInfo.outputPath('room-player.png') });
  });
}
