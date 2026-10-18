import { expect, test, type Browser, type Page } from '@playwright/test';

const PUBLIC_TITLE = 'E2E Public Room Track';
const fix = { latitude: 0.392, longitude: 9.454, accuracy: 100 };
async function hostRoom(browser: Browser) {
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  const host = await context.newPage();
  await host.goto('/?e2eRoom=public');
  await host.getByRole('button', { name: 'Open a room' }).click();
  await host.getByRole('button', { name: `Select ${PUBLIC_TITLE}` }).click();
  await host.getByLabel('Your name or nickname').fill('Discovery host');
  await host.getByRole('radio', { name: 'Nearby', exact: true }).check();
  await host.getByRole('button', { name: 'Open the room' }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15_000 });
  await host.getByRole('tab', { name: /People/ }).click();
  await expect(host.getByRole('region', { name: 'Room visibility' })).toContainText('Visible nearby');
  return { context, roomId: (await host.getByTestId('room-code').textContent())!.trim() };
}
async function openNearby(page: Page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(fix);
  await page.goto('/?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const radar = page.getByRole('region', { name: 'Room galaxy' });
  await expect(radar.getByRole('heading', { name: PUBLIC_TITLE })).toBeVisible({ timeout: 20_000 });
  return radar;
}

test('desktop galaxy opens automatically; range and pause settings keep keyboard focus', async ({ browser, page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const room = await hostRoom(browser);
  try {
    const radar = await openNearby(page);
    await expect(radar.getByTestId('room-galaxy')).toBeVisible();
    await radar.getByRole('button', { name: 'Search settings' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('slider', { name: 'Search range' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(sheet.getByRole('slider')).toHaveAttribute('aria-valuetext', 'About 6 kilometres');
    await page.keyboard.press('Escape');
    await expect(radar.getByRole('button', { name: 'Search settings' })).toBeFocused();
    await radar.screenshot({ path: testInfo.outputPath('automatic-galaxy-desktop.png') });
    await radar.getByRole('button', { name: 'Search settings' }).click();
    await sheet.getByRole('button', { name: 'Pause nearby search' }).click();
    await sheet.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(radar.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
    await expect(radar).toContainText('Nearby paused');
  } finally {
    await room.context.close();
  }
});

test('galaxy and direct joining work without WebGL', async ({ browser, page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return native.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const room = await hostRoom(browser);
  try {
    const radar = await openNearby(page);
    await expect(radar.getByTestId('room-galaxy')).toBeVisible();
    await radar.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel('Your name or nickname').fill('No WebGL guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
  } finally {
    await room.context.close();
  }
});

test('reduced motion keeps room actions usable and clears hidden results', async ({ browser, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await hostRoom(browser);
  try {
    const radar = await openNearby(page);
    expect(await radar.locator('.radar-sweep').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    await radar.getByLabel(`Options for ${PUBLIC_TITLE}`, { exact: true }).focus();
    await page.keyboard.press('Enter');
    await radar.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(radar.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
    await expect(radar.getByRole('button', { name: /^Inspect / })).toHaveCount(0);
  } finally {
    await room.context.close();
  }
});

test('mobile galaxy and inspection sheet stay touch-safe with no horizontal overflow', async ({ browser, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const room = await hostRoom(browser);
  try {
    const radar = await openNearby(page);
    const join = radar.getByRole('button', { name: 'Join', exact: true });
    await join.scrollIntoViewIfNeeded();
    const layout = await join.boundingBox();
    expect(layout!.height).toBeGreaterThanOrEqual(44);
    expect(layout!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await radar.getByRole('button', { name: /^Inspect / }).click();
    await page.screenshot({ path: testInfo.outputPath('room-preview-mobile.png'), fullPage: true });
    await page.getByRole('dialog', { name: PUBLIC_TITLE }).getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeDisabled();
    await page.getByLabel('Your name or nickname').fill('Mobile guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
  } finally {
    await room.context.close();
  }
});
