import { expect, test, type Page } from '@playwright/test';

async function navigate(page: Page, name: 'Music' | 'Rooms', width: number) {
  const nav = width <= 768 ? page.locator('.bottom-nav') : page.locator('.topbar');
  await nav.getByRole('button', { name, exact: true }).click();
}

for (const width of [320, 390, 1440]) {
  test(`room dock follows the host instead of the last solo selection at ${width}px`, async ({ browser }, testInfo) => {
    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const guestContext = await browser.newContext({ viewport: { width, height: 844 } });
    try {
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();
      const fixture = '/?e2eRoom=public&e2eSync=on&e2eCatalog=sequence&e2eAutoplay=on';
      await host.goto(fixture);
      await host.getByRole('button', { name: 'Open a room', exact: true }).click();
      await host.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
      await host.getByLabel('Your name in the room').fill('Live host');
      await host.getByRole('button', { name: 'Open the room', exact: true }).click();
      const code = host.getByTestId('room-code');
      await expect(code).toHaveText(/[A-Z0-9]{4,}/);
      const roomId = (await code.innerText()).trim();
      await expect(host.locator('.transport-play')).toHaveAttribute('aria-label', 'Pause');
      // Retain a different selection in the same document before joining.
      await guest.goto(fixture);
      await guest.getByRole('button', { name: /^Play Second room track by/ }).click();
      await expect(guest.locator('.track-copy h2')).toHaveText('Second room track');
      await navigate(guest, 'Music', width);
      const dock = guest.locator('.player-dock');
      await expect(dock.locator('.player-dock-title')).toHaveText('Second room track');
      await expect(dock.locator('.player-dock-room')).toHaveCount(0);
      await navigate(guest, 'Rooms', width);
      await guest.getByLabel('Room code or link').fill(roomId);
      await guest.getByRole('button', { name: 'Join', exact: true }).click();
      await guest.getByLabel('Your name in the room').fill('Live guest');
      await guest.getByRole('button', { name: 'Enter and listen', exact: true }).click();
      await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20_000 });
      const roomCover = await guest.locator('.cover img').getAttribute('src');
      await guest.evaluate(() => Reflect.set(window, '__dockRemoteStream', document.querySelectorAll<HTMLAudioElement>('audio')[1].srcObject));
      await navigate(guest, 'Music', width);
      await expect(dock.locator('.player-dock-title')).toHaveText('E2E Public Room Track');
      await expect(dock.locator('.player-dock-art img')).toHaveAttribute('src', roomCover!);
      const context = dock.getByRole('button', { name: 'Return to room · Room live · 2 people including you', exact: true });
      await expect(context).toBeVisible();
      for (const name of ['Next track', 'Previous track', 'Shuffle', 'Repeat this track']) {
        await expect(dock.getByRole('button', { name, exact: true })).toHaveCount(0);
      }
      await expect(dock.locator('input[type=range]')).toBeDisabled();
      await guest.screenshot({ path: testInfo.outputPath('room-dock.png') });
      expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await host.getByRole('button', { name: 'Next track', exact: true }).click();
      await expect(dock.locator('.player-dock-title')).toHaveText('Second room track');
      await expect(context).toBeVisible();
      await host.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(dock.locator('.player-dock-room')).toContainText('Host paused');
      await expect(dock.locator('.live-dot')).toHaveAttribute('data-online', 'false');
      await host.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(context).toBeVisible();
      await navigate(guest, 'Rooms', width);
      await expect(dock.locator('.player-dock-title')).toHaveText('Second room track');
      await context.click();
      await expect(guest.getByTestId('room-code')).toHaveText(roomId);
      await expect(guest.locator('.track-copy h2')).toHaveText('Second room track');
      expect(await guest.evaluate(() => Reflect.get(window, '__dockRemoteStream') === document.querySelectorAll<HTMLAudioElement>('audio')[1].srcObject)).toBe(
        true
      );
      await expect(guest.locator('#room-panel-chat .room-chat-panel')).toContainText('2 here');
      await navigate(host, 'Music', 1440);
      await expect(host.locator('.player-dock-room')).toContainText('Hosting live');
      await expect(host.locator('.player-dock-presence')).toHaveText('2');
      await expect(host.locator('.player-dock').getByRole('button', { name: 'Next track', exact: true })).toBeEnabled();
      await host.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
      await expect(guest.locator('.track-copy h2')).toHaveText('E2E Public Room Track');
      if (width <= 768) await guest.getByRole('tab', { name: /People/ }).click();
      await guest.getByRole('button', { name: 'Leave', exact: true }).click();
      await expect(guest.locator('.track-copy h2')).toHaveText('Second room track');
      await navigate(host, 'Music', 1440);
      await expect(host.locator('.player-dock-presence')).toHaveText('1');
      await navigate(guest, 'Music', width);
      await expect(guest.locator('.player-dock-room')).toHaveCount(0);
      await expect(dock.locator('.player-dock-title')).toHaveText('Second room track');
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });
}
