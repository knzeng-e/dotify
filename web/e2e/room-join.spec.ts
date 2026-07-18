import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Room-join and host-access playback e2e (Sprint 1, Ticket 07).
//
// Real Socket.IO signaling + real WebRTC negotiation between two browser
// contexts (host + listener), with a synthetic near-silent audio stream and
// loopback-only ICE so the flow is deterministic in CI (see roomJoinMock.ts).
//
// Doctrine under test: only the host satisfies the track access policy; guests
// join via a link with no wallet, no signature, and never receive a content key.

type RoomJoinE2eState = {
  scenario: string;
  keyRequests: number;
  deniedKeyRequests: number;
  offers: number;
  replaceTrackSwaps: number;
  captureTrackStops: number;
  webAudioCaptures: number;
  streamReadySignals: number;
  remotePlaybackCues: number;
};

declare global {
  interface Window {
    __DOTIFY_E2E_ROOM_JOIN__?: RoomJoinE2eState;
  }
}

const PROTECTED_TITLE = 'E2E Protected Room Track';
const PUBLIC_TITLE = 'E2E Public Room Track';

type HostScenario = 'public' | 'protected-authorized' | 'protected-unauthorized';
type HostCaptureMode = 'synthetic' | 'web-audio';

async function readRoomJoinState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__);
}

// Host: open a deterministic e2e track and broadcast it as a room. Returns the
// server-assigned room code so a listener context can join via its share link.
async function openHostRoom(page: Page, scenario: HostScenario, trackTitle: string, options: { captureMode?: HostCaptureMode } = {}) {
  const params = new URLSearchParams({ e2eRoom: scenario });
  if (options.captureMode) params.set('e2eCapture', options.captureMode);
  await page.goto(`/?${params.toString()}`);
  // Open the room straight from the create-room modal so an unauthorized
  // protected track does not raise an access-gate overlay over the player
  // before the room exists. Pick the track inside the modal, then open.
  await page.getByRole('button', { name: 'Open a room' }).click();
  await page.getByRole('button', { name: `Select ${trackTitle}` }).click();
  await page.getByRole('button', { name: 'Open the room' }).click();

  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/, { timeout: 15_000 });
  return (await roomCode.textContent())?.trim() ?? '';
}

type JoinAsListenerOptions = {
  storedDisplayName?: string;
  displayName?: string;
  delaySignalMessagesMs?: number;
};

// Listener: open the bare #/rooms/<id> share link (no e2eRoom param) in a fresh
// context. A remembered name auto-joins; first-time guests must choose the name
// the host will see before joining.
async function joinAsListener(context: BrowserContext, roomId: string, options: JoinAsListenerOptions = {}) {
  if (options.storedDisplayName) {
    await context.addInitScript(name => {
      window.localStorage.setItem('dotify:display-name:guest', name);
    }, options.storedDisplayName);
  }
  if (options.delaySignalMessagesMs) {
    await context.routeWebSocket(/\/socket\.io\//, webSocket => {
      const server = webSocket.connectToServer();
      server.onMessage(message => {
        setTimeout(() => webSocket.send(message), options.delaySignalMessagesMs);
      });
    });
  }
  const page = await context.newPage();
  await page.goto(`/#/rooms/${roomId}`);
  if (options.delaySignalMessagesMs) {
    // Socket.IO can satisfy the room lookup over its polling transport before
    // the WebSocket delay is visible, so this delayed path may already have
    // reached the join sheet. If the loading affordance is observable, it must
    // still be disabled.
    await expect(page.locator('#join-room-title')).toHaveText(/Finding this room|welcomes you/);
    const findingButton = page.getByRole('button', { name: 'Finding room...' });
    if (await findingButton.isVisible().catch(() => false)) {
      await expect(findingButton).toBeDisabled();
    }
  }
  if (options.displayName) {
    await expect(page.locator('#join-room-title')).toContainText('welcomes you');
    await expect(page.locator('.room-threshold-preview')).toBeVisible();
    await expect(page.locator('.room-threshold-code')).toContainText(roomId);
    await expect(page.getByRole('button', { name: 'Enter and listen' })).toBeDisabled();
    await page.getByLabel('Your name in the room').fill(options.displayName);
    await page.getByRole('button', { name: 'Enter and listen' }).click();
  }
  return page;
}

async function expectRoomGuestAccessBoundary(page: Page) {
  await expect(page.getByTestId('locked-player-state')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /support.*open|check access/i })).toHaveCount(0);
  await expect(page.locator('.player-context-panel')).not.toContainText(/\bDOT\b|wallet/i);
  await expect(page.locator('.access-badges')).toContainText('Live room stream');
}

async function expectRemoteAudioPlaying(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const audio = document.querySelectorAll<HTMLAudioElement>('audio.native-player-source')[1];
        return Boolean(audio?.srcObject && !audio.paused && !audio.ended);
      })
    )
    .toBe(true);
}

async function removeMediaElementCaptureSupport(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', { value: undefined, configurable: true });
    Object.defineProperty(HTMLMediaElement.prototype, 'mozCaptureStream', { value: undefined, configurable: true });
  });
}

test('public room: listener joins via link, hears full playback, no wallet, no content key', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  const secondListenerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'public', PUBLIC_TITLE);
    expect(roomId).toMatch(/[A-Z0-9]{4,}/);
    await expect(host.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');

    const listener = await joinAsListener(listenerContext, roomId, { storedDisplayName: 'Listener', displayName: 'Nomad', delaySignalMessagesMs: 500 });

    // Guest joins with no wallet: the connect affordance is still present.
    await expect(listener.getByRole('button', { name: 'Connect' })).toBeVisible();
    // Real WebRTC stream reaches the listener.
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');
    await expectRoomGuestAccessBoundary(listener);
    await expect(host.locator('.listener-list')).toContainText('Nomad', { timeout: 20_000 });

    const secondListener = await joinAsListener(secondListenerContext, roomId, { displayName: 'Zed' });
    await expect(secondListener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(host.locator('.listener-list')).toContainText('Zed', { timeout: 20_000 });
    await expect(listener.locator('.listener-list')).toContainText('Nomad', { timeout: 20_000 });
    await expect(listener.locator('.listener-list')).toContainText('Zed', { timeout: 20_000 });
    await expect(secondListener.locator('.listener-list')).toContainText('Nomad', { timeout: 20_000 });
    await expect(secondListener.locator('.listener-list')).toContainText('Zed', { timeout: 20_000 });

    await listener.getByLabel('Your room name').fill('Nia');
    await listener.getByRole('button', { name: 'Update room name' }).click();
    await expect(host.locator('.listener-list')).toContainText('Nia', { timeout: 20_000 });
    await expect(secondListener.locator('.listener-list')).toContainText('Nia', { timeout: 20_000 });

    // Key-delivery boundary: the listener never requested a content key.
    const listenerState = await readRoomJoinState(listener);
    expect(listenerState?.keyRequests ?? 0).toBe(0);
  } finally {
    await hostContext.close();
    await listenerContext.close();
    await secondListenerContext.close();
  }
});

test('public room: mobile-style host without captureStream uses Web Audio capture', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  try {
    await removeMediaElementCaptureSupport(hostContext);
    await removeMediaElementCaptureSupport(listenerContext);

    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'public', PUBLIC_TITLE, { captureMode: 'web-audio' });
    await expect(host.getByTestId('session-error')).toHaveCount(0);

    const hostState = await readRoomJoinState(host);
    expect(hostState?.webAudioCaptures ?? 0).toBeGreaterThan(0);

    const listener = await joinAsListener(listenerContext, roomId, { storedDisplayName: 'Mobile guest' });
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expectRoomGuestAccessBoundary(listener);

    await host.getByRole('button', { name: 'Play', exact: true }).click();
    await expectRemoteAudioPlaying(listener);
    await expect(listener.getByTestId('session-error')).toHaveCount(0);

    const listenerState = await readRoomJoinState(listener);
    expect(listenerState?.keyRequests ?? 0).toBe(0);
  } finally {
    await hostContext.close();
    await listenerContext.close();
  }
});

test('protected room with authorized host: host gets the key, listener streams full without one', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'protected-authorized', PROTECTED_TITLE);
    await expect(host.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');

    // The host satisfied the policy and received a content key.
    const hostState = await readRoomJoinState(host);
    expect(hostState?.keyRequests ?? 0).toBeGreaterThanOrEqual(1);
    expect(hostState?.deniedKeyRequests ?? 0).toBe(0);

    const listener = await joinAsListener(listenerContext, roomId, { storedDisplayName: 'Ada' });
    await expect(listener.getByRole('button', { name: 'Connect' })).toBeVisible();
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');
    await expectRoomGuestAccessBoundary(listener);
    await expect(host.locator('.listener-list')).toContainText('Ada', { timeout: 20_000 });

    const stateBeforeSwitch = await readRoomJoinState(host);
    expect(stateBeforeSwitch?.offers ?? 0).toBeGreaterThanOrEqual(1);
    expect(stateBeforeSwitch?.replaceTrackSwaps ?? 0).toBe(0);
    expect(stateBeforeSwitch?.captureTrackStops ?? 0).toBe(0);

    await host.getByRole('button', { name: 'Next track' }).click();
    await host.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');
    await expect(listener.locator('.track-copy h2')).toHaveText(PUBLIC_TITLE, { timeout: 20_000 });
    await expectRemoteAudioPlaying(listener);

    const stateAfterSwitch = await readRoomJoinState(host);
    expect(stateAfterSwitch?.offers ?? 0).toBeGreaterThan(stateBeforeSwitch?.offers ?? 0);
    expect(stateAfterSwitch?.replaceTrackSwaps ?? 0).toBeGreaterThanOrEqual(stateBeforeSwitch?.replaceTrackSwaps ?? 0);
    expect(stateAfterSwitch?.captureTrackStops ?? 0).toBe(0);
    expect(stateAfterSwitch?.streamReadySignals ?? 0).toBeGreaterThan(stateBeforeSwitch?.streamReadySignals ?? 0);

    // Switch back as well: source changes renegotiate a fresh WebRTC offer.
    // Same-source recapture may still use replaceTrack, but the room must never
    // stop browser-owned capture tracks and leave the listener on silent media.
    await host.getByRole('button', { name: 'Previous track' }).click();
    await host.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.locator('.track-copy h2')).toHaveText(PROTECTED_TITLE, { timeout: 20_000 });
    await expectRemoteAudioPlaying(listener);

    const stateAfterReturn = await readRoomJoinState(host);
    expect(stateAfterReturn?.offers ?? 0).toBeGreaterThan(stateAfterSwitch?.offers ?? 0);
    expect(stateAfterReturn?.replaceTrackSwaps ?? 0).toBeGreaterThanOrEqual(stateAfterSwitch?.replaceTrackSwaps ?? 0);
    expect(stateAfterReturn?.captureTrackStops ?? 0).toBe(0);
    expect(stateAfterReturn?.streamReadySignals ?? 0).toBeGreaterThan(stateAfterSwitch?.streamReadySignals ?? 0);

    const listenerAfterReturn = await readRoomJoinState(listener);
    expect(listenerAfterReturn?.remotePlaybackCues ?? 0).toBeGreaterThan(0);

    // The listener never requested a key, even for a protected track.
    const listenerState = await readRoomJoinState(listener);
    expect(listenerState?.keyRequests ?? 0).toBe(0);
  } finally {
    await hostContext.close();
    await listenerContext.close();
  }
});

test('protected room with unauthorized host: no stream, no keys, host moves to a public track', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'protected-unauthorized', PROTECTED_TITLE);

    // Access model v2: there is no preview fallback. An unauthorized host
    // streams nothing at all - the unlock gate is the whole answer - and no
    // content key was ever requested for the locked track.
    await expect(host.getByTestId('access-warning')).toBeVisible();
    const hostState = await readRoomJoinState(host);
    expect(hostState?.keyRequests ?? 0).toBe(0);

    // The listener can be in the room, but with no stream they are connected,
    // not in sync.
    const listener = await joinAsListener(listenerContext, roomId, { displayName: 'Rin' });
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('Connecting...', { timeout: 20_000 });

    // The host dismisses the gate and moves the room to the public track;
    // playback starts on the explicit Play (e2e disables autoplay).
    await host.keyboard.press('Escape');
    await host.getByRole('button', { name: 'Next track' }).click();
    await host.getByRole('button', { name: 'Play', exact: true }).click();

    // The room now streams the public track in full.
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');
    await expect(listener.locator('.track-copy h2')).toHaveText(PUBLIC_TITLE, { timeout: 20_000 });

    // The locked track never produced a key request, for host or listener.
    const listenerState = await readRoomJoinState(listener);
    expect(listenerState?.keyRequests ?? 0).toBe(0);
  } finally {
    await hostContext.close();
    await listenerContext.close();
  }
});

test('host disconnect: the room is removed and the listener sees a clear closed state', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'public', PUBLIC_TITLE);

    const listener = await joinAsListener(listenerContext, roomId, { storedDisplayName: 'Echo' });
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });

    // Host leaves: closing the context disconnects the host socket, so the
    // server removes the room (no zombie) and notifies the listener.
    await hostContext.close();

    await expect(listener.getByTestId('session-error')).toContainText(/host left|room closed|expired/i, { timeout: 20_000 });
    // The room is gone from the listener UI (no lingering room code).
    await expect(listener.getByTestId('room-code')).toHaveCount(0);
  } finally {
    await hostContext.close().catch(() => {});
    await listenerContext.close();
  }
});

test('missing room link stays unavailable and cannot be entered', async ({ page }) => {
  const roomId = 'NOPE99';
  await page.goto(`/#/rooms/${roomId}`);

  await expect(page.locator('#join-room-title')).toHaveText('This room is unavailable');
  await expect(page.locator('.room-threshold-code')).toContainText(roomId);
  await expect(page.locator('.room-threshold-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Room unavailable' })).toBeDisabled();
});
