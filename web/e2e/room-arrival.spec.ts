import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`room arrival puts joining and hosting within reach at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public');
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    const form = page.getByRole('region', { name: 'Join or host a room' });
    await expect(form).toBeVisible();
    const code = page.getByLabel('Room code or link', { exact: true });
    const inputBox = await code.boundingBox();
    expect(inputBox!.width).toBeGreaterThanOrEqual(180);
    const joinBox = await form.getByRole('button', { name: 'Join', exact: true }).boundingBox();
    const hostBox = await form.getByRole('button', { name: 'Open a room', exact: true }).boundingBox();
    await expect(page.locator('.player-dock')).toHaveCount(0);
    const bottomNav = width <= 768 ? await page.locator('.bottom-nav').boundingBox() : null;
    const visibleBoundary = bottomNav?.y ?? page.viewportSize()!.height;
    for (const box of [inputBox, joinBox, hostBox]) expect(box!.y + box!.height).toBeLessThan(visibleBoundary);
    // Other workers may host real rooms. Arrival controls must remain usable
    // regardless of whether discovery is empty or active.
    await expect(page.getByText('Room signal online', { exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath(`room-arrival-${width}.png`), fullPage: true });
    await code.fill('ABC123');
    await form.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByLabel('Your name in the room')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
