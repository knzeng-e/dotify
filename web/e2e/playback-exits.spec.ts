import { expect, test, type Page } from '@playwright/test';
import { syntheticWav } from './fixtures/syntheticWav';

const fixture = '/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence&e2eAutoplay=on&e2eCapture=web-audio';
const home = (page: Page) => page.getByRole('heading', { name: 'Listen together.', exact: true });

async function browse(page: Page, width = 1440) {
  const roomBrowse = page.getByRole('button', { name: 'Keep listening and browse', exact: true });
  if (await roomBrowse.isVisible()) {
    await roomBrowse.click();
    return;
  }
  const back = page.getByRole('button', { name: 'Back to Music', exact: true });
  if (await back.isVisible()) await back.click();
  else
    await page
      .locator(width <= 768 ? '.bottom-nav' : '.topbar')
      .getByRole('button', { name: 'Music', exact: true })
      .click();
}

async function hostRoom(page: Page, url = fixture) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Exit host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
  return (await page.getByTestId('room-code').innerText()).trim();
}

async function joinRoom(page: Page, roomId: string) {
  await page.goto(`/#/rooms/${roomId}`);
  await page.getByLabel('Your name or nickname').fill('Exit guest');
  await page.getByRole('button', { name: 'Join and listen', exact: true }).click();
  await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
}

for (const width of [320, 1440]) {
  test(`closing the mini-player stops solo audio and stays dismissed at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(fixture);
    await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
    const audio = page.locator('audio.native-player-source').first();
    await expect(audio).toHaveJSProperty('paused', false);
    await expect(page.getByRole('button', { name: 'Close mini-player' })).toHaveCount(0);
    await browse(page, width);
    const close = page.getByRole('button', { name: 'Close mini-player', exact: true });
    await expect(close).toBeVisible();
    const target = (await close.boundingBox())!;
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('mini-player-close.png') });
    await close.click();
    await expect(page.locator('.player-dock')).toHaveCount(0);
    await expect(audio).toHaveJSProperty('paused', true);
    const nav = page.locator(width <= 768 ? '.bottom-nav' : '.topbar');
    await nav.getByRole('button', { name: 'Rooms', exact: true }).click();
    await nav.getByRole('button', { name: 'Music', exact: true }).click();
    await expect(page.locator('.player-dock')).toHaveCount(0);
    await expect(audio).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
    await expect(audio).toHaveJSProperty('paused', false);
    await browse(page, width);
    await expect(close).toBeVisible();
    // Replaying the retained source is a new intent, not a temporary override
    // of dismissal while playing. Pausing must keep the controls available.
    const dock = page.locator('.player-dock');
    await dock.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(audio).toHaveJSProperty('paused', true);
    await expect(close).toBeVisible();
    await dock.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(audio).toHaveJSProperty('paused', false);
    await expect(close).toBeVisible();
    await close.click();
    await expect(dock).toHaveCount(0);
    await expect(audio).toHaveJSProperty('paused', true);
  });
}

test('the mini-player stays controllable in the artist studio without replacing the audio element', async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', false);
  await page.evaluate(() => Reflect.set(window, '__exitAudio', document.querySelector('audio')));
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Set up your artist studio', exact: true }).click();
  await expect(page).toHaveURL(/\/artists/);
  expect(await page.evaluate(() => Reflect.get(window, '__exitAudio') === document.querySelector('audio'))).toBe(true);
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', false);
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', true);
  await page.getByRole('link', { name: 'Listener app', exact: true }).click();
  await expect(home(page)).toBeVisible();
  await expect(page.locator('.player-dock')).toHaveCount(0);
});

test('guest mini-player exit requires confirmation, stops audio and removes the invitation', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const roomId = await hostRoom(host);
    await joinRoom(guest, roomId);
    await guest.evaluate(() => Reflect.set(window, '__exitStream', document.querySelectorAll<HTMLAudioElement>('audio')[1].srcObject));
    await browse(guest, 390);
    await guest.getByRole('button', { name: 'Close mini-player', exact: true }).click();
    const dialog = guest.getByRole('dialog', { name: 'Leave this room?' });
    await expect(dialog).toContainText('Everyone else can keep listening');
    await dialog.getByRole('button', { name: 'Keep listening', exact: true }).click();
    expect(await guest.evaluate(() => Reflect.get(window, '__exitStream') === document.querySelectorAll<HTMLAudioElement>('audio')[1].srcObject)).toBe(true);
    await guest.getByRole('button', { name: 'Close mini-player', exact: true }).click();
    await guest.getByRole('button', { name: 'Leave room', exact: true }).click();
    await expect(home(guest)).toBeVisible();
    await expect(guest.locator('.player-dock')).toHaveCount(0);
    await expect(guest.locator('audio').nth(1)).toHaveJSProperty('srcObject', null);
    expect(new URL(guest.url()).hash).toBe('');
    await expect(host.getByTestId('room-code')).toHaveText(roomId);
    await guest.reload();
    await expect(home(guest)).toBeVisible();
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    await expect(guest.locator('audio').nth(1)).toHaveJSProperty('srcObject', null);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('host mini-player confirmation closes the room and guests return home with an explanation', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const roomId = await hostRoom(host);
    await joinRoom(guest, roomId);
    await browse(host);
    await host.getByRole('button', { name: 'Close mini-player', exact: true }).click();
    const dialog = host.getByRole('dialog', { name: 'Close this room?' });
    await expect(dialog).toContainText('Closing ends the room for everyone');
    await dialog.getByRole('button', { name: 'Keep listening', exact: true }).click();
    await expect(host.locator('.player-dock-room')).toContainText('Hosting');
    await host.getByRole('button', { name: 'Close mini-player', exact: true }).click();
    await host.getByRole('button', { name: 'Close for everyone', exact: true }).click();
    await expect(home(host)).toBeVisible();
    await expect(host.locator('.player-dock')).toHaveCount(0);
    await expect(host.locator('audio').first()).toHaveJSProperty('paused', true);
    await expect(home(guest)).toBeVisible();
    await expect(guest.getByRole('region', { name: 'Status messages' })).toContainText('Room ended');
    await expect(guest.locator('audio').nth(1)).toHaveJSProperty('srcObject', null);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('closing a preparing track prevents a late source from restarting audio', async ({ page }) => {
  let releaseSource: (() => void) | undefined;
  let responseFinished = false;
  await page.route('**/__dotify_e2e__/room-sequence.wav', async route => {
    await new Promise<void>(resolve => {
      releaseSource = resolve;
    });
    const body = syntheticWav();
    await route.fulfill({ contentType: 'audio/wav', body }).catch(() => undefined);
    responseFinished = true;
  });
  await page.goto(`${fixture}&e2eTrackDelay=on`);
  await page.getByRole('button', { name: /^Play Second room track by/ }).click();
  await expect.poll(() => Boolean(releaseSource)).toBe(true);
  await browse(page);
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  releaseSource!();
  await expect.poll(() => responseFinished).toBe(true);
  await expect(page.locator('.player-dock')).toHaveCount(0);
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', true);
  await expect(home(page)).toBeVisible();
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(page.locator('.player-dock')).toHaveCount(0);
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', true);
});

test('leaving a pending join ignores its late acknowledgement', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const roomId = await hostRoom(host);
    let upgraded = false;
    let ackPrefix = '';
    let releaseAck: (() => void) | undefined;
    await guest.routeWebSocket(/\/socket\.io\//, socket => {
      const server = socket.connectToServer();
      socket.onMessage(message => {
        const frame = String(message);
        if (frame === '5') upgraded = true;
        if (frame.includes('"room:join"')) {
          const id = /^42(\d+)\[/.exec(frame)?.[1];
          if (id) ackPrefix = `43${id}[`;
        }
        server.send(message);
      });
      server.onMessage(message => {
        if (ackPrefix && String(message).startsWith(ackPrefix) && !releaseAck) {
          releaseAck = () => socket.send(message);
          return;
        }
        socket.send(message);
      });
    });
    await guest.goto(`/#/rooms/${roomId}`);
    await expect.poll(() => upgraded).toBe(true);
    await guest.getByLabel('Your name or nickname').fill('Late guest');
    await guest.getByRole('button', { name: 'Join and listen', exact: true }).click();
    await expect.poll(() => Boolean(releaseAck)).toBe(true);
    await browse(guest);
    releaseAck!();
    await expect(home(guest)).toBeVisible();
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    await expect(guest.locator('.player-dock-room')).toHaveCount(0);
    await expect(guest.locator('audio').nth(1)).toHaveJSProperty('srcObject', null);
    expect(new URL(guest.url()).hash).toBe('');
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('even a host alone confirms mini-player closure before the room ends', async ({ page }) => {
  const roomId = await hostRoom(page);
  await browse(page);
  await page.getByRole('button', { name: 'Close mini-player', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Close this room?' });
  await expect(dialog).toContainText('Closing ends your room and stops the audio');
  await dialog.getByRole('button', { name: 'Keep listening', exact: true }).click();
  await page.getByRole('button', { name: /^Return to room/ }).click();
  await expect(page.getByTestId('room-code')).toHaveText(roomId);
});

test('new release preparation cannot replace an active room source in the artist studio', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dotify:e2e:artist-publish', JSON.stringify({ runtimeCreated: true, tracks: [] }));
  });
  const roomId = await hostRoom(page, `${fixture}&e2eArtist=happy`);
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', false);
  await page.evaluate(() => Reflect.set(window, '__artistRoomAudio', document.querySelector('audio')));
  await browse(page);
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: /^Open .* Studio$/i }).click();
  await page.getByRole('tab', { name: 'Releases', exact: true }).click();
  await page.getByRole('button', { name: 'New release', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room is still live' })).toBeVisible();
  await expect(page.getByTestId('artist-audio-input')).toHaveCount(0);
  await expect(page.locator('audio').first()).toHaveJSProperty('paused', false);
  expect(await page.evaluate(() => Reflect.get(window, '__artistRoomAudio') === document.querySelector('audio'))).toBe(true);
  await page.getByRole('button', { name: /^Return to room/ }).click();
  await expect(page.getByTestId('room-code')).toHaveText(roomId);
});
