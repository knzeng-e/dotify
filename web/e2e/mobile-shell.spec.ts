import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile listener shell keeps music, transport, and navigation inside the viewport', async ({ page }) => {
  await page.goto('/?e2eRoom=public');

  const catalogCard = page.getByTestId('track-card').first();
  await expect(catalogCard).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeVisible();

  const homeLayout = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-testid="track-card"]');
    const nav = document.querySelector<HTMLElement>('.bottom-nav');
    const cardBox = card?.getBoundingClientRect();
    const navBox = nav?.getBoundingClientRect();

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      cardWidth: cardBox?.width ?? 0,
      cardHeight: cardBox?.height ?? 0,
      navBottom: navBox?.bottom ?? 0,
      viewportHeight: window.innerHeight
    };
  });

  expect(homeLayout.documentWidth).toBeLessThanOrEqual(homeLayout.viewportWidth);
  expect(homeLayout.cardWidth).toBeLessThanOrEqual(homeLayout.viewportWidth - 24);
  expect(homeLayout.cardHeight).toBeLessThan(150);
  expect(Math.abs(homeLayout.navBottom - homeLayout.viewportHeight)).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Open E2E Public Room Track by Dotify Room Host' }).click();
  await expect(page.locator('.player-stage')).toBeVisible();
  await expect(page.locator('.player-context-panel')).toBeHidden();

  const playerLayout = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.player-stage');
    const title = document.querySelector<HTMLElement>('.track-copy h2');
    const stageBox = stage?.getBoundingClientRect();

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      stageLeft: stageBox?.left ?? -1,
      stageRight: stageBox?.right ?? window.innerWidth + 1,
      titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0
    };
  });

  expect(playerLayout.documentWidth).toBeLessThanOrEqual(playerLayout.viewportWidth);
  expect(playerLayout.stageLeft).toBeGreaterThanOrEqual(0);
  expect(playerLayout.stageRight).toBeLessThanOrEqual(playerLayout.viewportWidth);
  expect(playerLayout.titleSize).toBeLessThanOrEqual(46);
});
