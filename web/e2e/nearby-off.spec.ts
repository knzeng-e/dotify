import { expect, test } from '@playwright/test';

test('operational rollback exposes no Nearby UI and never requests location or sends nearby packets', async ({ page }) => {
  const packets: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      get() {
        throw new Error('Location accessed while feature off');
      }
    });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket =>
    socket.on('framesent', frame => {
      if (String(frame.payload).includes('nearby:')) packets.push(String(frame.payload));
    })
  );
  page.on('request', request => {
    if (request.postData()?.includes('nearby:')) packets.push(request.postData()!);
  });
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Listening rooms.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Room galaxy', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Open a room' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Nearby', exact: true })).toHaveCount(0);
  expect(packets).toEqual([]);
  expect(errors.filter(error => error.includes('Location accessed'))).toEqual([]);
});
