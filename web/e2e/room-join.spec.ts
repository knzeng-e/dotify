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
};

declare global {
  interface Window {
    __DOTIFY_E2E_ROOM_JOIN__?: RoomJoinE2eState;
  }
}

const PROTECTED_TITLE = 'E2E Protected Room Track';
const PUBLIC_TITLE = 'E2E Public Room Track';

type HostScenario = 'public' | 'protected-authorized' | 'protected-unauthorized';

async function readRoomJoinState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__);
}

// Host: open a deterministic e2e track and broadcast it as a room. Returns the
// server-assigned room code so a listener context can join via its share link.
async function openHostRoom(page: Page, scenario: HostScenario, trackTitle: string) {
  await page.goto(`/?e2eRoom=${scenario}`);
  // Open the room straight from the create-room modal so an unauthorized
  // protected track does not raise an access-gate overlay over the player
  // before the room exists. Pick the track inside the modal, then open.
  await page.getByRole('button', { name: 'Start a room' }).click();
  await page.getByRole('button', { name: `Select ${trackTitle}` }).click();
  await page.getByRole('button', { name: 'Open the room' }).click();

  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/, { timeout: 15_000 });
  return (await roomCode.textContent())?.trim() ?? '';
}

// Listener: open the bare #/rooms/<id> share link (no e2eRoom param) in a fresh
// context. App auto-joins on mount with no wallet interaction.
async function joinAsListener(context: BrowserContext, roomId: string) {
  const page = await context.newPage();
  await page.goto(`/#/rooms/${roomId}`);
  return page;
}

test('public room: listener joins via link, hears full playback, no wallet, no content key', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const listenerContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const roomId = await openHostRoom(host, 'public', PUBLIC_TITLE);
    expect(roomId).toMatch(/[A-Z0-9]{4,}/);
    await expect(host.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');

    const listener = await joinAsListener(listenerContext, roomId);

    // Guest joins with no wallet: the connect affordance is still present.
    await expect(listener.getByRole('button', { name: 'Connect' })).toBeVisible();
    // Real WebRTC stream reaches the listener.
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');

    // Key-delivery boundary: the listener never requested a content key.
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

    const listener = await joinAsListener(listenerContext, roomId);
    await expect(listener.getByRole('button', { name: 'Connect' })).toBeVisible();
    await expect(listener.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect(listener.getByTestId('room-playback-mode')).toHaveAttribute('data-mode', 'full');

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
    const listener = await joinAsListener(listenerContext, roomId);
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

    const listener = await joinAsListener(listenerContext, roomId);
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
