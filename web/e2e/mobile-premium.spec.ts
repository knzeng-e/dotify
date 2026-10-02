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
  // A sheet makes the underlying main inert, but its layout must still exist.
  await expect(page.locator('main')).toBeVisible();
  const fixedRoom = await page
    .locator('.app-shell')
    .evaluate(shell => shell.getAttribute('data-room-focus') === 'true' && getComputedStyle(shell).position === 'fixed');
  if (fixedRoom) {
    await expect
      .poll(() => page.locator('.app-shell').evaluate(shell => Math.abs(shell.getBoundingClientRect().height - (window.visualViewport?.height ?? innerHeight))))
      .toBeLessThanOrEqual(1);
    if (name === 'host' || name === 'guest') await expect(page.locator('.player-stage')).toBeInViewport({ ratio: 0.9 });
  }
  await page.screenshot({
    path: process.env.W28_CAPTURE_DIR ? `${process.env.W28_CAPTURE_DIR}/${page.viewportSize()!.width}-${name}.jpg` : info.outputPath(`${name}.jpg`),
    // Full-page capture can resize Chromium's viewport around a fixed shell,
    // triggering the real keyboard/viewport observer during the screenshot.
    fullPage: !fixedRoom,
    animations: 'disabled',
    quality: 80
  });
  if (fixedRoom) await expect(page.locator('main')).toBeVisible();
}

async function nav(page: Page, name: 'Music' | 'Rooms') {
  const back = page.getByRole('button', { name: 'Back to Music', exact: true });
  if (await back.isVisible()) await back.click();
  const navigation = page.viewportSize()!.width <= 768 ? page.locator('.bottom-nav') : page.locator('.topbar');
  await navigation.getByRole('button', { name, exact: true }).click();
}

async function roomTransportStatus(page: Page) {
  return page.locator('.player-stage > .player-transport').evaluate(transport => {
    const viewportWidth = window.innerWidth;
    const buttons = Array.from(transport.querySelectorAll<HTMLButtonElement>('.transport-cluster button, .transport-actions button'))
      .map(button => {
        const box = button.getBoundingClientRect();
        return {
          label: button.getAttribute('aria-label'),
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height
        };
      })
      .filter(box => box.width > 0 && box.height > 0);
    const clipped = buttons.some(box => box.left < -1 || box.right > viewportWidth + 1);
    const overlaps = buttons.flatMap((box, index) =>
      buttons.slice(index + 1).flatMap(other => {
        const xOverlap = Math.min(box.right, other.right) - Math.max(box.left, other.left);
        const yOverlap = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
        return xOverlap > 2 && yOverlap > 2 ? [{ a: box.label, b: other.label, xOverlap, yOverlap }] : [];
      })
    );
    return {
      ok: buttons.length > 0 && !clipped && overlaps.length === 0 && document.documentElement.scrollWidth <= viewportWidth + 1,
      buttons: buttons.map(box => ({
        label: box.label,
        left: Math.round(box.left * 10) / 10,
        right: Math.round(box.right * 10) / 10,
        top: Math.round(box.top * 10) / 10,
        bottom: Math.round(box.bottom * 10) / 10
      })),
      clipped,
      overlaps: overlaps.map(overlap => ({
        ...overlap,
        xOverlap: Math.round(overlap.xOverlap * 10) / 10,
        yOverlap: Math.round(overlap.yOverlap * 10) / 10
      })),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth
    };
  });
}

for (const [width, height] of sizes) {
  test(`W28 listening surfaces at ${width}px`, async ({ browser }, info) => {
    test.setTimeout(60_000);
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
      await host.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await host.waitForTimeout(150);
      await expect
        .poll(
          async () => {
            const status = await roomTransportStatus(host);
            return status.ok ? 'ok' : JSON.stringify(status);
          },
          { message: 'Enlarged room transport settles inside the viewport without overlap' }
        )
        .toBe('ok');
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
      // Font enlargement and visual-viewport restoration each trigger layout.
      // Check the same geometry after it settles, not a transitional rectangle.
      await expect
        .poll(async () => {
          await composer.scrollIntoViewIfNeeded();
          const bounds = (await composer.boundingBox())!;
          const bottomNav = await guest.locator('.bottom-nav').boundingBox();
          return bounds.y >= 0 && bounds.y + bounds.height <= (bottomNav?.height ? bottomNav.y : height) + 1;
        })
        .toBe(true);
      await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(guest, info, 'room-200-text');
      await enlarged.evaluate(element => element.remove());
      await nav(guest, 'Music');
      await expect(guest.locator('.player-dock-title')).toHaveText('E2E Public Room Track');
      await capture(guest, info, 'live-dock');
      await guest.goto('/');
      await guest.getByTestId('track-card-open').click();
      await guest.getByRole('button', { name: 'Unlock listening', exact: true }).click();
      await expect(guest.getByTestId('access-warning')).toBeVisible();
      await capture(guest, info, 'support');
      await guest.getByRole('button', { name: 'Not now', exact: true }).click();
      await guest.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(guest, info, 'player-200-text');
      await guest.getByRole('button', { name: 'Unlock listening', exact: true }).click();
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
  const lockedChoice = page.getByRole('dialog', { name: 'Queue', exact: true }).getByRole('button', { name: /^Open E2E Protected Room Track,/ });
  await expect(lockedChoice.locator('.lucide-arrow-right')).toHaveCount(1);
  await expect(lockedChoice.locator('.lucide-play')).toHaveCount(0);
  await lockedChoice.click();
  await expect(page.getByRole('dialog', { name: 'Queue', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('locked-player-state')).toBeVisible();
  await expect(page.getByTestId('access-warning')).toHaveCount(0);
  expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
});

test('release details disclose access without opening audio or requesting a payment', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(fixture);
  const trigger = page.getByRole('button', { name: 'About E2E Protected Room Track', exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'About this release', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('plus network fees');
  await expect(dialog).toContainText('does not transfer copyright');
  await expect(dialog.locator('details')).not.toHaveAttribute('open', '');
  await page.screenshot({ path: testInfo.outputPath('release-details.png'), animations: 'disabled' });
  await dialog.locator('summary').click();
  await expect(dialog).toContainText('Content hash');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.player-stage')).toHaveCount(0);
  await expect(page.getByTestId('access-warning')).toHaveCount(0);
  expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('release details remain bound to the track that opened them', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence&e2eAutoplay=on');
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await page.getByRole('button', { name: 'About this release', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'About this release', exact: true });
  await expect(dialog.getByRole('heading', { name: 'E2E Public Room Track', exact: true })).toBeVisible();

  await page.evaluate(() => document.querySelector<HTMLButtonElement>('button[aria-label="Next track"]')?.click());

  await expect(page.locator('.track-copy h2')).toHaveText('Second room track');
  await expect(dialog.getByRole('heading', { name: 'E2E Public Room Track', exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('Second room track');
});

test('browser Back dismisses contextual sheets without leaving or stopping the player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  for (const name of ['About this release', 'Queue', 'Tip this track']) {
    const trigger = page.getByRole('button', { name, exact: true });
    await trigger.focus();
    await trigger.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('.transport-play')).toHaveAttribute('aria-label', 'Pause');
    await expect(page.locator('.track-copy h2')).toHaveText('E2E Public Room Track');
  }
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await page.getByRole('button', { name: 'Close queue', exact: true }).click();
  await expect.poll(() => page.evaluate(() => history.state.dotifySheet)).toBeUndefined();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Music catalog' })).toBeVisible();
});

test('replacing room sharing with the projected QR adds only one Back step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await page.getByRole('button', { name: 'Open room', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Sheet test host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const code = page.getByTestId('room-code');
  await expect(code).toHaveText(/[A-Z0-9]{4,}/);
  const original = await code.textContent();
  await page.getByRole('button', { name: 'Share room', exact: true }).click();
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Show QR', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Scan to join' })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(code).toHaveText(original!);
  await expect(page.locator('.transport-play')).toHaveAttribute('aria-label', 'Pause');
});

test('room sharing stays closed when a room is replaced', async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await page.getByRole('button', { name: 'Open room', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Share state host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/);
  const firstRoom = await roomCode.textContent();
  await page.getByRole('button', { name: 'Share room', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Listen together' })).toBeVisible();

  await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent?.trim() === 'Close room')
      ?.click()
  );
  await expect(page.getByRole('dialog', { name: 'Listen together' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open room', exact: true }).click();
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/);
  await expect(roomCode).not.toHaveText(firstRoom!);
  await expect(page.getByRole('dialog', { name: 'Listen together' })).toHaveCount(0);
});

test('recent listening requires playback, remains session-local and can be cleared', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence');
  await expect(page.getByRole('region', { name: 'Recent listening', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Open E2E Public Room Track by/ }).click();
  await expect(page.locator('.transport-play')).toHaveAttribute('aria-label', 'Play');
  await nav(page, 'Music');
  await expect(page.getByRole('region', { name: 'Recent listening', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await expect(page.locator('.transport-play')).toHaveAttribute('aria-label', 'Pause');
  await nav(page, 'Music');
  const recent = page.getByRole('region', { name: 'Recent listening', exact: true });
  await expect(recent.getByRole('button', { name: /^Replay E2E Public Room Track/ })).toBeVisible();
  await expect(recent.getByRole('button', { name: /^Replay E2E Public Room Track/ }).locator('.lucide-play')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Clear recent listening' }).locator('.lucide-trash-2')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear recent listening' }).click();
  await expect(recent).toHaveCount(0);
  await page.reload();
  await expect(recent).toHaveCount(0);
});

test('active cover provides the tint without changing interface text colors', async ({ page }) => {
  await page.goto(fixture);
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink'));
  await page.getByRole('button', { name: /^Open E2E Public Room Track by/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-aura-source', 'cover');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink'))).toBe(ink);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.aura-bg')).toHaveCSS('animation-name', 'none');
});
