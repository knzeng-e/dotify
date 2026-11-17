import { expect, test, type Page } from '@playwright/test';

async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Use Polkadot app' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect wallet' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=public');
  await expect(page.getByRole('region', { name: 'Music catalog', exact: true })).toBeVisible();
  await expect(page.getByTestId('track-card').first()).toBeVisible();
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
  await expect(page.getByLabel('Your name or nickname')).toHaveValue('gaby.dot');
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
  await page.getByLabel('Your name or nickname').fill('My circle name');
  await page.evaluate(() => window.identityFixture.resolveName());
  await expect(page.locator('.wallet-pill-open')).toHaveText('arrives-later.dot');
  await expect(page.getByLabel('Your name or nickname')).toHaveValue('My circle name');
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
  await expect(page.getByLabel('Your name or nickname')).toHaveValue('Saved circle name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect wallet' }).click();
  await page.evaluate(() => window.identityFixture.setProfile('next.dot', 34));
  await connect(page);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await expect(page.getByLabel('Your name or nickname')).toHaveValue('next.dot');
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

async function openHostSupport(page: Page) {
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'About Dotify', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'About Dotify', exact: true });
  await expect(dialog.getByRole('button', { name: 'Copy support report', exact: true })).toBeVisible();
  return dialog;
}

for (const clipboardAllowed of [true, false]) {
  test(`About adds optional Host software details without connecting an account, clipboard: ${clipboardAllowed}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(allowed => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            if (!allowed) throw Error('Denied');
            Reflect.set(window, '__hostSupportCopy', text);
          }
        }
      });
    }, clipboardAllowed);
    expect(await page.evaluate(() => window.identityFixture.hostInfoRequests)).toBe(0);
    const dialog = await openHostSupport(page);
    await expect.poll(() => page.evaluate(() => window.identityFixture.hostInfoRequests)).toBe(1);
    await dialog.getByText('Technical details', { exact: true }).click();
    await expect(dialog.getByText('Polkadot Desktop Dev 0.1.4-rc.3 (Desktop)', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Copy support report', exact: true }).click();
    const text = clipboardAllowed
      ? await page.evaluate(() => Reflect.get(window, '__hostSupportCopy') as string)
      : await dialog.getByRole('textbox', { name: 'Audio support report', exact: true }).inputValue();
    expect(JSON.parse(text).hostSoftware).toEqual({ status: 'reported', platform: 'Desktop', name: 'Polkadot Desktop Dev', version: '0.1.4-rc.3' });
    expect(text).not.toContain('PRIVATE');
    if (clipboardAllowed) {
      await dialog.getByRole('button', { name: 'Copy app details', exact: true }).click();
      const details = await page.evaluate(() => Reflect.get(window, '__hostSupportCopy') as string);
      expect(details).toContain('Host software: Polkadot Desktop Dev 0.1.4-rc.3 (Desktop)');
      expect(details).not.toContain('dotify.audio-diagnostics');
    }
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('host-software-support.png'), animations: 'disabled' });
    expect(
      await page.evaluate(() => [window.identityFixture.accountRequests, window.identityFixture.requests, window.identityFixture.locationRequests])
    ).toEqual([0, 0, 0]);
    await page.keyboard.press('Escape');
  });
}

test('closing About cancels the observation and repeated opens cannot queue Host requests', async ({ page }) => {
  await page.evaluate(() => {
    window.identityFixture.setHostInfoDelay(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => Reflect.set(window, '__hostSupportCopy', text) }
    });
  });
  let dialog = await openHostSupport(page);
  await expect.poll(() => page.evaluate(() => window.identityFixture.hostInfoRequests)).toBe(1);
  await page.keyboard.press('Escape');
  dialog = await openHostSupport(page);
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText('Host software unavailable', { exact: true })).toBeVisible();
  await page.evaluate(() => window.identityFixture.resolveHostInfo());
  await dialog.getByRole('button', { name: 'Copy support report', exact: true }).click();
  const text = await page.evaluate(() => Reflect.get(window, '__hostSupportCopy') as string);
  expect(JSON.parse(text).hostSoftware).toEqual({ status: 'unavailable' });
  expect(await page.evaluate(() => window.identityFixture.hostInfoRequests)).toBe(1);
  expect(await page.evaluate(() => window.identityFixture.accountRequests)).toBe(0);
});
