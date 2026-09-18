import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test.describe(`clear interface ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 1000 }, hasTouch: width === 390 });

    test('artwork is a real action and can resume the same source', async ({ page }, testInfo) => {
      await page.goto('/?e2eRoom=public&e2eCatalog=wide&e2eAutoplay=on');
      const action = page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ });
      await action.scrollIntoViewIfNeeded();
      await action.focus();
      const artwork = await action.boundingBox();
      const icon = await action.locator('.track-artwork-action').boundingBox();
      expect(icon!.width).toBeGreaterThanOrEqual(44);
      expect(Math.abs(icon!.x + icon!.width / 2 - artwork!.x - artwork!.width / 2)).toBeLessThan(1);
      expect(Math.abs(icon!.y + icon!.height / 2 - artwork!.y - artwork!.height / 2)).toBeLessThan(1);
      await expect(action.locator('.track-artwork-action')).toHaveCSS('opacity', '1');
      await expect(page.locator('.catalogue-card-action')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`music-${width}.png`), fullPage: false });
      await action.click();
      const audio = page.locator('audio.native-player-source').first();
      await expect(audio).toHaveJSProperty('paused', false);
      await page.evaluate(() => Reflect.set(window, '__artworkAudio', document.querySelector('audio')));
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(audio).toHaveJSProperty('paused', true);
      await page.getByRole('button', { name: 'Music', exact: true }).click();
      await expect(action).toBeFocused();
      await action.click();
      await expect(audio).toHaveJSProperty('paused', false);
      expect(await page.evaluate(() => Reflect.get(window, '__artworkAudio') === document.querySelector('audio'))).toBe(true);
      await page.getByRole('button', { name: 'Music', exact: true }).click();
      // A locked release becomes the selected player state without interrupting
      // discovery. Its support terms remain available through an explicit CTA.
      const locked = page.getByRole('button', { name: /^View listening options for E2E Protected Room Track by Dotify Room Host,/ });
      await locked.click();
      await expect(page.getByTestId('access-warning')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Support and open', exact: true })).toBeVisible();
    });

    test('shows Play only on the active cover and keeps cards focused on the music', async ({ page }, testInfo) => {
      await page.goto('/?e2eRoom=public&e2eCatalog=wide');
      const actions = page.getByTestId('track-artwork-action');
      const row = page.getByRole('region', { name: 'Music catalog', exact: true });
      await expect(actions.first()).toBeVisible();
      await expect(row.locator('.lucide-arrow-right')).toHaveCount(0);
      await expect(row.locator('.catalogue-access-line')).toHaveCount(0);
      await expect(row.locator('.catalogue-access-cue')).toHaveCount(0);
      await expect(row.getByText('0.5 PAS', { exact: true })).toHaveCount(0);
      await expect(row.getByText('Verified humans', { exact: true })).toHaveCount(0);
      await expect(actions.locator('.lucide-play')).toHaveCount(await actions.count());
      await expect
        .poll(() => actions.locator('.track-artwork-action').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '0')))
        .toBe(true);
      if (width === 1440) {
        await actions.first().hover();
        await expect(actions.first().locator('.track-artwork-action')).toHaveCSS('opacity', '1');
        await expect(actions.nth(1).locator('.track-artwork-action')).toHaveCSS('opacity', '0');
        await actions.nth(1).hover();
        await expect(actions.first().locator('.track-artwork-action')).toHaveCSS('opacity', '0');
        await expect(actions.nth(1).locator('.track-artwork-action')).toHaveCSS('opacity', '1');
        await page.mouse.move(0, 0);
      }
      await row.evaluate(element => (element.scrollLeft = element.scrollWidth));
      await expect.poll(() => row.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      await expect
        .poll(() => actions.locator('.track-artwork-action').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '0')))
        .toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`catalog-scroll-${width}.png`), animations: 'disabled' });
      // Selecting a locked release stays calm; disclosure starts from the
      // explicit player CTA rather than opening over the catalog.
      await page.getByLabel('Find a track or artist').fill('E2E Protected Room Track');
      const protectedCard = page.getByTestId('track-card').filter({ hasText: 'E2E Protected Room Track' });
      await expect(protectedCard).not.toContainText('0.5 PAS');
      await protectedCard.getByTestId('track-artwork-action').click();
      await expect(page.getByTestId('access-warning')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Support and open', exact: true })).toBeVisible();
    });

    test('artist and personal screens lead with useful content', async ({ page }, testInfo) => {
      await page.goto('/?e2eRoom=public&e2eCatalog=wide');
      await page.locator('.catalogue-card .artist-text-button').first().click();
      await expect(page.getByRole('heading', { name: 'Releases', exact: true })).toBeVisible();
      await expect(page.getByLabel('Verified artist')).toHaveCount(0);
      await expect(page.getByText('Why it matters', { exact: true })).toHaveCount(0);
      await expect(page.locator('.artist-release-card .catalogue-access-cue')).toHaveCount(0);
      const release = await page.locator('.artist-release-card').first().boundingBox();
      await expect(page.locator('.player-dock')).toHaveCount(0);
      expect(release!.y).toBeLessThan(page.viewportSize()!.height);
      await expect(page.getByRole('button', { name: 'Listen to latest release', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`artist-${width}.png`), fullPage: false });
      await page.getByRole('button', { name: 'You', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Connect a wallet', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Your collection' })).toBeVisible();
      await expect(page.locator('.account-summary,.account-detail-grid,.wallet-pass-panel')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`you-${width}.png`), fullPage: false });
      await page.getByRole('button', { name: 'Connect a wallet', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
}

test('room presence stays quiet when online and remains honest offline', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Quiet room host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  const code = (await page.getByTestId('room-code').innerText()).trim();
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  await page.locator('.room-live-card').filter({ hasText: code }).click();
  const panel = page.getByTestId('room-detail-panel');
  await expect(panel.locator('.live-dot')).toHaveCSS('background-color', 'rgb(63, 224, 171)');
  await expect(panel.locator('.room-detail-state')).toHaveCount(0);
  await expect(page.getByText('Room signal online', { exact: true })).toHaveCount(0);
  await expect(page.locator('.room-doctrine')).toHaveCount(0);
  const announcement = page.locator('#sky-of-rooms .sr-only, [data-testid="sky-of-rooms"] .sr-only');
  await expect(announcement).toHaveCount(1);
  expect((await announcement.boundingBox())!.width).toBeLessThanOrEqual(1);
  await page.locator('.rooms-live-section').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('rooms-online.png'), fullPage: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await panel.locator('.live-dot').evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
  await page.context().setOffline(true);
  await expect(page.locator('.room-list-status')).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('.live-dot')).toHaveAttribute('data-online', 'false');
  await expect(panel.getByRole('status')).toBeVisible();
});

test('clear interface supports doubled text on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eCatalog=wide');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  for (const surface of ['Music', 'Rooms', 'You', 'Artist']) {
    if (surface === 'Artist') {
      await page.getByRole('button', { name: 'Music', exact: true }).click();
      await page.locator('.catalogue-card .artist-text-button').first().click();
    } else if (surface !== 'Music') await page.getByRole('button', { name: surface, exact: true }).click();
    await expect(page.getByRole('main')).toBeVisible();
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      wide: Array.from(document.querySelectorAll<HTMLElement>('main,section,header,nav,button,input,div'))
        .filter(element => {
          const box = element.getBoundingClientRect();
          return box.width > innerWidth && !element.closest('.catalogue-grid');
        })
        .slice(0, 16)
        .map(element => [element.className, element.getBoundingClientRect().width])
    }));
    expect(geometry.width, `${surface}: ${JSON.stringify(geometry.wide)}`).toBeLessThanOrEqual(geometry.viewport);
  }
  await page.screenshot({ path: testInfo.outputPath('artist-large-text.png') });
});

test('clear interface restores individual playback after leaving a room', async ({ page, browser }) => {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Interface host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  const code = (await page.getByTestId('room-code').innerText()).trim();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(`/?e2eRoom=public&e2eAutoplay=on#/rooms/${code}`);
    await expect(guest.locator('#join-room-title')).toContainText('welcomes you');
    await guest.getByLabel('Your name in the room').fill('Returning listener');
    await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    await guest.getByRole('button', { name: 'Music', exact: true }).click();
    const cover = guest.getByTestId('track-artwork-action').filter({ has: guest.locator('img') });
    await expect(guest.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ })).toHaveCount(0);
    await expect(cover.first()).toBeVisible();
    await guest.getByRole('button', { name: /^View listening options for E2E Public Room Track by Dotify Room Host,/ }).click();
    await expect(guest.getByRole('dialog')).toContainText('Release details');
    await guest.getByRole('button', { name: 'Stay in room', exact: true }).click();
    await guest.locator('.player-dock-art').click();
    await guest.getByRole('tab', { name: /People/ }).click();
    await guest.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(guest.locator('audio.native-player-source').last()).toHaveJSProperty('srcObject', null);
    await expect(guest.locator('audio.native-player-source').first()).toHaveJSProperty('paused', true);
    await guest.getByRole('button', { name: 'Music', exact: true }).click();
    await guest.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
    await expect(guest.locator('audio.native-player-source').first()).toHaveJSProperty('paused', false);
    await expect(guest.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expect(guest.getByRole('slider', { name: /Seek/ })).toBeEnabled();
    await expect(page.getByTestId('room-code')).toHaveText(code);
  } finally {
    await guestContext.close();
  }
});

test('clear interface lets guests inspect releases without changing their listening source', async ({ page, browser }, testInfo) => {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Interface host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  const code = (await page.getByTestId('room-code').innerText()).trim();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const guest = await guestContext.newPage();
    await guest.goto(`/?e2eRoom=public#/rooms/${code}`);
    await expect(guest.locator('#join-room-title')).toContainText('welcomes you');
    await guest.getByLabel('Your name in the room').fill('Curious listener');
    await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    await guest.getByRole('button', { name: 'Music', exact: true }).click();
    const originalSource = await guest.locator('audio.native-player-source').first().getAttribute('src');
    const selectedTitle = await guest.locator('.catalogue-card[data-selected="true"] .catalogue-card-open').innerText();
    const keyRequests = await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests);
    const protectedAction = guest.getByRole('button', { name: /^View listening options for E2E Protected Room Track by Dotify Room Host,/ });
    // Keyboard focus returns to the trigger; Safari pointer clicks do not focus buttons.
    await protectedAction.focus();
    await protectedAction.press('Enter');
    const dialog = guest.getByRole('dialog', { name: 'E2E Protected Room Track', exact: true });
    await expect(dialog).toContainText('Leave the room');
    await expect(dialog).toContainText('0.5 PAS');
    await expect(guest.getByTestId('access-warning')).toHaveCount(0);
    expect(await guest.locator('audio.native-player-source').first().getAttribute('src')).toBe(originalSource);
    expect(await guest.locator('.catalogue-card[data-selected="true"] .catalogue-card-open').innerText()).toBe(selectedTitle);
    expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests)).toBe(keyRequests);
    await guest.screenshot({ path: testInfo.outputPath('guest-release-details.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Stay in room', exact: true }).click();
    await expect(protectedAction).toBeFocused();
    // Artist release actions must use the same read-only inspection path.
    await guest
      .getByTestId('track-card')
      .filter({ hasText: 'E2E Protected Room Track' })
      .getByRole('button', { name: 'Dotify Room Host', exact: true })
      .click();
    await protectedAction.click();
    await expect(dialog).toBeVisible();
    expect(await guest.locator('audio.native-player-source').first().getAttribute('src')).toBe(originalSource);
    await dialog.getByRole('button', { name: 'Leave and open release', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(guest.getByTestId('room-code')).toHaveCount(0);
    await expect(guest.getByTestId('access-warning')).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Support and open', exact: true })).toBeVisible();
    await expect(guest.locator('audio.native-player-source').first()).toHaveJSProperty('paused', true);
    await expect(page.getByTestId('room-code')).toHaveText(code);
  } finally {
    await guestContext.close();
  }
});
