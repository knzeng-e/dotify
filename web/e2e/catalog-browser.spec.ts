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
