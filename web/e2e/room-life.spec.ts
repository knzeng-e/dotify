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
    await page.getByRole('button', { name: 'Hide room activity' }).click();
    await expect(page.getByRole('log')).not.toContainText('Mina joined.');
    await page.getByRole('button', { name: 'Show room activity' }).click();
    await page.getByRole('tab', { name: /Queue/ }).click();
    await guest.getByLabel('Message the room').fill('@Room');
    await guest.getByRole('button', { name: '@Room host', exact: true }).click();
    await guest.getByLabel('Message the room').press('End');
    await guest.getByLabel('Message the room').pressSequentially('hello!');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#room-tab-chat').getByLabel('1 unread mentions')).toHaveText('@1');
    await page.locator('#room-tab-chat').click();
    await page.getByRole('button', { name: 'Reply to Mina' }).click();
    await page.getByLabel('Message the room').fill('Welcome to this listening moment');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(guest.locator('.room-chat-quote')).toContainText('@Room host hello!');
    await page.getByRole('button', { name: 'Pin message from Room host' }).click();
    await expect(guest.locator('.room-chat-pinned')).toContainText('Welcome to this listening moment');
    await expect(guest.getByRole('button', { name: /Pin message/ })).toHaveCount(0);
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync');
    await page.screenshot({ path: testInfo.outputPath('room-life-mobile.png') });
    await page.getByRole('button', { name: 'Unpin message' }).click();
    await expect(guest.locator('.room-chat-pinned')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('artist dashboard matches a release and lets the artist choose whether to announce their visit', async ({ page }, testInfo) => {
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
    await expect(panel).toContainText('A shared moment');
    await expect(panel).toContainText('1 connected');
    await panel.screenshot({ path: testInfo.outputPath('artist-live-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole('button', { name: 'Visit room' }).click();
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
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
    await announce.uncheck();
    await page.screenshot({ path: testInfo.outputPath('artist-visit-mobile.png') });
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
    await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/artists/);
    await expect(page.getByRole('region', { name: 'Your music, live' })).toBeVisible();
  } finally {
    host.disconnect();
  }
});
