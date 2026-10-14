import { expect, test } from '@playwright/test';

test('ordinary builds expose no Nearby UI and never request location or send nearby packets', async ({ page }) => {
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
  await expect(page.getByRole('region', { name: 'Nearby', exact: true })).toHaveCount(0);
  expect(packets).toEqual([]);
  expect(errors.filter(error => error.includes('Location accessed'))).toEqual([]);
});
