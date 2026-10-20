import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('verified artist seal is visible before hover and the room preview separates identities on mobile', async ({ page }, info) => {
  await page.goto('/?e2eRoom=listener');
  // UI-only server-result fixture. Server trust/announcement matching has its
  // own live-socket coverage in room-life.test.mjs; this does not forge a visit.
  await page.evaluate(async () => {
    const source = '/src/components/RoomRadar.tsx';
    const { RoomRadar } = await import(/* @vite-ignore */ source);
    const react = 'react',
      reactDom = 'react-dom/client';
    const { default: React } = await import(/* @vite-ignore */ '/node_modules/.vite/deps/' + react + '.js');
    const {
      default: { createRoot }
    } = await import(/* @vite-ignore */ '/node_modules/.vite/deps/' + reactDom.replace('/', '_') + '.js');
    const room = {
      roomId: 'ABC234',
      discoveryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      expiresInMs: 45000,
      hostName: 'Awa',
      title: 'Street scriptures',
      artist: 'Lord Ékomy Ndong',
      presence: '4–9',
      listenerCount: 5,
      imageRef: null,
      isFull: false,
      distanceBand: null,
      roomName: 'Escale à Libreville',
      introduction: 'Découvertes et discussion',
      artistPresent: true,
      connection: 'online',
      scope: 'worldwide',
      owner: {}
    };
    const off = { session: {}, state: { phase: 'off', results: [] } };
    const discovery = {
      nearby: { ...off, state: { phase: 'empty', results: [] } },
      worldwide: { ...off, state: { phase: 'active', results: [room] } },
      rooms: [room],
      radius: 5,
      paused: false,
      locationDenied: false,
      rangePending: false,
      hiddenRooms: [],
      retry: () => {}
    };
    document.querySelector('#root')?.remove();
    const container = document.createElement('main');
    container.style.cssText = 'max-width:1200px;padding:24px;margin:auto';
    document.body.append(container);
    createRoot(container).render(React.createElement(RoomRadar, { discovery, onJoin: () => {}, joining: false }));
  });
  const seal = page.locator('.radar-room-dot .room-artist-seal');
  await expect(seal).toBeVisible();
  await expect(page.locator('.radar-room-dot').getByRole('tooltip', { includeHidden: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath('artist-radar-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seal).toBeVisible();
  await page.screenshot({ path: info.outputPath('artist-radar-mobile.png'), fullPage: true });
  await page.locator('.radar-room-dot').click();
  await expect(page.getByRole('dialog')).toContainText('Hosted by Awa');
  await expect(page.getByRole('dialog')).toContainText('Artist: Lord Ékomy Ndong');
  await expect(page.getByRole('dialog')).toContainText('Artist here');
  expect((await new AxeBuilder({ page }).include('.radar-room-preview').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('artist-preview-mobile.png') });
});
