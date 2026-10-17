import { expect, test } from '@playwright/test';

test('Product starts automatically, respects denial and requires a purposeful retry', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  await page.addInitScript(() => Object.assign(window, { __HOST_WEBVIEW_MARK__: true }));
  const nearbyPackets: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:') && !String(frame.payload).includes('worldwide')) nearbyPackets.push(String(frame.payload));
    })
  );
  page.on('request', request => {
    const body = request.postData();
    if (body?.includes('nearby:') && !body.includes('worldwide')) nearbyPackets.push(body);
  });
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=listener&location=denied');
  await expect.poll(() => page.evaluate(() => window.identityFixture.locationRequests)).toBe(1);
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const radar = page.getByRole('region', { name: 'Room galaxy' });
  await expect(radar).toContainText('Location access was not granted');
  expect(nearbyPackets).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(1);
  await page.evaluate(() => {
    window.identityFixture.locationGranted = true;
  });
  // A failed grant remains recoverable after foregrounding.
  await radar.getByRole('button', { name: 'Try location again' }).click();
  await expect(radar).toContainText('Around you · about 5 km');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(2);
  expect(await page.evaluate(() => window.identityFixture.requests)).toBe(0);
  expect(nearbyPackets.join('\n')).not.toMatch(/latitude|longitude|accuracy|0\.392|9\.454|wallet/);
  await page.setViewportSize({ width: 390, height: 844 });
  await radar.getByRole('button', { name: 'Search settings' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('slider', { name: 'Search range' }).fill('42');
  await page.screenshot({ path: testInfo.outputPath('product-radar-settings.png'), fullPage: true });
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(() => nearbyPackets.some(packet => packet.includes('"radiusKm":42')), { timeout: 15_000 }).toBe(true);
  await expect(page.getByText('Explore a city', { exact: true })).toHaveCount(0);
});

test('Product async grant wins over the false Electron query and is rechecked before renewal', async ({ page, context }) => {
  test.setTimeout(45_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  await page.addInitScript(() => {
    Object.assign(window, { __HOST_WEBVIEW_MARK__: true });
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'denied' }) }, configurable: true });
  });
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const radar = page.getByRole('region', { name: 'Room galaxy' });
  await expect(radar).toContainText('Around you · about 5 km');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(1);
  await page.evaluate(() => {
    window.identityFixture.locationGranted = false;
  });
  await expect(radar).toContainText('Location access was not granted', { timeout: 20_000 });
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(2);
  expect(await page.evaluate(() => window.identityFixture.requests)).toBe(0);
});

test('a Host grant without native coordinates stays unavailable and does not invent a location', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __HOST_WEBVIEW_MARK__: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (_ok: PositionCallback, error?: PositionErrorCallback) => {
          queueMicrotask(() => error?.({ code: 2, message: 'Native location bridge unavailable' } as GeolocationPositionError));
          return 1;
        },
        clearWatch: () => {}
      }
    });
  });
  const searches: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      const message = String(frame.payload);
      if (message.includes('nearby:search') && message.includes('radiusKm')) searches.push(message);
    })
  );
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const radar = page.getByRole('region', { name: 'Room galaxy' });
  await expect(radar).toContainText('Your Polkadot app could not return a location');
  await expect(radar).toContainText('worldwide rooms');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(1);
  expect(searches).toEqual([]);
});
