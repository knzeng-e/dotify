import { expect, test, type Page } from '@playwright/test';

async function hostRoom(page: Page) {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  return (await page.getByTestId('room-code').innerText()).trim();
}

async function expectConversationFits(page: Page) {
  const bounds = await page.evaluate(() => {
    const player = document.querySelector('.player-stage')!.getBoundingClientRect();
    const composer = document.querySelector('#room-panel-chat .room-chat-form')!.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect();
    const conversation = document.querySelector('#room-panel-chat .room-chat-list')!.getBoundingClientRect();
    return {
      conversationHeight: conversation.height,
      playerTop: player.top,
      playerBottom: player.bottom,
      composerTop: composer.top,
      composerBottom: composer.bottom,
      bottom: nav.height ? nav.top : innerHeight,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  expect(bounds.conversationHeight).toBeGreaterThanOrEqual(80);
  expect(bounds.playerTop).toBeGreaterThanOrEqual(0);
  expect(bounds.composerTop).toBeGreaterThanOrEqual(bounds.playerBottom - 1);
  expect(bounds.composerBottom).toBeLessThanOrEqual(bounds.bottom + 1);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024]
]) {
  test(`room conversation fits ${width}×${height} without losing playback or drafts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await hostRoom(page);
    await expectConversationFits(page);
    const draft = page.getByRole('textbox', { name: 'Message the room' });
    await draft.fill('Keep this thought');
    await page.getByRole('tab', { name: /Requests/ }).click();
    await page.getByRole('textbox', { name: 'Request a track' }).fill('Something soulful');
    await page.getByRole('tab', { name: /People/ }).click();
    await expect(page.getByRole('button', { name: 'Close room', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
    await expect(draft).toHaveValue('Keep this thought');
    await expectConversationFits(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Keep this thought');
    await expect(draft).toHaveValue('');
    await page.screenshot({ path: testInfo.outputPath('room-conversation.png') });
    await page.getByRole('tab', { name: /Requests/ }).click();
    await expect(page.getByRole('textbox', { name: 'Request a track' })).toHaveValue('Something soulful');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByLabel('Track requests', { exact: true })).toContainText('Something soulful');
    await expect(page.getByRole('textbox', { name: 'Request a track' })).toHaveValue('');
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
    await page.getByRole('tab', { name: 'Chat', exact: true }).press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Requests/ })).toBeFocused();
  });
}

test('mobile guest chats with a host while the same remote audio stays mounted', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const roomId = await hostRoom(host);
    const guest = await guestContext.newPage();
    await guest.goto(`/#/rooms/${roomId}`);
    await guest.getByRole('textbox', { name: 'Your name in the room' }).fill('Mina');
    await guest.getByRole('button', { name: 'Enter and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    await guest.evaluate(() => {
      (window as unknown as { roomAudio: Element }).roomAudio = document.querySelectorAll('audio.native-player-source')[1];
    });
    await guest.getByRole('textbox', { name: 'Message the room' }).fill('Here with you');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByRole('log')).toContainText('Here with you');
    await guest.getByRole('tab', { name: /People/ }).click();
    await expect(guest.locator('.listener-list')).toContainText('Mina');
    await guest.getByRole('tab', { name: 'Chat', exact: true }).click();
    expect(
      await guest.evaluate(() => (window as unknown as { roomAudio: Element }).roomAudio === document.querySelectorAll('audio.native-player-source')[1])
    ).toBe(true);
    await expectConversationFits(guest);
    await guest.getByRole('textbox', { name: 'Message the room' }).fill('A thought during reconnect');
    await guestContext.setOffline(true);
    await expect(guest.getByRole('button', { name: 'Send message' })).toBeDisabled({ timeout: 15000 });
    await expect(guest.getByRole('textbox', { name: 'Message the room' })).toHaveValue('A thought during reconnect');
    await guestContext.setOffline(false);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('shared queue retains a protected selection through the existing access gate', async ({ page }) => {
  await hostRoom(page);
  await page.getByRole('tab', { name: /Requests/ }).click();
  await page.getByLabel('Track for room queue').selectOption({ label: 'E2E Protected Room Track — Dotify Room Host' });
  await page.locator('.host-lineup').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.host-lineup')).toContainText('Planned next');
  await page.getByRole('button', { name: 'Open next track' }).click();
  await expect(page.getByTestId('locked-player-state')).toBeVisible();
  await expect(page.locator('.host-lineup')).toContainText('Planned next');
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
});

test('compact keyboard viewport leaves space to compose and restores after resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hostRoom(page);
  await page.getByRole('textbox', { name: 'Message the room' }).fill('Still listening');
  // Simulate the visual viewport resize event, not a real iOS keyboard.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 430 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'true');
  const composerBottom = await page.getByRole('textbox', { name: 'Message the room' }).evaluate(element => element.getBoundingClientRect().bottom);
  expect(composerBottom).toBeLessThanOrEqual(430);
  await expect(page.locator('.player-stage')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toHaveValue('Still listening');
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'false');
  await expectConversationFits(page);
});

test('desktop keeps playback, people and chat visible and returns from artist support', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await hostRoom(page);
  await page.getByRole('textbox', { name: 'Message the room' }).fill('A place to listen together');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('A place to listen together');
  await expect(page.getByLabel('People and room controls')).toBeVisible();
  await expectConversationFits(page);
  await page.screenshot({ path: testInfo.outputPath('room-conversation.png') });
  await page.getByRole('button', { name: 'Artist & support', exact: true }).click();
  await expect(page.locator('.player-dock')).toBeVisible();
  await page.getByRole('button', { name: 'Room live', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
});

test('room controls fit a small desktop and the QR remains discoverable', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await hostRoom(page);
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
  await page.locator('.room-share-details summary').click();
  await page.getByRole('button', { name: 'Show big QR' }).click();
  await expect(page.getByRole('dialog')).toContainText('Scan to join');
  await page.getByRole('button', { name: 'Close projected QR' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared queue reaches a late guest and host accepts a request without giving guests controls', async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const roomId = await hostRoom(host);
    await host.getByRole('tab', { name: /Requests/ }).click();
    await host.getByLabel('Track for room queue').selectOption({ label: 'E2E Protected Room Track — Dotify Room Host' });
    await host.locator('.host-lineup').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(host.getByLabel('Room queue', { exact: true })).toContainText('E2E Protected Room Track');
    const guest = await guestContext.newPage();
    await guest.goto(`/#/rooms/${roomId}`);
    await guest.getByRole('textbox', { name: 'Your name in the room' }).fill('Mina');
    await guest.getByRole('button', { name: 'Enter and listen' }).click();
    await guest.getByRole('tab', { name: /Requests/ }).click();
    await expect(guest.getByLabel('Room queue', { exact: true })).toContainText('E2E Protected Room Track');
    await expect(guest.getByLabel('Track for room queue')).toHaveCount(0);
    await guest.getByRole('textbox', { name: 'Request a track' }).fill('A public moment');
    await guest.getByRole('button', { name: 'Send request' }).click();
    await expect(host.getByLabel('For a request (optional)')).toContainText('A public moment');
    await host.getByLabel('Track for room queue').selectOption({ label: 'E2E Public Room Track — Dotify Room Host' });
    await host.getByLabel('For a request (optional)').selectOption({ label: 'Mina: A public moment' });
    await host.locator('.host-lineup').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(guest.getByLabel('Room queue', { exact: true })).toContainText('E2E Public Room Track');
    await expect(guest.locator('.room-req-row')).toHaveCount(0);
    await host.getByRole('button', { name: 'Move E2E Public Room Track earlier' }).click();
    await expect(guest.getByLabel('Room queue', { exact: true }).locator('li').first()).toContainText('E2E Public Room Track');
    const composer = await guest.getByRole('textbox', { name: 'Request a track' }).boundingBox();
    expect(composer!.y + composer!.height).toBeLessThan(844);
    await guest.screenshot({ path: testInfo.outputPath('shared-queue-mobile.png') });
    await host.screenshot({ path: testInfo.outputPath('shared-queue-desktop.png') });
    await guestContext.setOffline(true);
    await expect(guest.getByRole('button', { name: 'Send request' })).toBeDisabled();
    await guestContext.setOffline(false);
    await expect(guest.locator('.host-lineup')).not.toContainText('Reconnecting', { timeout: 20000 });
    await expect(guest.getByLabel('Room queue', { exact: true }).locator('li').first()).toContainText('E2E Public Room Track');
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('manual-area preview requires separate consent, forgets search and revokes publication', async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const frames: string[] = [];
    for (const page of [host, guest]) {
      page.on('websocket', socket =>
        socket.on('framesent', frame => {
          const text = String(frame.payload);
          if (text.includes('nearby:')) frames.push(text);
        })
      );
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          get() {
            throw new Error('Nearby preview must never access geolocation');
          }
        });
      });
    }
    await hostRoom(host);
    await guest.goto('/');
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    expect(frames).toHaveLength(0);
    await guest.locator('.nearby-discovery summary').click();
    await guest.getByRole('button', { name: 'Choose an area to search' }).click();
    await guest.getByLabel('Pilot area').selectOption('lisbon-region');
    await guest.getByRole('button', { name: 'Search this area' }).click();
    await expect(guest.getByLabel('Rooms sharing this area')).toContainText('No hosts are sharing');
    await host.locator('.nearby-preview summary').click();
    await host.getByRole('button', { name: 'Choose an area to share' }).click();
    await host.getByLabel('Pilot area').selectOption('lisbon-region');
    await host.getByRole('button', { name: 'Share this room for 90 seconds', exact: true }).click();
    await expect(host.locator('.nearby-preview')).toContainText('Visible in Lisbon region');
    await guest.getByRole('button', { name: 'Search this area' }).click();
    await expect(guest.getByLabel('Rooms sharing this area')).toContainText('E2E Public Room Track');
    await expect(guest.getByLabel('Rooms sharing this area')).toBeFocused();
    const resultButton = guest.getByLabel('Rooms sharing this area').getByRole('button');
    const resultBounds = await resultButton.boundingBox();
    expect(resultBounds!.y + resultBounds!.height).toBeLessThan(844 - 150);
    await guest.screenshot({ path: testInfo.outputPath('nearby-mobile.png') });
    await host.screenshot({ path: testInfo.outputPath('nearby-host-desktop.png') });
    await host.getByRole('button', { name: 'Stop sharing this area' }).click();
    await expect(host.locator('.nearby-preview')).toContainText('Area sharing is off');
    await guest.getByRole('button', { name: 'Search this area' }).click();
    await expect(guest.getByLabel('Rooms sharing this area')).toContainText('No hosts are sharing');
    await guest.getByRole('button', { name: 'Stop area search' }).click();
    await expect(guest.getByLabel('Rooms sharing this area')).toHaveCount(0);
    await expect(guest.getByLabel('Pilot area')).toHaveValue('');
    await host.getByRole('button', { name: 'Share this room for 90 seconds', exact: true }).click();
    await expect(host.locator('.nearby-preview')).toContainText('Visible in Lisbon region');
    await host.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(host.getByRole('button', { name: 'Stop sharing this area' })).toHaveCount(0);
    await guest.getByLabel('Pilot area').selectOption('lisbon-region');
    await guest.getByRole('button', { name: 'Search this area' }).click();
    await expect(guest.getByLabel('Rooms sharing this area')).toContainText('No hosts are sharing');
    for (const frame of frames.filter(value => /nearby:(search|publish)/.test(value))) {
      const data = JSON.parse(frame.slice(frame.indexOf('['))) as [string, Record<string, unknown>];
      expect(data[1]).toEqual({ areaId: 'lisbon-region', consent: true });
    }
    const stored = await guest.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain('lisbon-region');
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});
