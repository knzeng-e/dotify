import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 }
];

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const bounds = shell?.getBoundingClientRect();
    return {
      documentFits: document.documentElement.scrollWidth <= innerWidth,
      scrollX,
      shellLeft: bounds?.left ?? 0,
      shellRight: bounds?.right ?? innerWidth,
      viewportWidth: innerWidth
    };
  });
  expect(geometry.documentFits).toBe(true);
  expect(geometry.scrollX).toBe(0);
  expect(geometry.shellLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.shellRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.getByRole('main')).toBeVisible();
  // Let route-level focus/scroll restoration settle before normalizing the
  // evidence frame. This keeps screenshots deterministic without racing the
  // player's intentional scrollIntoView on mount.
  await page.waitForTimeout(100);
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
}

async function captureArtistStudio(browser: Browser, viewport: { width: number; height: number }, testInfo: TestInfo) {
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage();
    await page.goto('/artists?e2eArtist=happy');
    await page.getByTestId('artist-name-input').fill('Lord Ékomy Ndong ☥');
    await page.getByLabel(/I understand and consent/i).check();
    await page.getByTestId('create-artist-profile').click();
    await expect(page.getByRole('dialog')).toContainText('Artist registered');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Lord Ékomy Ndong ☥', { exact: true })).toBeVisible();
    await capture(page, testInfo, 'artist-studio');
  } finally {
    await context.close();
  }
}

for (const viewport of viewports) {
  test(`visual contract evidence at ${viewport.width}px`, async ({ page, browser }, testInfo) => {
    // Seven independently seeded surfaces take longer in WebKit when the
    // focused compatibility suite runs several browser workers together.
    test.setTimeout(45_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide&e2eSync=on');
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    await capture(page, testInfo, 'music');

    await page.getByRole('button', { name: /^Open E2E Public Room Track by Dotify Room Host,/ }).click();
    await expect(page.getByRole('group', { name: 'Playback controls', exact: true })).toBeVisible();
    await capture(page, testInfo, 'player');

    await page.getByRole('button', { name: 'You', exact: true }).click();
    await capture(page, testInfo, 'you');
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await capture(page, testInfo, 'rooms');

    await page.getByRole('button', { name: 'Open a room', exact: true }).click();
    await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
    await page.getByLabel('Your name in the room').fill('Visual host');
    await page.getByRole('button', { name: 'Open the room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
    const roomId = (await page.getByTestId('room-code').innerText()).trim();
    await capture(page, testInfo, 'host-room');

    const guestContext = await browser.newContext({ viewport });
    try {
      const guest = await guestContext.newPage();
      await guest.emulateMedia({ reducedMotion: 'reduce' });
      await guest.goto(`/?e2eRoom=public&e2eSync=on#/rooms/${roomId}`);
      await guest.getByLabel('Your name in the room').fill('Visual guest');
      await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
      await expect(guest.getByTestId('room-code')).toHaveText(roomId);
      await capture(guest, testInfo, 'guest-room');
    } finally {
      await guestContext.close();
    }

    await captureArtistStudio(browser, viewport, testInfo);
  });
}
