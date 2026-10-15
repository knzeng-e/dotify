import { expect, test } from '@playwright/test';

test('Product permission gates a real browser fix; city exploration stays a separate explicit choice', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  await page.addInitScript(() => {
    Object.assign(window, { __HOST_WEBVIEW_MARK__: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const nearbyPackets: string[] = [];
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:')) nearbyPackets.push(String(frame.payload));
    })
  );
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const nearby = page.getByRole('region', { name: 'Nearby', exact: true });
  await expect(nearby.getByRole('button', { name: 'Find rooms near me' })).toBeEnabled();
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(0);
  expect(nearbyPackets).toEqual([]);
  await page.evaluate(() => {
    window.identityFixture.locationGranted = false;
  });
  await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
  await expect(nearby).toContainText('Location is off');
  expect(nearbyPackets).toEqual([]);
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(1);
  await expect(nearby.getByLabel('City centre · starter areas')).not.toBeVisible();
  await page.evaluate(() => {
    window.identityFixture.locationGranted = true;
  });
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  await nearby.getByRole('button', { name: 'Find rooms near me' }).click();
  await expect(nearby).toContainText('No visible rooms');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(2);
  expect(await page.evaluate(() => window.identityFixture.requests)).toBe(0);
  await expect(nearby.getByRole('button', { name: 'Update my location' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('product-nearby-current-position.png'), fullPage: true });
  expect(nearbyPackets.join('\n')).not.toMatch(/latitude|longitude|accuracy|0\.392|9\.454|wallet/);
  await nearby.getByRole('button', { name: 'Stop', exact: true }).click();
  await nearby.getByText('Explore a city', { exact: true }).click();
  await expect(nearby).toContainText('not your current location');
  await nearby.getByLabel('City centre · starter areas').selectOption('Libreville');
  await nearby.getByRole('button', { name: 'Explore this city', exact: true }).click();
  await expect(nearby).toContainText('No visible rooms');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(2);
  await expect(nearby).toContainText('Libreville centre');
  // Editing another city is only a draft. Changing the active search range
  // must not silently move the search or request device location again.
  await nearby.getByLabel('City centre · starter areas').selectOption('Paris');
  await nearby.getByRole('slider', { name: 'Search range' }).focus();
  await page.keyboard.press('ArrowRight');
  await nearby.getByRole('button', { name: 'Apply range', exact: true }).click();
  await expect(nearby).toContainText('Libreville centre');
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('product-nearby-city-separation.png'), fullPage: true });
});

test('Product without observable browser permission offers no location prompt or automatic city search', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __HOST_WEBVIEW_MARK__: true });
    Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });
  });
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const nearby = page.getByRole('region', { name: 'Nearby', exact: true });
  await expect(nearby.getByRole('button', { name: 'Find rooms near me' })).toHaveCount(0);
  await expect(nearby).toContainText('Location is unavailable');
  await expect(nearby.getByLabel('City centre · starter areas')).not.toBeVisible();
  expect(await page.evaluate(() => window.identityFixture.locationRequests)).toBe(0);
  await expect(nearby).toContainText('Search is off');
});
