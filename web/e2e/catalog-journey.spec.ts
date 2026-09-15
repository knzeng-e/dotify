import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`catalog journey preserves search, row, grid and focus at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide');
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    const catalog = page.getByRole('region', { name: 'Music catalog' });
    const firstAction = await page.getByTestId('track-card-open').first().boundingBox();
    const dock = await page.locator('.player-dock').boundingBox();
    expect(firstAction!.y + firstAction!.height).toBeLessThan(dock!.y);
    await expect(page.locator('.moment-feature')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`discovery-${width}.png`), fullPage: true });

    const search = page.getByRole('searchbox', { name: 'Find a track or artist' });
    await search.fill('selection');
    await expect(page.getByTestId('track-card')).toHaveCount(10);
    const target = page.getByRole('button', { name: 'Open Session selection 7 by Dotify Room Host', exact: true });
    await target.scrollIntoViewIfNeeded();
    await target.focus();
    const left = await catalog.evaluate(element => element.scrollLeft);
    expect(left).toBeGreaterThan(100);
    await target.click();
    await expect(page.locator('.player-stage')).toBeVisible();
    await page.getByRole('button', { name: 'Music', exact: true }).click();
    await expect(search).toHaveValue('selection');
    await expect(target).toBeFocused();
    expect(Math.abs((await catalog.evaluate(element => element.scrollLeft)) - left)).toBeLessThan(3);

    await page.getByRole('button', { name: 'Show all tracks', exact: true }).click();
    const artist = page.getByTestId('track-card').nth(6).getByRole('button', { name: 'Dotify Room Host', exact: true });
    await artist.scrollIntoViewIfNeeded();
    await artist.focus();
    const top = await page.evaluate(() => scrollY);
    await artist.click();
    await page.getByRole('button', { name: 'Back to discovery', exact: true }).click();
    await expect(search).toHaveValue('selection');
    await expect(catalog).toHaveAttribute('data-layout', 'grid');
    await expect(artist).toBeFocused();
    expect(Math.abs((await page.evaluate(() => scrollY)) - top)).toBeLessThan(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
