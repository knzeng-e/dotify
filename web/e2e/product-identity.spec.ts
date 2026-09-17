import { expect, test, type Page } from '@playwright/test';

async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Use Polkadot app' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=public');
  await expect(page.getByRole('heading', { name: 'Start with the music', exact: true })).toBeVisible();
});

test('host username labels the account and seeds a room without publishing it on connection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => window.identityFixture.requests)).toBe(0);
  await connect(page);
  await expect(page.locator('.wallet-pill-open')).toHaveText('gaby.dot');
  await page.locator('.wallet-pill-open').click();
  await expect(page.locator('.wallet-identity')).toContainText('gaby.dot');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await expect(page.getByLabel('Your name in the room')).toHaveValue('gaby.dot');
  await page.screenshot({ path: testInfo.outputPath('host-name-room.png'), animations: 'disabled' });
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('dotify:display-name:')))).toEqual([]);
});

test('late profile responses cannot rename a newer connection or restore a disconnected account', async ({ page }) => {
  await page.evaluate(() => window.identityFixture.setProfile('old.dot', 17, true));
  await connect(page);
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.setProfile('new.dot', 17));
  await connect(page);
  await expect(page.locator('.wallet-pill-open')).toHaveText('new.dot');
  await page.evaluate(() => window.identityFixture.resolveName());
  await expect(page.locator('.wallet-pill-open')).toHaveText('new.dot');
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.setProfile('late.dot', 51, true));
  await connect(page);
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.resolveName());
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  await expect(page.locator('.wallet-pill-open')).toHaveCount(0);
});

test('denied name sharing keeps a usable account and a room alias stays editable', async ({ page }) => {
  await page.evaluate(() => window.identityFixture.setProfile('hidden.dot', 17, false, true));
  await connect(page);
  await expect(page.locator('.wallet-pill-open')).toHaveText(/0x[0-9a-f]+\.\.\.[0-9a-f]+/);
  await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.setProfile('arrives-later.dot', 17, true));
  await connect(page);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('My circle name');
  await page.evaluate(() => window.identityFixture.resolveName());
  await expect(page.locator('.wallet-pill-open')).toHaveText('arrives-later.dot');
  await expect(page.getByLabel('Your name in the room')).toHaveValue('My circle name');
});

test('remembered aliases stay account scoped and long usernames fit the mobile header', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(async () => {
    const address = window.identityFixture.addressForKey(17);
    localStorage.setItem(`dotify:display-name:${address.toLowerCase()}`, 'Saved circle name');
    window.identityFixture.setProfile('a-very-long-musical-username.dot');
  });
  await connect(page);
  await expect(page.locator('.wallet-pill-open')).toHaveText('a-very-long-musical-username.dot');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await expect(page.getByLabel('Your name in the room')).toHaveValue('Saved circle name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.setProfile('next.dot', 34));
  await connect(page);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await expect(page.getByLabel('Your name in the room')).toHaveValue('next.dot');
});

test('extension events follow the extension account and cannot replace a Product connection', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Use browser wallet' }).click();
  await expect(page.locator('.wallet-pill-open')).toHaveText('0x1111…1111');
  await page.evaluate(() => window.identityFixture.emitExtension('accountsChanged', ['0x' + '22'.repeat(20)]));
  await expect(page.locator('.wallet-pill-open')).toHaveText('0x2222…2222');
  await page.evaluate(() => window.identityFixture.emitExtension('disconnect'));
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  await connect(page);
  await expect(page.locator('.wallet-pill-open')).toHaveText('gaby.dot');
  await page.evaluate(() => {
    window.identityFixture.emitExtension('accountsChanged', []);
    window.identityFixture.emitExtension('disconnect');
  });
  await expect(page.locator('.wallet-pill-open')).toHaveText('gaby.dot');
});
