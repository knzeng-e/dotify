import { expect, test } from '@playwright/test';

test('3D operational off leaves scoped Radar, List, inspection and walletless Join available', async ({ browser, page }) => {
  const host = await browser.newPage();
  try {
    await host.goto('/?e2eRoom=public');
    await host.getByRole('button', { name: 'Open a room', exact: true }).click();
    await host.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
    await host.getByLabel('Your name or nickname').fill('3D rollback host');
    await host.getByRole('radio', { name: 'Everyone', exact: true }).check();
    await host.getByRole('button', { name: 'Open the room' }).click();
    await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
    await page.goto('/?e2eRoom=listener');
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    const radar = page.getByRole('region', { name: 'Room galaxy', exact: true });
    await expect(radar.getByRole('heading', { name: 'E2E Public Room Track' })).toBeVisible({ timeout: 20000 });
    await expect(radar.getByLabel('Room view', { exact: true }).locator('option')).toHaveText(['Radar', 'List']);
    expect(await page.evaluate(() => window.__DOTIFY_ROOM_GALAXY__)).toBeUndefined();
    await radar.getByLabel('Room view', { exact: true }).selectOption('list');
    await expect(radar.getByTestId('room-galaxy')).toHaveCount(0);
    await radar.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel('Your name or nickname').fill('Rollback guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests)).toBe(0);
  } finally {
    await host.close();
  }
});
