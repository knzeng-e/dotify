import { expect, test, type Page } from '@playwright/test';
async function solo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: /^Open E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect(page.locator('.player-stage')).toBeVisible();
  const audio = page.locator('audio').first();
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => !node.paused)).toBe(true);
  await audio.evaluate(node => Reflect.set(node, '__motionIdentity__', true));
  return audio;
}
async function expectSource(page: Page) {
  expect(
    await page
      .locator('audio')
      .first()
      .evaluate(node => Reflect.get(node, '__motionIdentity__'))
  ).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((node: HTMLAudioElement) => !node.paused)
    )
    .toBe(true);
}

test('player expands and collapses without replacing or pausing the persistent source', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await solo(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
    await expect(page.locator('.player-dock')).toBeVisible();
    await expectSource(page);
    await page.locator('.player-dock-art').click();
    await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
    await expectSource(page);
  }
  await expect.poll(() => page.locator('html').getAttribute('data-player-motion')).toBeNull();
  expect(errors).toEqual([]);
});

test('queue sheet closes through drag, Escape and Back while retaining focus and audio', async ({ page }, testInfo) => {
  await solo(page);
  const trigger = page.getByRole('button', { name: 'Queue', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Queue', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('E2E Public Room Track', { exact: true })).toBeVisible();
  await expectSource(page);
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(845);
  expect((await sheet.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('queue-sheet.png') });
  const handle = sheet.getByRole('button', { name: 'Collapse queue' }),
    h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 35, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await handle.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Collapse queue' }).hover();
  const handle2 = (await page.getByRole('button', { name: 'Collapse queue' }).boundingBox())!;
  await page.mouse.move(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2);
  await page.mouse.down();
  await expect(sheet).toHaveAttribute('data-pulling', 'true');
  await page.mouse.move(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2 + 110, { steps: 6 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  await expectSource(page);
  await trigger.click();
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.player-stage')).toBeVisible();
  await expectSource(page);
});

test('reduced motion and missing transition APIs preserve immediate player navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
  });
  await solo(page);
  await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
  await page.locator('.player-dock-art').click();
  await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
  expect(await page.locator('html').getAttribute('data-player-motion')).toBeNull();
  await expectSource(page);
});

test('minimizing a live room retains membership and the same host audio source', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name or nickname').fill('Motion host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const code = await page.getByTestId('room-code').innerText();
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((node: HTMLAudioElement) => !node.paused)
    )
    .toBe(true);
  await page
    .locator('audio')
    .first()
    .evaluate(node => Reflect.set(node, '__motionIdentity__', true));
  await page.getByRole('button', { name: 'Keep listening and browse' }).click();
  await expect(page.locator('.player-dock')).toBeVisible();
  await expectSource(page);
  await page.locator('.player-dock-art').click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await expectSource(page);
});
