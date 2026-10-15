import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('opt-in nearby discovery reaches real guest audio, clears on background and falls back after denial', async ({ browser }, testInfo) => {
  test.setTimeout(80_000);
  const hostContext = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 0.392, longitude: 9.454, accuracy: 100 } });
  const guestContext = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 0.395, longitude: 9.456, accuracy: 100 },
    viewport: { width: 390, height: 844 }
  });
  const packets: string[] = [];
  const capture = (page: Page) => {
    page.on('websocket', socket =>
      socket.on('framesent', frame => {
        if (String(frame.payload).includes('nearby:')) packets.push(String(frame.payload));
      })
    );
    page.on('request', request => {
      const body = request.postData();
      if (body?.includes('nearby:')) packets.push(body);
    });
  };
  try {
    const host = await hostContext.newPage();
    capture(host);
    await host.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
    await host.getByRole('button', { name: 'Open a room' }).click();
    await expect(host.getByRole('switch', { name: 'Visible nearby' })).not.toBeChecked();
    await host.getByRole('button', { name: 'Select E2E Protected Room Track' }).click();
    await host.getByLabel('Your name in the room').fill('Nearby host');
    await host.getByRole('button', { name: 'Open the room' }).click();
    await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15_000 });
    await host.getByRole('tab', { name: /People/ }).click();
    const hostNearby = host.getByRole('region', { name: 'Visible nearby', exact: true });
    await expect(hostNearby).toContainText('Off.');

    const guest = await guestContext.newPage();
    capture(guest);
    await guest.goto('/?e2eRoom=listener');
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    const nearby = guest.getByRole('region', { name: 'Nearby', exact: true });
    await nearby.getByRole('slider', { name: 'Search range' }).focus();
    await guest.keyboard.press('ArrowRight');
    await expect(nearby.getByRole('slider', { name: 'Search range' })).toHaveAttribute('aria-valuetext', 'About 10 kilometres');
    await guest.keyboard.press('ArrowLeft');
    await expect(nearby.getByRole('slider', { name: 'Search range' })).toHaveAttribute('aria-valuetext', 'About 5 kilometres');
    expect(packets).toEqual([]);
    await guestContext.setGeolocation({ latitude: 0.395, longitude: 9.456, accuracy: 100 });
    await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
    await expect(nearby).toContainText('No visible rooms');
    await nearby.getByRole('button', { name: 'Stop', exact: true }).click();
    await hostContext.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
    await hostNearby.getByRole('switch', { name: 'Visible nearby' }).check();
    await expect(hostNearby).toContainText('Visible nearby · about 5 km');
    await guestContext.setGeolocation({ latitude: 0.395, longitude: 9.456, accuracy: 100 });
    await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
    await expect(nearby.getByRole('heading', { name: 'E2E Protected Room Track' })).toBeVisible();
    expect((await new AxeBuilder({ page: guest }).include('.nearby-panel').analyze()).violations).toEqual([]);
    await guest.screenshot({ path: testInfo.outputPath('nearby-mobile.png'), fullPage: true });
    await guest.setViewportSize({ width: 1440, height: 1000 });
    await guest.screenshot({ path: testInfo.outputPath('nearby-desktop.png'), fullPage: true });
    await guest.setViewportSize({ width: 390, height: 844 });
    await hostNearby.screenshot({ path: testInfo.outputPath('nearby-host.png') });
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const start = Date.now();
    await nearby.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByLabel('Your name in the room').fill('Nearby guest');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
    await expect.poll(async () => guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.remotePlaybackCues ?? 0), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
    // The browser has a live remote audio stream. Measure signal energy rather
    // than asserting physical loudspeaker output from a headless test.
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
      const amplitude = Math.max(...samples) - Math.min(...samples);
      source.disconnect();
      await context.close();
      return amplitude;
    });
    expect(energy).toBeGreaterThan(0);
    await testInfo.attach('nearby-round-trip.json', {
      body: JSON.stringify({ joinToAudioMs: Date.now() - start, audioAmplitude: energy, guestKeyRequests: 0 }),
      contentType: 'application/json'
    });
    await host.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(hostNearby).toContainText('Nearby paused');
    await host.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(hostNearby.getByRole('switch', { name: 'Visible nearby' })).not.toBeChecked();
    await guest.getByRole('button', { name: 'Keep listening and browse' }).click();
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
    await expect(nearby).toContainText('No visible rooms');
    // No exact fix, label, credential, or list of cells on outbound Nearby packets.
    expect(packets.some(packet => packet.includes('nearby:publish'))).toBe(true);
    expect(packets.join('\n')).not.toMatch(/latitude|longitude|accuracy|0\.392|9\.454|wallet|areaCells/);
    expect(await guest.evaluate(() => JSON.stringify([Object.values(localStorage), Object.values(sessionStorage)]))).not.toMatch(/n2:|0\.395|9\.456/);
    await guestContext.clearPermissions();
    await guestContext.grantPermissions([]);
    await guest.reload();
    await guest.getByRole('button', { name: 'Rooms', exact: true }).click();
    await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
    await expect(nearby).toContainText(/Location is off|location took too long/);
    await nearby.getByText('Explore a city', { exact: true }).click();
    await nearby.getByLabel('City centre · starter areas').selectOption('Libreville');
    await nearby.getByRole('button', { name: 'Explore this city' }).click();
    await expect(nearby).toContainText('No visible rooms');
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close()]);
  }
});

test('room creation keeps visibility off by default and only starts the chosen range after opening', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  const publications: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:publish')) publications.push(String(frame.payload));
    })
  );
  await page.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open a room' });
  const visibility = dialog.getByRole('switch', { name: 'Visible nearby' });
  await expect(visibility).not.toBeChecked();
  await visibility.check();
  const range = dialog.getByRole('slider', { name: 'Visibility range' });
  await range.focus();
  await page.keyboard.press('ArrowRight');
  await expect(range).toHaveAttribute('aria-valuetext', 'About 10 kilometres');
  await dialog.screenshot({ path: testInfo.outputPath('create-room-visible-nearby.png') });
  expect(publications).toEqual([]);
  await dialog.getByRole('button', { name: 'Select E2E Protected Room Track' }).click();
  await dialog.getByLabel('Your name in the room').fill('Radar host');
  await dialog.getByRole('button', { name: 'Open the room' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15_000 });
  await page.getByRole('tab', { name: /People/ }).click();
  const nearby = page.getByRole('region', { name: 'Visible nearby', exact: true });
  await expect(nearby).toContainText('Visible nearby · about 10 km');
  await expect(nearby.getByRole('slider', { name: 'Visibility range' })).toHaveAttribute('aria-valuetext', 'About 10 kilometres');
  await expect(nearby.getByRole('switch', { name: 'Visible nearby' })).toBeChecked();
  expect(publications).toHaveLength(1);
  expect(publications[0]).toContain('"radiusKm":10');
  await nearby.getByRole('switch', { name: 'Visible nearby' }).uncheck();
  await expect(nearby).toContainText('no longer visible nearby');
  expect((await new AxeBuilder({ page }).include('.nearby-panel').analyze()).violations).toEqual([]);
  await nearby.getByText('Choose an area', { exact: true }).click();
  await nearby.getByLabel('City centre · starter areas').selectOption('Libreville');
  await nearby.getByRole('button', { name: 'Show around this city' }).click();
  await expect(nearby).toContainText('Visible around Libreville centre.');
  await expect(nearby).toContainText('about 10 km');
});
