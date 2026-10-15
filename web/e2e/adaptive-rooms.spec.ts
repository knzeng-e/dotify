import { expect, test, type Browser, type Page } from '@playwright/test';

const PUBLIC_TITLE = 'E2E Public Room Track';

async function hostRoom(browser: Browser) {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 0.392, longitude: 9.454, accuracy: 100 }
  });
  const host = await context.newPage();
  await host.goto('/?e2eRoom=public', { waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: 'Open a room' }).click();
  await host.getByRole('button', { name: `Select ${PUBLIC_TITLE}` }).click();
  await host.getByLabel('Your name in the room').fill('Discovery host');
  await host.getByRole('button', { name: 'Open the room' }).click();
  const roomCode = host.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z2-9]{6}/, { timeout: 15_000 });
  await host.getByRole('tab', { name: /People/ }).click();
  const visibility = host.getByRole('region', { name: 'Visible nearby', exact: true });
  await expect(visibility.getByRole('switch', { name: 'Visible nearby' })).not.toBeChecked();
  return {
    context,
    host,
    roomId: (await roomCode.textContent())!.trim(),
    publish: async () => {
      await visibility.getByRole('switch', { name: 'Visible nearby' }).check();
      await expect(visibility).toContainText('Visible nearby · about 5 km');
    }
  };
}

async function openNearby(page: Page) {
  await page.goto('/?e2eRoom=listener', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Listening rooms.', exact: true })).toBeVisible();
  return page.getByRole('region', { name: 'Nearby', exact: true });
}

async function exploreCity(page: Page) {
  const nearby = page.getByRole('region', { name: 'Nearby', exact: true });
  const summary = nearby.getByText('Explore a city', { exact: true });
  if (!(await nearby.getByLabel('City centre · starter areas').isVisible())) await summary.click();
  await nearby.getByLabel('City centre · starter areas').selectOption('Libreville');
  await nearby.getByRole('button', { name: 'Explore this city', exact: true }).click({ timeout: 15_000 });
  return nearby;
}

async function disableWebGl(page: Page) {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContextWithDisabledWebGl(type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return nativeGetContext.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

// The former global galaxy was not consented discovery. These checks retain
// responsive, keyboard and graphics-fallback coverage through the bounded radar.
test('desktop radar reveals only opted-in rooms after an explicit bounded search', async ({ browser, page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const room = await hostRoom(browser);
  const packets: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:') && !String(frame.payload).includes('worldwide')) packets.push(String(frame.payload));
    })
  );
  try {
    const nearby = await openNearby(page);
    await expect(nearby).toContainText('Search is off');
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
    await expect(page.getByTestId('room-galaxy-scene')).toHaveCount(0);
    await nearby.getByRole('slider', { name: 'Search range' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(nearby.getByRole('slider', { name: 'Search range' })).toHaveAttribute('aria-valuetext', 'About 6 kilometres');
    expect(packets).toEqual([]);
    await exploreCity(page);
    await expect(nearby).toContainText('No visible rooms');
    await nearby.getByRole('button', { name: 'Stop', exact: true }).click();
    await room.publish();
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
    await exploreCity(page);
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toBeVisible();
    await expect(nearby.getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await nearby.screenshot({ path: testInfo.outputPath('consented-radar-desktop.png') });
    await nearby.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
  } finally {
    await room.context.close();
  }
});

test('room discovery and direct joining work without WebGL', async ({ browser, page }) => {
  await disableWebGl(page);
  const room = await hostRoom(browser);
  try {
    await room.publish();
    const nearby = await openNearby(page);
    await exploreCity(page);
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toBeVisible();
    await expect(page.getByTestId('room-galaxy-canvas')).toHaveCount(0);
    await nearby.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel('Your name in the room').fill('No WebGL guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
  } finally {
    await room.context.close();
  }
});

test('reduced-motion radar keeps room actions usable and clears hidden results', async ({ browser, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await hostRoom(browser);
  try {
    await room.publish();
    const nearby = await openNearby(page);
    await exploreCity(page);
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toBeVisible();
    await nearby.getByLabel(`Options for ${PUBLIC_TITLE}`, { exact: true }).focus();
    await page.keyboard.press('Enter');
    await nearby.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toHaveCount(0);
    await expect(page.getByTestId('room-galaxy-scene')).toHaveCount(0);
    expect(await nearby.locator('.nearby-radar').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  } finally {
    await room.context.close();
  }
});

test('mobile radar keeps results and join controls touch-safe without horizontal overflow', async ({ browser, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const room = await hostRoom(browser);
  try {
    await room.publish();
    const nearby = await openNearby(page);
    await exploreCity(page);
    await expect(nearby.getByRole('heading', { name: PUBLIC_TITLE })).toBeVisible();
    const join = nearby.getByRole('button', { name: 'Join', exact: true });
    await join.scrollIntoViewIfNeeded();
    const layout = await join.boundingBox();
    expect(layout!.height).toBeGreaterThanOrEqual(44);
    expect(layout!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('consented-radar-mobile.png') });
    await join.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Your name in the room')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeDisabled();
    await page.getByLabel('Your name in the room').fill('Mobile guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
  } finally {
    await room.context.close();
  }
});
