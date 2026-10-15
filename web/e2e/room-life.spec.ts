import { expect, test, type Page } from '@playwright/test';
import { io } from 'socket.io-client';

async function hostRoom(page: Page) {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name in the room').fill('Room host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  return (await page.getByTestId('room-code').innerText()).trim();
}

test('chat survives busy Product-style fetch polling alongside typing and playback', async ({ page, browser }) => {
  const roomId = await hostRoom(page);
  const context = await browser.newContext();
  const guest = await context.newPage();
  try {
    // Keep the same fetch polling transport used by Product, without pretending
    // this browser supplies the independent native Host media capability.
    await guest.routeWebSocket('**/socket.io/**', socket => socket.close());
    // Hold polling POSTs long enough to make the transport busy during sends.
    await guest.route('**/socket.io/**', async route => {
      if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 250));
      await route.continue();
    });
    await guest.goto(`/#/rooms/${roomId}`);
    await guest.getByLabel('Your name in the room').fill('Polling guest');
    await guest.getByRole('button', { name: 'Join and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    for (let index = 0; index < 3; index++) {
      const text = `Polling message ${index}`;
      // Filling sends a typing POST; the chat must wait for that write to drain.
      await guest.getByLabel('Message the room').fill(text);
      await guest.getByRole('button', { name: 'Send message' }).click();
      await expect(page.getByRole('log')).toContainText(text);
      await expect(guest.getByLabel('Message the room')).toHaveValue('');
      await expect(page.locator('.room-chat-row').filter({ hasText: text })).toHaveCount(1);
    }
  } finally {
    await context.close();
  }
});

test('typing, mentions, replies, pins and muted activity coexist with room playback', async ({ page, browser }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const roomId = await hostRoom(page);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await context.newPage();
  try {
    await guest.goto(`/#/rooms/${roomId}`);
    await guest.getByLabel('Your name in the room').fill('Mina');
    await guest.getByRole('button', { name: 'Join and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    await guest.getByLabel('Message the room').fill('Writing a thought');
    await expect(page.locator('.room-chat-typing')).toContainText('Mina is typing');
    await expect(page.getByRole('log')).not.toContainText('Writing a thought');
    await expect(page.getByRole('log')).toContainText('Mina joined.');
    await page.getByRole('button', { name: 'Room activity', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Room activity', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('log')).not.toContainText('Mina joined.');
    await page.getByRole('button', { name: 'Room activity', exact: true }).click();
    await page.getByRole('tab', { name: /Queue/ }).click();
    await guest.getByLabel('Message the room').fill('@Room');
    await guest.getByRole('button', { name: '@Room host', exact: true }).click();
    await guest.getByLabel('Message the room').press('End');
    await guest.getByLabel('Message the room').pressSequentially('hello!');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#room-tab-chat').getByLabel('1 unread mentions')).toHaveText('@1');
    await page.locator('#room-tab-chat').click();
    await page.getByRole('button', { name: 'Message actions for Mina' }).click();
    await page.getByRole('button', { name: 'Reply to Mina' }).click();
    await page.getByLabel('Message the room').fill('Welcome to this listening moment');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(guest.locator('.room-chat-quote')).toContainText('@Room host hello!');
    await page.getByRole('button', { name: 'Message actions for Room host' }).click();
    await page.getByRole('button', { name: 'Pin message from Room host' }).click();
    await expect(guest.locator('.room-chat-pinned')).toContainText('Welcome to this listening moment');
    await guest.getByRole('button', { name: 'Message actions for Room host' }).click();
    await expect(guest.getByRole('button', { name: 'Reply to Room host' })).toBeVisible();
    await expect(guest.getByRole('button', { name: /Pin message/ })).toHaveCount(0);
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync');
    await page.screenshot({ path: testInfo.outputPath('room-life-mobile.png') });
    await page.getByRole('button', { name: 'Unpin message' }).click();
    await expect(guest.locator('.room-chat-pinned')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('artist can use a private invitation and choose whether to announce their visit', async ({ page }, testInfo) => {
  const runtime = '0x000000000000000000000000000000000000a712';
  const artist = '0x000000000000000000000000000000000000a711';
  const hash = `0x${'77'.repeat(32)}`;
  const track = {
    id: `${runtime}:${hash}`,
    hash,
    artistAddress: artist,
    title: 'A shared moment',
    artist: 'Ada',
    active: true,
    source: 'artist',
    zone: 'E2E',
    audioRef: 'ipfs://fixture',
    imageRef: '',
    priceDot: '0',
    description: '',
    bulletinRef: '',
    metadataRef: '',
    royaltyBps: 10000,
    durationLabel: '3:00',
    accessMode: 'free',
    royaltySplits: [],
    personhoodLevel: 'DIM1',
    encrypted: false
  };
  await page.addInitScript(
    ({ track, artist }) => {
      localStorage.setItem('dotify:e2e:artist-publish', JSON.stringify({ runtimeCreated: true, tracks: [track] }));
      localStorage.setItem(`dotify:artist-name:${artist}`, 'Ada');
    },
    { track, artist }
  );
  const host = io('http://127.0.0.1:8789', { transports: ['websocket'] });
  try {
    await new Promise<void>(resolve => host.once('connect', resolve));
    const room = await new Promise<{ roomId: string }>(resolve =>
      host.emit('room:create', { displayName: 'Mina', track: { title: 'A shared moment', artist: 'Ada', hash, runtimeAddress: runtime } }, resolve)
    );
    host.emit('player:state', { playing: true, currentTime: 10, duration: 180, updatedAt: Date.now() });
    await page.goto('/artists?e2eArtist=happy');
    const panel = page.getByRole('region', { name: 'Your music, live' });
    // Private rooms are not an artist/global directory. An explicit invitation
    // keeps the artist visit and announcement flow available without leaking it.
    await expect(panel).not.toContainText('A shared moment');
    await panel.getByLabel('Have a room invitation?').fill(`https://dotify.example/#/rooms/${room.roomId}`);
    await panel.screenshot({ path: testInfo.outputPath('artist-live-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole('button', { name: 'Join', exact: true }).click();
    const visit = page.getByRole('dialog', { name: 'Drop into the room' });
    await expect(visit).toContainText(room.roomId);
    const announce = page.getByRole('checkbox', { name: /Announce my presence/ });
    await expect(announce).not.toBeChecked();
    await page.getByLabel('Your room name', { exact: true }).fill('Ada quietly');
    await page.route('**/api/auth/session', route =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Artist sign-in is temporarily unavailable.', code: 'SESSION_NOT_CONFIGURED' })
      })
    );
    await announce.check();
    await visit.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(visit.getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
    await announce.uncheck();
    await page.screenshot({ path: testInfo.outputPath('artist-visit-mobile.png') });
    await visit.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/artists/);
    await expect(page.getByRole('region', { name: 'Your music, live' })).toBeVisible();
  } finally {
    host.disconnect();
  }
});

test('message actions are quiet on desktop and reachable by keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await hostRoom(page);
  await page.getByLabel('Message the room').fill('A moment worth sharing');
  await page.getByRole('button', { name: 'Send message' }).click();
  const message = page.locator('.room-chat-interactive').filter({ hasText: 'A moment worth sharing' });
  const trigger = message.getByRole('button', { name: 'Message actions for Room host' });
  await expect(trigger).toHaveCSS('opacity', '0');
  await expect(message.getByRole('button', { name: 'Reply to Room host' })).toHaveCount(0);
  await message.hover();
  await expect(trigger).toHaveCSS('opacity', '1');
  await page.mouse.move(1, 1);
  await trigger.focus();
  await expect(trigger).toHaveCSS('opacity', '1');
  await trigger.press('Enter');
  await trigger.press('Tab');
  await expect(message.getByRole('button', { name: 'Reply to Room host' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.press('Enter');
  await trigger.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Message the room')).toBeFocused();
  await expect(page.locator('.room-chat-reply-draft')).toContainText('Room host');
  await page.getByRole('button', { name: 'Cancel reply' }).click();
  await trigger.click();
  await page.getByRole('button', { name: 'Room activity', exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const people = (await page.getByLabel('People and room controls').boundingBox())!;
  const tipExplanation = (await page.locator('.host-contributions p').first().boundingBox())!;
  expect(tipExplanation.x + tipExplanation.width).toBeLessThanOrEqual(people.x + people.width);
  await page.screenshot({ path: testInfo.outputPath('quiet-chat-desktop.png') });
});

test('newest message actions remain inside a full chat viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hostRoom(page);
  for (let index = 1; index <= 5; index++) {
    await page.getByLabel('Message the room').fill(`Conversation line ${index}`);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByLabel('Message the room')).toHaveValue('');
  }
  const log = page.getByRole('log');
  await log.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  const message = page.locator('.room-chat-interactive').filter({ hasText: 'Conversation line 5' });
  await message.getByRole('button', { name: 'Message actions for Room host' }).click();
  const actions = message.locator('.room-chat-message-actions');
  await expect(actions).toBeInViewport();
  const [logBox, actionsBox] = await Promise.all([log.boundingBox(), actions.boundingBox()]);
  expect(logBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(logBox!.y + logBox!.height + 1);
});

test('touch swipe replies once while short, vertical and cancelled gestures preserve the draft', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await hostRoom(page);
    await page.getByLabel('Message the room').fill('Same track, your people');
    await page.getByRole('button', { name: 'Send message' }).click();
    const message = page.locator('.room-chat-interactive').filter({ hasText: 'Same track, your people' });
    const trigger = message.getByRole('button', { name: 'Message actions for Room host' });
    await expect(trigger).toHaveCSS('opacity', '1');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.getByLabel('Message the room').fill('My unfinished thought');
    await page.getByLabel('Message the room').blur();
    const client = await context.newCDPSession(page);
    async function swipe(dx: number, dy: number, cancel = false) {
      const box = (await message.locator('.room-chat-text').boundingBox())!;
      const x = box.x + 35;
      const y = box.y + box.height / 2;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
      for (let step = 1; step <= 5; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 5, y: y + (dy * step) / 5, id: 0 }] });
      }
      await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    }
    for (const [dx, dy, cancel] of [
      [25, 0, false],
      [5, -50, false],
      [75, 0, true]
    ] as const) {
      await swipe(dx, dy, cancel);
      await expect(page.locator('.room-chat-reply-draft')).toHaveCount(0);
      await expect(page.getByLabel('Message the room')).toHaveValue('My unfinished thought');
    }
    await swipe(75, 2);
    await expect(page.locator('.room-chat-reply-draft')).toContainText('Room host');
    await expect(page.getByLabel('Message the room')).toBeFocused();
    await expect(page.getByLabel('Message the room')).toHaveValue('My unfinished thought');
    await expect(page.getByRole('log')).not.toContainText('My unfinished thought');
    await page.getByRole('button', { name: 'Cancel reply' }).click();
    await trigger.tap();
    await expect(message.getByRole('button', { name: 'Pin message from Room host' })).toBeVisible();
    const actions = (await message.locator('.room-chat-message-actions').boundingBox())!;
    expect(actions.x).toBeGreaterThanOrEqual(0);
    expect(actions.x + actions.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath('quiet-chat-mobile-actions.png') });
    await message.getByRole('button', { name: 'Reply to Room host' }).tap();
    await expect(page.getByLabel('Message the room')).toBeFocused();
    await expect(page.locator('.room-chat-reply-draft')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
