import { expect, test, type Page } from '@playwright/test';

const PUBLIC_TITLE = 'E2E Public Room Track';

declare global {
  interface Window {
    __DOTIFY_ROOM_GALAXY__?: {
      snapshot: () => {
        status: string;
        roomCount: number;
        visibleOverlayCount: number;
        frameCount: number;
        pixelRatio: number;
        paused: boolean;
      };
    };
  }
}

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

async function expectGalaxyReady(page: Page) {
  await expect(page.getByTestId('room-galaxy-scene')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const snapshot = window.__DOTIFY_ROOM_GALAXY__?.snapshot();
        if (!snapshot) return 'missing';
        return `${snapshot.status}:${snapshot.roomCount >= 1}:${snapshot.visibleOverlayCount >= 1}:${snapshot.frameCount > 0}`;
      })
    )
    .toBe('ready:true:true:true');
}

async function expectGalaxyCanvasPainted(page: Page) {
  const paintedPixels = await page.getByTestId('room-galaxy-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const sample = document.createElement('canvas');
    sample.width = 96;
    sample.height = 64;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return 0;
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let painted = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) painted += 1;
    }
    return painted;
  });

  expect(paintedPixels).toBeGreaterThan(24);
}

async function disableWebGl(page: Page) {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContextWithDisabledWebGl(type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return nativeGetContext.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test('room discovery exposes an inspection panel beside the desktop list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('sky-of-rooms')).toBeVisible();
  await page.getByRole('button', { name: '3D' }).click();
  await expectGalaxyReady(page);
  await expectGalaxyCanvasPainted(page);
  await expect(page.getByRole('button', { name: `Join room ${roomId}` })).toBeVisible();
  await page.getByTestId('room-galaxy-scene').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('+');
  await page.keyboard.press('Home');
  await expectGalaxyReady(page);
  await page.getByTestId('room-galaxy-canvas').dispatchEvent('webglcontextlost');
  await expect(page.getByTestId('sky-of-rooms')).toBeVisible();
  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('sky-of-rooms')).toBeVisible();
  await page.getByRole('button', { name: '3D' }).click();
  await expectGalaxyReady(page);
  await expectGalaxyCanvasPainted(page);

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

test('room discovery falls back to the 2D sky when WebGL is unavailable', async ({ page }) => {
  await disableWebGl(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('sky-of-rooms')).toBeVisible();
  await roomCard.click();
  await expect(page.getByTestId('room-detail-panel')).toContainText(PUBLIC_TITLE);
});

test('room discovery keeps the card grid usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('room-galaxy-scene')).toBeHidden();
  await expect(page.getByTestId('sky-of-rooms')).toBeHidden();
  await expect(roomCard).toBeVisible();
  await roomCard.click();
  await expect(page.getByTestId('room-detail-panel').getByRole('button', { name: 'Join room' })).toBeVisible();
});

test('room discovery uses a touch-safe inspection sheet above mobile playback controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const roomId = await openPublicRoom(page);
  const roomCard = await openRoomsTab(page, roomId);

  await expect(page.getByTestId('sky-of-rooms')).toBeHidden();
  await roomCard.focus();
  await page.keyboard.press('Enter');

  const sheet = page.getByTestId('room-detail-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(PUBLIC_TITLE);
  await expect(page.locator('.player-dock')).toBeVisible();
  const closeButton = sheet.getByRole('button', { name: 'Close room details' });
  await expect(closeButton).toBeFocused();

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

  await page.keyboard.press('Enter');
  await expect(sheet).toBeHidden();
  await expect(roomCard).toBeFocused();
});
