import { expect, test, type Page } from '@playwright/test';

const PUBLIC_TITLE = 'E2E Public Room Track';

async function openPublicRoom(page: Page) {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room' }).click();
  await page.getByRole('button', { name: `Select ${PUBLIC_TITLE}` }).click();
  await page.getByRole('button', { name: 'Open the room' }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/, { timeout: 15_000 });
  return (await roomCode.textContent())?.trim() ?? '';
}

async function openRoomsTab(page: Page, roomId: string) {
  await page.getByRole('button', { name: 'Rooms' }).click();
  await expect(page.getByRole('heading', { name: 'Happening now' })).toBeVisible();
  const roomCard = page.locator('.room-live-card').filter({ hasText: roomId }).first();
  await expect(roomCard).toBeVisible();
  return roomCard;
}

test('room discovery exposes an inspection panel beside the desktop list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('sky-of-rooms')).toBeVisible();
  await roomCard.click();

  const panel = page.getByTestId('room-detail-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(PUBLIC_TITLE);
  await expect(panel.getByRole('button', { name: 'Join room' })).toBeVisible();
  await expect(page.getByTestId('room-detail-sheet')).toBeHidden();

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.rooms-discovery-main')?.getBoundingClientRect();
    const detail = document.querySelector<HTMLElement>('.room-detail-panel')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mainRight: main?.right ?? 0,
      detailLeft: detail?.left ?? 0
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.detailLeft).toBeGreaterThan(layout.mainRight);
});

test('room discovery uses a touch-safe inspection sheet above mobile playback controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('sky-of-rooms')).toBeHidden();
  await roomCard.click();

  const sheet = page.getByTestId('room-detail-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(PUBLIC_TITLE);
  await expect(page.locator('.player-dock')).toBeVisible();

  const layout = await page.evaluate(() => {
    const join = document.querySelector<HTMLElement>('.room-detail-sheet .room-detail-join')?.getBoundingClientRect();
    const sheet = document.querySelector<HTMLElement>('.room-detail-sheet')?.getBoundingClientRect();
    const dock = document.querySelector<HTMLElement>('.player-dock')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      joinHeight: join?.height ?? 0,
      sheetBottom: sheet?.bottom ?? 0,
      dockTop: dock?.top ?? window.innerHeight
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.joinHeight).toBeGreaterThanOrEqual(44);
  expect(layout.sheetBottom).toBeLessThanOrEqual(layout.dockTop + 1);
});
