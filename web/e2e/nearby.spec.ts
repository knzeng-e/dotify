import { expect, test, type Page, type BrowserContext, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fix = { latitude: 0.392, longitude: 9.454, accuracy: 100 };
const title = 'E2E Protected Room Track';
async function openHost(context: BrowserContext, visibility?: 'Nearby' | 'Everyone') {
  const host = await context.newPage();
  await host.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
  await host.getByRole('button', { name: 'Open a room' }).click();
  await host.getByRole('button', { name: `Select ${title}` }).click();
  await host.getByLabel('Your name or nickname').fill('Radar host');
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
async function planetVisuals(room: Locator) {
  return room.locator('.radar-room-sphere').evaluate(sphere => ({
    size: Number.parseFloat(getComputedStyle(sphere).width),
    glow: Number.parseFloat(getComputedStyle(sphere.querySelector('.radar-room-halo')!).opacity)
  }));
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
    // A scoped push finds the host before the next 15-second refresh.
    await expect(radar.getByRole('heading', { name: title })).toBeVisible({ timeout: 3000 });
    await expect(radar.locator('.discovery-distance')).toHaveText('≈ 0-5 km');
    expect((await new AxeBuilder({ page: guest }).include('.room-radar').analyze()).violations).toEqual([]);
    await guest.screenshot({ path: testInfo.outputPath('radar-mobile.png'), fullPage: true });
    await guest.setViewportSize({ width: 1440, height: 1000 });
    await guest.screenshot({ path: testInfo.outputPath('radar-desktop.png'), fullPage: true });
    await guest.setViewportSize({ width: 390, height: 844 });
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await radar.getByRole('button', { name: /^Inspect / }).click();
    const preview = guest.getByRole('dialog', { name: title });
    await expect(preview).toContainText('≈ 0-5 km');
    await preview.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByLabel('Your name or nickname').fill('Nearby guest');
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
    await expect(host.getByRole('region', { name: 'Room visibility' })).toContainText('Nearby');
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
  await page.getByLabel('Your name or nickname').fill('Visible host');
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
    await expect(radar.getByRole('heading', { name: title }).first()).toBeVisible();
    await expect(radar.locator('.discovery-distance')).toHaveText('Worldwide');
    await guest.screenshot({ path: testInfo.outputPath('worldwide-during-location.png'), fullPage: true });
    await radar.getByRole('button', { name: /^Inspect / }).click();
    await guest.getByRole('dialog', { name: title }).getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByLabel('Your name or nickname').fill('World guest');
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
  let websocketActive = false;
  await page.routeWebSocket('ws://127.0.0.1:8789/**', route => {
    connections++;
    const server = route.connectToServer();
    route.onMessage(message => {
      // Engine.IO packet 5 commits the upgrade from polling to WebSocket.
      if (String(message) === '5') websocketActive = true;
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
  // Automatic app-entry search can finish while the upgrade is still probing.
  // Closing that candidate would leave the active polling connection intact.
  await expect.poll(() => websocketActive).toBe(true);
  const before = searches;
  await closeConnection!();
  await expect.poll(() => connections, { timeout: 5000 }).toBeGreaterThan(1);
  await expect.poll(() => searches, { timeout: 16_000 }).toBeGreaterThan(before);
});

test('radar sweep remains live after a fast response and after returning to Rooms; reduced motion stays still', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(fix);
  await page.goto('/?e2eRoom=listener');
  let radar = await rooms(page);
  const sky = radar.getByTestId('room-galaxy');
  await expect(sky).toHaveAttribute('data-scanning', 'false');
  await expect(sky).toHaveAttribute('data-live', 'true');
  const sweep = radar.locator('.radar-sweep');
  await expect(sweep).toHaveCSS('animation-name', 'radar-turn');
  const firstTransform = await sweep.evaluate(element => getComputedStyle(element).transform);
  await expect.poll(() => sweep.evaluate(element => getComputedStyle(element).transform)).not.toBe(firstTransform);
  // Ordinary navigation used to hide every short scan acknowledgement.
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  radar = await rooms(page);
  await expect(radar.locator('.radar-sweep')).toHaveCSS('animation-name', 'radar-turn');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(radar.locator('.radar-sweep')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(radar.locator('.radar-sweep')).toHaveCSS('animation-name', 'radar-turn');
});

test('cover galaxies show exact live people and distinguish my room from an identical track next door', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  const otherContext = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  const guestContext = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  try {
    const host = await openHost(hostContext, 'Everyone');
    const hostRoomCode = (await host.getByTestId('room-code').textContent())!;
    await openHost(otherContext, 'Everyone');
    const guest = await guestContext.newPage();
    await guest.goto('/?e2eRoom=listener');
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    await guest.getByRole('button', { name: 'Join by link', exact: true }).click();
    await guest.getByLabel('Room code or link').fill(hostRoomCode);
    await guest.getByRole('button', { name: 'Join', exact: true }).first().click();
    await guest.getByLabel('Your name or nickname').fill('Orbit listener');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await host.getByRole('button', { name: 'Keep listening and browse', exact: true }).click();
    const radar = await rooms(host);
    // Exercise pointer crossing, not CSS-driven auto-scroll. A smooth scroll
    // during locator.hover can move the open popup away from the real pointer.
    // Keep radar/presence animations enabled; only page scrolling is immediate.
    await host.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    await host.setViewportSize({ width: 1440, height: 1000 });
    const own = radar.locator('.radar-room-dot[data-own="true"]');
    const other = radar.locator('.radar-room-dot[data-own="false"]');
    await expect(own).toContainText('Your room', { timeout: 25_000 });
    await expect(own).toContainText('2 listening');
    await expect(other).toHaveCount(1);
    await expect(other).toContainText('1 listening');
    await expect(own.locator('.radar-room-orbit i')).toHaveCount(2);
    await expect(other.locator('.radar-room-orbit i')).toHaveCount(1);
    await expect.poll(async () => (await planetVisuals(own)).size > (await planetVisuals(other)).size).toBe(true);
    await expect.poll(async () => (await planetVisuals(own)).glow > (await planetVisuals(other)).glow).toBe(true);
    await expect(own.locator('.radar-room-core img')).toBeVisible();
    await radar.getByTestId('room-galaxy').scrollIntoViewIfNeeded();
    await expect(own.locator('.radar-room-artist')).toBeVisible();
    await expect(own.getByRole('tooltip', { includeHidden: true })).toBeHidden();
    await expect(own).toHaveAccessibleDescription(/Radar host.*2 listening.*Worldwide/);
    // Leave room for the popup before moving the pointer. Otherwise hover's
    // automatic scroll can move the marker away from the pointer and dismiss
    // the popup before the second hover action reaches its metadata.
    await own.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
    await own.hover();
    const details = own.getByRole('tooltip');
    await expect(details).toContainText('2 listening');
    await expect(own.locator('.radar-room-host .lucide-globe')).toBeVisible();
    await details.hover({ timeout: 10_000 });
    await expect(details).toBeVisible();
    await host.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await radar.getByRole('heading', { name: 'Room galaxy' }).hover();
    await host.keyboard.press('Tab');
    await own.focus();
    await expect(details).toBeVisible();
    await radar.locator('.radar-stage').screenshot({ path: testInfo.outputPath('cover-galaxy-details.png') });
    await host.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(own).toBeFocused();
    await radar.getByRole('button', { name: 'Search settings' }).focus();
    // The center uses exactly the same mark geometry as the top-bar logo.
    const orbitShapes = (selector: string) => host.locator(selector).evaluate(element => element.innerHTML);
    expect(await orbitShapes('.radar-logo .brand-mark-orbit')).toBe(await orbitShapes('.topbar .brand-mark-orbit'));
    expect((await new AxeBuilder({ page: host }).include('.room-radar').analyze()).violations).toEqual([]);
    await host.screenshot({ path: testInfo.outputPath('cover-galaxy-desktop.png'), fullPage: true });
    await host.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await planetVisuals(own)).size > (await planetVisuals(other)).size).toBe(true);
    await host.screenshot({ path: testInfo.outputPath('cover-galaxy-mobile.png'), fullPage: true });
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await own.click();
    const preview = host.getByRole('dialog', { name: title });
    await expect(preview).toContainText('Hosted by you · Radar host');
    await expect(preview).toContainText('2 listening');
    await preview.getByRole('button', { name: 'Back to your room', exact: true }).click();
    await expect(host.getByTestId('room-code')).toHaveText(hostRoomCode);
    await guestContext.close();
    await host.getByRole('button', { name: 'Keep listening and browse', exact: true }).click();
    await rooms(host);
    // A real departure dims/shrinks the same planet on the next discovery read.
    await expect(own).toContainText('1 listening', { timeout: 35_000 });
    await expect.poll(async () => (await planetVisuals(own)).size).toBe((await planetVisuals(other)).size);
    await expect.poll(async () => (await planetVisuals(own)).glow).toBe((await planetVisuals(other)).glow);
  } finally {
    try {
      // A tab close now means reconnectable disconnect. Explicitly close these
      // rooms so grace-period invitations cannot contaminate the next case.
      for (const context of [hostContext, otherContext]) {
        const page = context.pages()[0];
        if (!page) continue;
        await page.keyboard.press('Escape');
        const dock = page.getByRole('button', { name: 'Room live', exact: true });
        if (await dock.isVisible()) await dock.click();
        const close = page.getByRole('button', { name: 'Close room', exact: true });
        if (!(await close.isVisible())) continue;
        await close.click();
        const confirm = page.getByRole('button', { name: 'Close for everyone', exact: true });
        await expect.poll(async () => !(await page.getByTestId('room-code').count()) || (await confirm.isVisible())).toBe(true);
        if (await confirm.isVisible()) await confirm.click();
        await expect(page.getByTestId('room-code')).toHaveCount(0);
      }
    } finally {
      await Promise.allSettled([hostContext.close(), otherContext.close(), guestContext.close()]);
    }
  }
});

test('room identity and reversible Hide update live without another scan', async ({ browser }, info) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const observerContext = await browser.newContext({ permissions: ['geolocation'], geolocation: fix });
  try {
    const host = await openHost(hostContext, 'Everyone');
    const observer = await observerContext.newPage();
    await observer.goto('/?e2eRoom=listener');
    const radar = await rooms(observer);
    await expect(radar.getByRole('heading', { name: title }).first()).toBeVisible();
    await host.getByRole('button', { name: /Who can find this room/ }).click();
    const settings = host.getByRole('dialog', { name: 'Who can find this room?' });
    await settings.getByText('Room name and invitation', { exact: true }).click();
    await settings.getByLabel('Room name (optional)', { exact: true }).fill('Escale à Libreville');
    await settings.getByLabel('A short invitation (optional)', { exact: true }).fill('Découvertes et discussion');
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(radar.getByRole('heading', { name: 'Escale à Libreville' })).toBeVisible({ timeout: 3000 });
    await radar.getByRole('button', { name: 'Escale à Libreville', exact: true }).click();
    await expect(observer.getByRole('dialog')).toContainText('Hosted by Radar host');
    await expect(observer.getByRole('dialog')).toContainText('Découvertes et discussion');
    await observer.screenshot({ path: info.outputPath('room-preview-desktop.png') });
    await observer.setViewportSize({ width: 390, height: 844 });
    await observer.screenshot({ path: info.outputPath('room-preview-mobile.png') });
    await observer.keyboard.press('Escape');
    await radar
      .locator('.nearby-room')
      .filter({ has: observer.getByRole('heading', { name: 'Escale à Libreville' }) })
      .getByLabel(`Options for ${title}`)
      .click();
    await radar.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(radar.getByRole('heading', { name: 'Escale à Libreville' })).toHaveCount(0);
    await radar.getByRole('button', { name: 'Hidden rooms (1)' }).click();
    await observer.getByRole('button', { name: 'Show again', exact: true }).click();
    await observer.keyboard.press('Escape');
    await expect(radar.getByRole('heading', { name: 'Escale à Libreville' })).toBeVisible();
    await host.getByRole('button', { name: 'Close room', exact: true }).click();
    await expect(radar.getByRole('heading', { name: 'Escale à Libreville' })).toHaveCount(0, { timeout: 3000 });
  } finally {
    await Promise.allSettled([hostContext.close(), observerContext.close()]);
  }
});
