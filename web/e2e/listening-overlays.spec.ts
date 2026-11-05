import { expect, test } from '@playwright/test';

test('room queue and release details share a sheet without dropping drafts, membership or audio', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Sheet host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const code = await page.getByTestId('room-code').innerText();
  await page
    .locator('audio')
    .first()
    .evaluate(audio => Reflect.set(audio, '__sheetSource', true));
  const queue = page.getByRole('button', { name: 'Queue', exact: true });
  await queue.click();
  const sheet = page.getByRole('dialog', { name: 'Room queue', exact: true });
  await expect(sheet).toHaveClass(/listening-sheet/);
  const search = sheet.getByRole('textbox', { name: 'Find a track to add next', exact: true });
  await search.fill('A thought to keep');
  await page.screenshot({ path: info.outputPath('room-queue-sheet.png') });
  await sheet.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(queue).toBeFocused();
  await queue.click();
  await expect(search).toHaveValue('A thought to keep');
  await page.goBack();
  await expect(sheet).toBeHidden();
  await queue.click();
  await expect.poll(() => sheet.evaluate(node => getComputedStyle(node).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  const handle = sheet.getByRole('button', { name: 'Collapse room queue' });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(sheet).toHaveAttribute('data-pulling', 'true');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 6 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();
  await queue.click();
  await expect.poll(() => sheet.evaluate(node => getComputedStyle(node).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  await expect(search).toHaveValue('A thought to keep');
  await sheet.press('Escape');
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: 'About this release', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'About this release', exact: true });
  await expect(details).toHaveClass(/listening-sheet/);
  await page.screenshot({ path: info.outputPath('release-sheet.png') });
  await details.getByRole('button', { name: 'Collapse release details', exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(page.getByTestId('room-code')).toHaveText(code);
  expect(
    await page
      .locator('audio')
      .first()
      .evaluate(audio => Reflect.get(audio, '__sheetSource'))
  ).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((audio: HTMLAudioElement) => !audio.paused)
    )
    .toBe(true);
});

test('room queue search stays above a reduced keyboard viewport and keeps its draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Keyboard host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Room queue', exact: true });
  const search = sheet.getByRole('textbox', { name: 'Find a track to add next', exact: true });
  await search.fill('Keep this draft');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 24 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  // FormViewport deliberately ignores scroll corrections below one CSS pixel.
  await expect.poll(() => search.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(319);
  await expect.poll(() => sheet.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(334);
  await search.press('Escape');
  await expect(sheet).toBeHidden();
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    Reflect.deleteProperty(window.visualViewport!, 'offsetTop');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(search).toHaveValue('Keep this draft');
});

test('automatic next into denied access dismisses the queue before the access dialog owns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=unauthorized&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Access host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a track to add next', exact: true }).fill('Protected');
  await page.getByRole('button', { name: 'Add to queue E2E Protected Room Track by Dotify Room Host', exact: true }).click();
  await page.locator('audio').first().dispatchEvent('ended');
  await expect(page.getByTestId('access-warning')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Room queue', exact: true })).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Room queue', exact: true })).toBeVisible();
});
