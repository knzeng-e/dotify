import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`catalog row, search and all-tracks view work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide');
    const catalog = page.getByRole('region', { name: 'Music catalog' });
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    await catalog.scrollIntoViewIfNeeded();
    expect(await catalog.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Next tracks', exact: true }).click();
    await expect.poll(() => catalog.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await catalog.focus();
    await catalog.press('Home');
    await expect(page.getByRole('button', { name: 'Previous tracks', exact: true })).toBeDisabled();
    await catalog.press('End');
    await expect(page.getByRole('button', { name: 'Next tracks', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Show all tracks', exact: true }).click();
    await expect(catalog).toHaveAttribute('data-layout', 'grid');
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    await page.getByRole('button', { name: 'Show as a row', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Find a track or artist' });
    await search.fill('sélection 7');
    await expect(page.getByTestId('track-card')).toHaveCount(1);
    await expect(catalog).toContainText('Session selection 7');
    await search.fill('nothing matching');
    await expect(catalog).toContainText('No tracks match');
    await page.getByRole('button', { name: 'Clear music search' }).click();
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    await catalog.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.catalogue-section').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page
      .getByTestId('track-card')
      .first()
      .evaluate(element => element.scrollIntoView({ block: 'center', inline: 'start', behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`) });
    await search.fill('Protected Room');
    await page.getByTestId('track-card-open').click();
    await expect(page.getByTestId('locked-player-state')).toBeVisible();
  });
}

test.describe('Turkish browser locale', () => {
  test.use({ locale: 'tr-TR' });

  test('catalog row search matches uppercase and lowercase titles and artists consistently', async ({ page }) => {
    // Browser locale emulation does not consistently update String's default
    // locale on every runner. Exercise native Turkish casing deterministically.
    await page.addInitScript(() => {
      const lower = String.prototype.toLocaleLowerCase;
      String.prototype.toLocaleLowerCase = function (locales?: string | string[]) {
        return lower.call(this, locales ?? 'tr-TR');
      };
    });
    await page.goto('/?e2eRoom=public');
    await expect(page.getByTestId('track-card')).toHaveCount(3);
    // Verify this browser really uses Turkish case rules for the old code path.
    expect(await page.evaluate(() => 'PUBLIC'.toLocaleLowerCase())).toBe('publıc');
    const search = page.getByRole('searchbox', { name: 'Find a track or artist' });
    for (const query of ['public', 'PUBLIC']) {
      await search.fill(query);
      await expect(page.getByTestId('track-card')).toHaveCount(1);
      await expect(page.getByTestId('track-card')).toContainText('E2E Public Room Track');
    }
    for (const query of ['dotify room host', 'DOTIFY ROOM HOST']) {
      await search.fill(query);
      await expect(page.getByTestId('track-card')).toHaveCount(2);
    }
  });
});

test('new covers expose responsive browser hints while legacy cards remain compatible', async ({ page }) => {
  const requested = new Set<string>();
  const webp = Buffer.from('UklGRjgAAABXRUJQVlA4ICwAAACwAQCdASoCAAIAAUAmJaACdLoABdQAAP6k15FIsZW//DlP/DlP/DlP+F/AAA==', 'base64');
  await page.route('**/ipfs/bafy-e2e-cover/cover/**', async route => {
    requested.add(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 200, contentType: 'image/webp', body: webp });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eResponsiveCover=on');

  const image = page.getByTestId('track-card').filter({ hasText: 'E2E Public Room Track' }).locator('img');
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('loading', 'lazy');
  await expect(image).toHaveAttribute('decoding', 'async');
  await expect(image).toHaveAttribute('sizes', '(max-width: 520px) 42vw, 190px');
  await expect(image).toHaveAttribute('srcset', /cover\/64\.webp 64w.*cover\/640\.webp 640w/);
  await expect(image).toHaveAttribute('data-cover-loaded', 'true');
  await expect.poll(() => Array.from(requested).some(path => /\/cover\/(64|160|320|640)\.webp$/.test(path))).toBe(true);
});
