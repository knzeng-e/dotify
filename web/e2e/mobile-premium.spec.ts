import { expect, test, type Page, type TestInfo } from '@playwright/test';

const fixture = '/?e2eRoom=public&e2eSync=on&e2eCatalog=wide&e2eAutoplay=on';
const sizes = [
  [320, 568],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1440, 1000]
];

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: process.env.W28_CAPTURE_DIR ? `${process.env.W28_CAPTURE_DIR}/${page.viewportSize()!.width}-${name}.jpg` : info.outputPath(`${name}.jpg`),
    fullPage: true,
    quality: 80
  });
}

async function nav(page: Page, name: 'Music' | 'Rooms') {
  const back = page.getByRole('button', { name: 'Back to Music', exact: true });
  if (await back.isVisible()) await back.click();
  const navigation = page.viewportSize()!.width <= 768 ? page.locator('.bottom-nav') : page.locator('.topbar');
  await navigation.getByRole('button', { name, exact: true }).click();
}

for (const [width, height] of sizes) {
  test(`W28 listening surfaces at ${width}px`, async ({ browser }, info) => {
    const hostContext = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width <= 768 });
    const guestContext = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width <= 768 });
    try {
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();
      await host.goto(fixture);
      await expect(host.getByTestId('track-card')).toHaveCount(13);
      const rail = host.getByRole('region', { name: 'Music catalog' });
      expect(await rail.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      const card = await host.getByTestId('track-card').first().boundingBox();
      expect(card!.width).toBeGreaterThanOrEqual(160);
      if (width <= 768) await expect(host.locator('.catalog-row-controls')).toBeHidden();
      await capture(host, info, 'music');
      await host.locator('.catalogue-card .artist-text-button').first().click();
      await expect(host.locator('.artist-profile-view')).toBeVisible();
      await capture(host, info, 'artist');
      await nav(host, 'Music');
      await host.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
      await expect(host.locator('.track-copy h2')).toHaveText('E2E Public Room Track');
      if (width <= 768) {
        await expect(host.locator('.topbar')).toBeHidden();
        await expect(host.locator('.bottom-nav')).toBeHidden();
        for (const label of ['Seek', 'Previous track', 'Pause', 'Next track', 'Queue', 'Repeat this track']) {
          const control = label === 'Seek' ? host.getByRole('slider', { name: label, exact: true }) : host.getByRole('button', { name: label, exact: true });
          const box = (await control.boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(height);
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      await capture(host, info, 'player');
      const queueButton = host.getByRole('button', { name: 'Queue', exact: true });
      await queueButton.focus();
      await queueButton.press('Enter');
      const queue = host.getByRole('dialog', { name: 'Queue', exact: true });
      await expect(queue).toContainText('Up next');
      await capture(host, info, 'solo-queue');
      await host.keyboard.press('Escape');
      await expect(queueButton).toBeFocused();
      await nav(host, 'Rooms');
      await capture(host, info, 'rooms');
      await host.locator('.player-dock-title').click();
      await host.getByRole('button', { name: 'Open room', exact: true }).click();
      await host.getByLabel('Your name in the room').fill('W28 host');
      await host.getByRole('button', { name: 'Open the room', exact: true }).click();
      await expect(host.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
      const roomId = (await host.getByTestId('room-code').textContent())!.trim();
      expect(roomId).toMatch(/^[A-Z0-9]{4,}$/);
      await capture(host, info, 'host');
      const hostLargeText = await host.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect
        .poll(
          async () => {
            const boxes = await host.locator('.transport-cluster button, .transport-actions button').evaluateAll(buttons =>
              buttons.map(button => {
                const box = button.getBoundingClientRect();
                return { x: box.x, right: box.right, y: box.y, bottom: box.bottom };
              })
            );
            return (
              boxes.length > 0 &&
              boxes.every(
                (box, index) =>
                  box.x >= 0 &&
                  box.right <= width &&
                  boxes
                    .slice(index + 1)
                    .every(other => box.right <= other.x + 1 || other.right <= box.x + 1 || box.bottom <= other.y + 1 || other.bottom <= box.y + 1)
              )
            );
          },
          { message: 'Enlarged room transport settles inside the viewport without overlap' }
        )
        .toBe(true);
      await capture(host, info, 'host-200-text');
      await hostLargeText.evaluate(element => element.remove());
      await guest.goto(`${fixture}#/rooms/${roomId}`);
      await guest.getByLabel('Your name in the room').fill('W28 guest');
      await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
      await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
      await capture(guest, info, 'guest');
      await guest.getByRole('tab', { name: 'Queue', exact: true }).click();
      await expect(guest.locator('.host-lineup')).toBeVisible();
      await expect(guest.getByLabel('Add from the catalog')).toHaveCount(0);
      await guest.getByLabel('Request a track', { exact: true }).fill('A song from home');
      await capture(guest, info, 'room-queue');
      await guest.getByRole('tab', { name: 'Chat', exact: true }).click();
      await guest.getByLabel('Message the room', { exact: true }).fill('A shared listening moment');
      if (width <= 768) {
        await guest.evaluate(() => {
          Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 390 });
          window.visualViewport!.dispatchEvent(new Event('resize'));
        });
        await expect(guest.locator('.app-shell')).toHaveAttribute('data-composing', 'true');
        await capture(guest, info, 'keyboard');
        await guest.getByRole('button', { name: 'Finish typing' }).click();
        await guest.evaluate(() => {
          Reflect.deleteProperty(window.visualViewport!, 'height');
          window.visualViewport!.dispatchEvent(new Event('resize'));
        });
      }
      const enlarged = await guest.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const composer = guest.getByLabel('Message the room', { exact: true });
      await composer.scrollIntoViewIfNeeded();
      const composerBounds = (await composer.boundingBox())!;
      const bottomNav = await guest.locator('.bottom-nav').boundingBox();
      expect(composerBounds.y).toBeGreaterThanOrEqual(0);
      expect(composerBounds.y + composerBounds.height).toBeLessThanOrEqual(bottomNav?.height ? bottomNav.y : height);
      await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(guest, info, 'room-200-text');
      await enlarged.evaluate(element => element.remove());
      await nav(guest, 'Music');
      await expect(guest.locator('.player-dock-title')).toHaveText('E2E Public Room Track');
      await capture(guest, info, 'live-dock');
      await guest.goto('/');
      await guest.getByTestId('track-card-open').click();
      await guest.getByRole('button', { name: 'Support and open', exact: true }).click();
      await expect(guest.getByTestId('access-warning')).toBeVisible();
      await capture(guest, info, 'support');
      await guest.getByRole('button', { name: 'Not now', exact: true }).click();
      await guest.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(guest, info, 'player-200-text');
      await guest.getByRole('button', { name: 'Support and open', exact: true }).click();
      const dialog = guest.getByTestId('access-warning');
      await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await capture(guest, info, 'support-200-text');
      const dismiss = dialog.getByRole('button', { name: 'Not now', exact: true });
      await dismiss.scrollIntoViewIfNeeded();
      const dismissBounds = (await dismiss.boundingBox())!;
      expect(dismissBounds.y).toBeGreaterThanOrEqual(0);
      expect(dismissBounds.y + dismissBounds.height).toBeLessThanOrEqual(height);
      await dismiss.click();
      await expect(dialog).toHaveCount(0);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });
}

test('a touch swipe browses music without opening a release', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto(fixture);
    const rail = page.getByRole('region', { name: 'Music catalog' });
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    const box = (await rail.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const y = box.y + 60;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 340, y }] });
    for (const x of [300, 250, 200, 150, 90]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(150);
    await expect(page.locator('.player-dock')).toHaveCount(0);
    await expect(page.locator('.player-stage')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('solo queue uses the existing access check and never pays on selection', async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Queue', exact: true })
    .getByRole('button', { name: /^Open E2E Protected Room Track,/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'Queue', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('locked-player-state')).toBeVisible();
  await expect(page.getByTestId('access-warning')).toHaveCount(0);
  expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
});
