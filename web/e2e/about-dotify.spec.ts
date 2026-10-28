import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`About exposes build and safe copy without connecting at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('private-diagnostic-sentinel', 'never-copy-this');
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (text: string) => Reflect.set(window, '__copiedAppDetails', text) }
      });
    });
    await page.goto('/?e2eRoom=public');
    await page.getByRole('button', { name: 'You', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'About Dotify', exact: true });
    await expect(trigger).toBeInViewport();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'About Dotify', exact: true });
    await expect(dialog.getByText('0.1.28', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Let the music connect the dots', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Polkadot App has its own version/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Copy app details', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('App details copied');
    const copied = await page.evaluate(() => Reflect.get(window, '__copiedAppDetails') as string);
    expect(copied.split('\n')).toHaveLength(5);
    expect(copied).toContain('Dotify: Product 0.1.28');
    expect(copied).toContain('Build: 1234567890abcdef1234567890abcdef12345678');
    expect(copied).toContain('Audio path: Progressive AAC');
    expect(copied).not.toContain('never-copy-this');
    expect(copied).not.toContain('e2eRoom');
    await dialog.getByText('Technical details', { exact: true }).click();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`about-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('About remains readable when a mobile Host blocks clipboard access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'MediaSource', { value: undefined });
    Object.defineProperty(window, 'ManagedMediaSource', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Clipboard denied');
        }
      }
    });
  });
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'About Dotify', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'About Dotify', exact: true });
  await dialog.getByRole('button', { name: 'Copy app details', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Copy is unavailable here');
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText('Compatibility AAC', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'About Dotify', exact: true })).toBeVisible();
});

test('About identifies managed AAC selection without exposing account details', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'MediaSource', { value: undefined });
    Reflect.set(
      window,
      'ManagedMediaSource',
      class {
        static isTypeSupported() {
          return true;
        }
      }
    );
  });
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'About Dotify', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'About Dotify', exact: true });
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText('Progressive AAC (managed)', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Selected for AAC playback', { exact: true })).toBeVisible();
});
