import { expect, test, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({
  actionTimeout: 10000,
  launchOptions: {
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader']
  }
});
const fix = { latitude: 0.392, longitude: 9.454, accuracy: 100 };
const title = 'E2E Protected Room Track';
async function hostRoom(browser: Browser, name: string, visibility?: 'Nearby' | 'Everyone') {
  const context = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  const page = await context.newPage();
  await page.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: `Select ${title}` }).click();
  await page.getByLabel('Your name or nickname').fill(name);
  if (visibility) await page.getByRole('radio', { name: visibility, exact: true }).check();
  await page.getByRole('button', { name: 'Open the room' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15000 });
  const id = (await page.getByTestId('room-code').textContent())!.trim();
  return {
    page,
    id,
    close: async () => {
      try {
        if (page.isClosed()) return;
        await page.keyboard.press('Escape');
        const close = page.getByRole('button', { name: 'Close room', exact: true });
        if (!(await close.isVisible())) await page.getByRole('button', { name: 'Room live', exact: true }).click({ timeout: 3000 });
        await close.click();
        const confirm = page.getByRole('button', { name: 'Close for everyone', exact: true });
        await expect.poll(async () => !(await page.getByTestId('room-code').count()) || (await confirm.isVisible())).toBe(true);
        if (await confirm.isVisible()) await confirm.click();
        await expect(page.getByTestId('room-code')).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  };
}
async function radar(page: Page) {
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  return page.getByRole('region', { name: 'Room galaxy', exact: true });
}

test('explicit 3D is lazy and scoped, with live removal and shared preview and Hide', async ({ browser, page }, info) => {
  test.setTimeout(120000);
  const near = await hostRoom(browser, 'Nearby host', 'Nearby');
  const world = await hostRoom(browser, 'Worldwide host', 'Everyone');
  const privateRoom = await hostRoom(browser, 'Private host');
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(fix);
  const graphicsRequests: string[] = [];
  page.on('request', request => {
    if (/RoomGalaxyScene|\/three(?:[./]|\?)/.test(request.url())) graphicsRequests.push(request.url());
  });
  try {
    await page.goto('/?e2eRoom=listener');
    const view = await radar(page);
    await expect(view.locator('.radar-room-dot')).toHaveCount(2, { timeout: 20000 });
    await expect(view.getByLabel('Room view', { exact: true })).toHaveValue('radar');
    expect(graphicsRequests).toEqual([]);
    await view.getByLabel('Room view', { exact: true }).selectOption('3d');
    const scene = view.getByTestId('room-galaxy-scene');
    await expect(scene).toHaveAttribute('data-status', 'ready', { timeout: 20000 });
    await expect(scene.locator('.room-galaxy-marker')).toHaveCount(2);
    await expect(scene.locator(`[data-room-id="${privateRoom.id}"]`)).toHaveCount(0);
    await scene.getByRole('button', { name: 'Center selected room', exact: true }).click();
    const marker = scene.locator(`[data-room-id="${near.id}"]`);
    await expect(marker.getByRole('button')).toHaveAccessibleDescription(/Nearby host.*1 listening.*0–5 km/);
    await marker.getByRole('button').click();
    const preview = page.getByRole('dialog', { name: title });
    await expect(preview).toContainText('Hosted by Nearby host');
    await expect(preview).toContainText('1 listening');
    await expect(preview).toContainText('≈ 0-5 km');
    await preview.getByRole('button', { name: 'Close room preview' }).click();
    expect((await new AxeBuilder({ page }).include('.room-radar').analyze()).violations).toEqual([]);
    await view.screenshot({ path: info.outputPath('scoped-galaxy-3d-desktop.png') });
    await view.getByLabel(`Options for ${title}`, { exact: true }).nth(1).click();
    await view.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(scene.locator('.room-galaxy-marker')).toHaveCount(1);
    await view.getByRole('button', { name: 'Hidden rooms (1)' }).click();
    await page.getByRole('button', { name: 'Show again', exact: true }).click();
    await page.getByRole('button', { name: 'Close hidden rooms' }).click();
    await expect(scene.locator('.room-galaxy-marker')).toHaveCount(2);
    await world.close();
    await expect(scene.locator(`[data-room-id="${world.id}"]`)).toHaveCount(0, { timeout: 5000 });
    await view.getByLabel('Room view', { exact: true }).selectOption('list');
    await expect(view.getByTestId('room-galaxy-scene')).toHaveCount(0);
    expect(await page.evaluate(() => window.__DOTIFY_ROOM_GALAXY__)).toBeUndefined();
    await view.getByLabel('Room view', { exact: true }).selectOption('radar');
    await expect(view.getByTestId('room-galaxy')).toBeVisible();
  } finally {
    await near.close();
    await world.close();
    await privateRoom.close();
  }
});

test('mobile graphics, context loss and reduced motion preserve Radar and walletless joining', async ({ browser, page }, info) => {
  test.setTimeout(90000);
  const host = await hostRoom(browser, 'Mobile galaxy host', 'Everyone');
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await page.goto('/?e2eRoom=listener');
    const view = await radar(page);
    await expect(view.locator('.radar-room-dot')).toHaveCount(1, { timeout: 20000 });
    await view.getByLabel('Room view', { exact: true }).selectOption('3d');
    const scene = view.getByTestId('room-galaxy-scene');
    await expect(scene).toHaveAttribute('data-status', 'ready', { timeout: 20000 });
    expect(await page.evaluate(() => window.__DOTIFY_ROOM_GALAXY__?.snapshot().pixelRatio)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await view.screenshot({ path: info.outputPath('scoped-galaxy-3d-mobile.png') });
    await scene.focus();
    await scene.getByTestId('room-galaxy-canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await expect(view.getByLabel('Room view', { exact: true })).toHaveValue('radar');
    await expect(view.getByLabel('Room view', { exact: true })).toBeFocused();
    await expect(view).toContainText('3D is not available here');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await view.getByLabel('Room view', { exact: true }).selectOption('3d');
    await expect(view.getByLabel('Room view', { exact: true })).toHaveValue('radar');
    await expect(view).toContainText('Reduced motion is enabled');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
        return kind.includes('webgl') ? null : native.call(this, kind, ...args);
      } as typeof native;
    });
    await page.reload();
    const fallback = await radar(page);
    await expect(fallback.locator('.radar-room-dot')).toHaveCount(1, { timeout: 20000 });
    await fallback.getByLabel('Room view', { exact: true }).selectOption('3d');
    await expect(fallback).toContainText('3D is not available here');
    await fallback.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel('Your name or nickname').fill('Fallback guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests)).toBe(0);
  } finally {
    await host.close();
  }
});

test('host graphics changes and own-room return preserve guest stream and host capture', async ({ browser, page }) => {
  test.setTimeout(90000);
  const host = await hostRoom(browser, 'Own galaxy host', 'Everyone');
  try {
    await page.goto('/?e2eRoom=listener');
    const guestView = await radar(page);
    await expect(guestView.getByRole('heading', { name: title })).toBeVisible({ timeout: 20000 });
    await guestView.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel('Your name or nickname').fill('Steady audio guest');
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    const remoteTrackId = await page
      .locator('audio')
      .evaluateAll(nodes =>
        (nodes.find(n => (n as HTMLAudioElement).srcObject instanceof MediaStream) as HTMLAudioElement)?.srcObject instanceof MediaStream
          ? ((nodes.find(n => (n as HTMLAudioElement).srcObject instanceof MediaStream) as HTMLAudioElement).srcObject as MediaStream).getAudioTracks()[0]?.id
          : null
      );
    expect(remoteTrackId).toBeTruthy();
    const stops = await host.page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.captureTrackStops);
    await host.page.getByRole('button', { name: 'Keep listening and browse', exact: true }).click();
    const hostView = await radar(host.page);
    await expect(hostView.locator('.radar-room-dot[data-own="true"]')).toBeVisible({ timeout: 20000 });
    await hostView.getByLabel('Room view', { exact: true }).selectOption('3d');
    const scene = hostView.getByTestId('room-galaxy-scene');
    await expect(scene).toHaveAttribute('data-status', 'ready', { timeout: 20000 });
    const own = scene.locator('.room-galaxy-marker[data-own="true"]');
    await expect(own).toContainText('Your room');
    await expect(own.getByRole('button')).toHaveAccessibleDescription(/2 listening.*Worldwide/);
    await hostView.getByLabel('Room view', { exact: true }).selectOption('list');
    await hostView.getByLabel('Room view', { exact: true }).selectOption('radar');
    await hostView.getByLabel('Room view', { exact: true }).selectOption('3d');
    await expect(scene).toHaveAttribute('data-status', 'ready', { timeout: 20000 });
    await own.getByRole('button').click();
    await host.page.getByRole('button', { name: 'Back to your room', exact: true }).click();
    await expect(host.page.getByTestId('room-code')).toHaveText(host.id);
    await expect(host.page.getByRole('button', { name: 'Close room', exact: true })).toBeVisible();
    await expect(page.getByTestId('room-listener-sync')).toHaveText('In sync');
    expect(await host.page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.captureTrackStops)).toBe(stops);
    expect(
      await page
        .locator('audio')
        .evaluateAll(
          (nodes, id) =>
            nodes.some(
              n =>
                (n as HTMLAudioElement).srcObject instanceof MediaStream &&
                ((n as HTMLAudioElement).srcObject as MediaStream).getAudioTracks().some(t => t.id === id && t.readyState === 'live')
            ),
          remoteTrackId
        )
    ).toBe(true);
    expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests)).toBe(0);
  } finally {
    await host.close();
  }
});

test('a failed scene chunk returns to Radar without breaking the room page', async ({ page }) => {
  await page.route('**/src/components/RoomGalaxyScene.tsx*', route => route.abort());
  await page.goto('/?e2eRoom=listener');
  const view = await radar(page);
  await view.getByLabel('Room view', { exact: true }).selectOption('3d');
  await expect(view).toContainText('3D is not available here');
  await expect(view.getByLabel('Room view', { exact: true })).toHaveValue('radar');
  await expect(view.getByTestId('room-galaxy')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join by link', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Open a room', exact: true })).toBeEnabled();
});
