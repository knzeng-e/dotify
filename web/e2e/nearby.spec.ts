import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fix = { latitude: 0.392, longitude: 9.454, accuracy: 100 };
const title = 'E2E Protected Room Track';
async function openHost(context: BrowserContext, visibility?: 'Nearby' | 'Everyone') {
  const host = await context.newPage();
  await host.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
  await host.getByRole('button', { name: 'Open a room' }).click();
  await host.getByRole('button', { name: `Select ${title}` }).click();
  await host.getByLabel('Your name in the room').fill('Radar host');
  if (visibility) await host.getByRole('radio', { name: visibility, exact: true }).check();
  await host.getByRole('button', { name: 'Open the room' }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15_000 });
  await host.getByRole('tab', { name: /People/ }).click();
  return host;
}
async function editVisibility(host: Page, mode: 'Nearby' | 'Everyone' | 'Link only') {
  await host.getByRole('button', { name: /Who can find this room/ }).click();
  const dialog = host.getByRole('dialog', { name: 'Who can find this room?' });
  await dialog.getByRole('radio', { name: mode, exact: true }).check();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
}
async function rooms(page: Page) {
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  return page.getByRole('region', { name: 'Room galaxy', exact: true });
}

test('automatic radar finds a later nearby publication, then joins real guest audio without keys', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  const guestContext = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { ...fix, latitude: 0.395 },
    viewport: { width: 390, height: 844 }
  });
  const packets: string[] = [];
  try {
    const host = await openHost(hostContext);
    await expect(host.getByRole('region', { name: 'Room visibility' })).toContainText('Link only');
    const guest = await guestContext.newPage();
    guest.on('websocket', socket =>
      socket.on('framesent', frame => {
        if (String(frame.payload).includes('nearby:')) packets.push(String(frame.payload));
      })
    );
    guest.on('request', request => {
      const body = request.postData();
      if (body?.includes('nearby:')) packets.push(body);
    });
    await guest.goto('/?e2eRoom=listener');
    // App startup begins discovery even before Rooms is opened.
    await expect.poll(() => packets.some(packet => packet.includes('"cell"'))).toBe(true);
    const radar = await rooms(guest);
    await expect(radar.getByRole('heading', { name: title })).toHaveCount(0);
    await expect(radar.getByText('Explore a city')).toHaveCount(0);
    await editVisibility(host, 'Nearby');
    await expect(host.getByRole('region', { name: 'Room visibility' })).toContainText('Visible nearby');
    // No user-triggered re-scan: the next bounded read finds the new host.
    await expect(radar.getByRole('heading', { name: title })).toBeVisible({ timeout: 25_000 });
    await expect(radar.locator('.discovery-distance')).toHaveText('≈ 0–5 km');
    expect((await new AxeBuilder({ page: guest }).include('.room-radar').analyze()).violations).toEqual([]);
    await guest.screenshot({ path: testInfo.outputPath('radar-mobile.png'), fullPage: true });
    await guest.setViewportSize({ width: 1440, height: 1000 });
    await guest.screenshot({ path: testInfo.outputPath('radar-desktop.png'), fullPage: true });
    await guest.setViewportSize({ width: 390, height: 844 });
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await radar.getByRole('button', { name: /^Inspect / }).click();
    const preview = guest.getByRole('dialog', { name: title });
    await expect(preview).toContainText('≈ 0–5 km');
    await preview.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByLabel('Your name in the room').fill('Nearby guest');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect.poll(() => guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.remotePlaybackCues ?? 0), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
    const energy = await guest.evaluate(async () => {
      const audio = [...document.querySelectorAll('audio')].find(item => item.srcObject instanceof MediaStream);
      if (!audio?.srcObject) return 0;
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(audio.srcObject as MediaStream);
      const analyser = context.createAnalyser();
      source.connect(analyser);
      await new Promise(resolve => setTimeout(resolve, 300));
      const samples = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(samples);
      source.disconnect();
      await context.close();
      return Math.max(...samples) - Math.min(...samples);
    });
    expect(energy).toBeGreaterThan(0);
    expect(packets.join('\n')).not.toMatch(/latitude|longitude|accuracy|0\.392|9\.454|wallet|areaCells/);
    expect(await guest.evaluate(() => JSON.stringify([Object.values(localStorage), Object.values(sessionStorage)]))).not.toMatch(/n2:|0\.395|9\.454/);
    await host.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(host.getByRole('region', { name: 'Room visibility' })).toContainText('Link only');
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close()]);
  }
});

test('visibility and range live in a dismissible sheet; a draft never publishes', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(fix);
  await page.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
  const publications: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:publish')) publications.push(String(frame.payload));
    })
  );
  await page.getByRole('button', { name: 'Open a room' }).click();
  await expect(page.getByRole('radio', { name: 'Link only', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Nearby', exact: true }).check();
  await page.getByRole('slider', { name: 'Visibility range' }).fill('17');
  expect(publications).toEqual([]);
  await page.getByRole('button', { name: `Select ${title}` }).click();
  await page.getByLabel('Your name in the room').fill('Visible host');
  await page.getByRole('button', { name: 'Open the room' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
  await page.getByRole('tab', { name: /People/ }).click();
  const panel = page.getByRole('region', { name: 'Room visibility' });
  await expect(panel).toContainText('Visible nearby · about 17 km');
  await panel.getByRole('button').click();
  const sheet = page.getByRole('dialog', { name: 'Who can find this room?' });
  await sheet.getByRole('radio', { name: 'Everyone', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(panel).toContainText('Nearby · 17 km');
  await expect(panel.getByRole('button')).toBeFocused();
  await panel.getByRole('button').click();
  await sheet.getByRole('radio', { name: 'Everyone', exact: true }).check();
  expect((await new AxeBuilder({ page }).include('.discovery-sheet').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('visibility-sheet.png'), fullPage: true });
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(panel).toContainText('Visible worldwide');
  await editVisibility(page, 'Link only');
  await expect(panel).toContainText('no longer visible worldwide');
});

test('worldwide rooms can be inspected and joined while the nearby fix is still pending', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await openHost(hostContext, 'Everyone');
    const guest = await guestContext.newPage();
    await guest.addInitScript(() => {
      Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'granted' }) } });
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch: () => {} } });
    });
    await guest.goto('/?e2eRoom=listener');
    const radar = await rooms(guest);
    await expect(radar).toContainText('Finding your approximate area');
    await expect(radar.getByRole('heading', { name: title })).toBeVisible();
    await expect(radar.locator('.discovery-distance')).toHaveText('Worldwide');
    await guest.screenshot({ path: testInfo.outputPath('worldwide-during-location.png'), fullPage: true });
    await radar.getByRole('button', { name: /^Inspect / }).click();
    await guest.getByRole('dialog', { name: title }).getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByLabel('Your name in the room').fill('World guest');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('worldwide discovery resumes after a fast reconnect without another click', async ({ page }) => {
  let closeConnection: (() => Promise<void>) | undefined;
  let connections = 0;
  let searches = 0;
  await page.routeWebSocket('ws://127.0.0.1:8789/**', route => {
    connections++;
    const server = route.connectToServer();
    route.onMessage(message => {
      if (String(message).includes('nearby:search') && String(message).includes('worldwide')) searches++;
      server.send(message);
    });
    closeConnection = () => route.close();
  });
  page.on('request', request => {
    const body = request.postData();
    if (body?.includes('nearby:search') && body.includes('worldwide')) searches++;
  });
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:search') && String(frame.payload).includes('worldwide')) searches++;
    })
  );
  await page.goto('/?e2eRoom=listener');
  await rooms(page);
  await expect.poll(() => searches).toBeGreaterThan(0);
  const before = searches;
  await closeConnection!();
  await expect.poll(() => connections, { timeout: 5000 }).toBeGreaterThan(1);
  await expect.poll(() => searches, { timeout: 16_000 }).toBeGreaterThan(before);
});
