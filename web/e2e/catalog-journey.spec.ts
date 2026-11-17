import { expect, test } from '@playwright/test';

for (const { width, reducedMotion } of [390, 1440].flatMap(width => (['reduce', 'no-preference'] as const).map(reducedMotion => ({ width, reducedMotion })))) {
  test(`catalog journey preserves search, row, grid and focus at ${width}px with ${reducedMotion}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide');
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    const catalog = page.getByRole('region', { name: 'Music catalog' });
    const firstAction = await page.getByTestId('track-card-open').first().boundingBox();
    await expect(page.locator('.player-dock')).toHaveCount(0);
    expect(firstAction!.y + firstAction!.height).toBeLessThan(page.viewportSize()!.height);
    await expect(page.locator('.moment-feature')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`discovery-${width}.png`), fullPage: true });

    const search = page.getByRole('searchbox', { name: 'Find a track or artist' });
    await search.fill('selection');
    await expect(page.getByTestId('track-card')).toHaveCount(10);
    const target = page.getByRole('button', { name: /^Open Session selection 7 by Dotify Room Host,/ });
    await target.scrollIntoViewIfNeeded();
    await target.focus();
    const left = await catalog.evaluate(element => element.scrollLeft);
    expect(left).toBeGreaterThan(100);
    await target.click();
    await expect(page.locator('.player-stage')).toBeVisible();
    await page.getByRole('button', { name: width <= 768 ? 'Back to Music' : 'Music', exact: true }).click();
    await expect(search).toHaveValue('selection');
    await expect(target).toBeFocused();
    expect(Math.abs((await catalog.evaluate(element => element.scrollLeft)) - left)).toBeLessThan(3);

    await page.getByRole('button', { name: 'Show all tracks', exact: true }).click();
    // Model a live shelf changing height while visiting an artist, independent
    // of which rooms other parallel browser tests happen to create.
    await page.addStyleTag({ content: '.catalogue-section { margin-top: var(--test-catalog-offset, 0px); }' });
    await page.evaluate(() => document.documentElement.style.setProperty('--test-catalog-offset', '240px'));
    const artist = page.getByTestId('track-card').nth(6).getByRole('button', { name: 'Dotify Room Host', exact: true });
    await artist.scrollIntoViewIfNeeded();
    await artist.focus();
    // Capture at activation: Playwright may scroll the button into a safe
    // click position after focus, just as a browser can reveal a focused item.
    await artist.evaluate(element => {
      element.addEventListener(
        'click',
        () => Reflect.set(window, '__catalogDeparture', { top: scrollY, anchorTop: element.getBoundingClientRect().top + scrollY }),
        { once: true, capture: true }
      );
    });
    await artist.click();
    const departure = await page.evaluate(() => Reflect.get(window, '__catalogDeparture') as { top: number; anchorTop: number });
    await expect(page.getByRole('button', { name: 'Back to discovery', exact: true })).toBeVisible();
    await page.evaluate(() => document.documentElement.style.removeProperty('--test-catalog-offset'));
    await page.getByRole('button', { name: 'Back to discovery', exact: true }).click();
    await expect(search).toHaveValue('selection');
    await expect(catalog).toHaveAttribute('data-layout', 'grid');
    await expect(artist).toBeFocused();
    // The live-room shelf can move above/below the catalog while this page is
    // away. Compare the focused item's viewport position, not an absolute page
    // offset which changes with that shelf. Allow only rounding, and clamp at
    // document edges where the original viewport position cannot be preserved.
    await expect
      .poll(() =>
        artist.evaluate((element, saved) => {
          const anchorTop = element.getBoundingClientRect().top + scrollY;
          const maxTop = Math.max(0, document.documentElement.scrollHeight - innerHeight);
          const expectedTop = Math.max(0, Math.min(saved.top + anchorTop - saved.anchorTop, maxTop));
          return Math.abs(scrollY - expectedTop);
        }, departure)
      )
      .toBeLessThanOrEqual(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
