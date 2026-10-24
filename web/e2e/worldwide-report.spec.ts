import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const signalUrl = 'http://127.0.0.1:8789';
const title = 'E2E Protected Room Track';

// Both transports carry Engine.IO text packets; polling can batch them with RS.
// Observe the public wire rather than trusting local Hide state as a Report ack.
function socketEvents(body: string) {
  return body.split('\x1e').flatMap(packet => {
    const start = packet.indexOf('[');
    if (start < 0) return [];
    try {
      const value: unknown = JSON.parse(packet.slice(start));
      return Array.isArray(value) ? [value] : [];
    } catch {
      return [];
    }
  });
}
function observeDiscovery(page: Page) {
  const reportPayloads: unknown[] = [];
  const discoveryIds = new Map<string, string>();
  const sent = (body: string) => {
    for (const event of socketEvents(body)) if (event[0] === 'nearby:report') reportPayloads.push(event[1]);
  };
  const received = (body: string) => {
    for (const event of socketEvents(body)) {
      for (const value of event) {
        const reply = value?.reply ?? value;
        if (Array.isArray(reply?.results))
          for (const room of reply.results) if (typeof room.roomId === 'string') discoveryIds.set(room.roomId, room.discoveryId);
      }
    }
  };
  page.on('websocket', socket => {
    socket.on('framesent', frame => sent(String(frame.payload)));
    socket.on('framereceived', frame => received(String(frame.payload)));
  });
  page.on('request', request => {
    if (request.url().startsWith(`${signalUrl}/socket.io/`)) sent(request.postData() ?? '');
  });
  page.on('response', response => {
    if (response.url().startsWith(`${signalUrl}/socket.io/`))
      void response
        .text()
        .then(received)
        .catch(() => {});
  });
  return { reportPayloads, discoveryIds };
}
async function openRadar(page: Page, product = false) {
  if (product) await page.addInitScript(() => Object.assign(window, { __HOST_WEBVIEW_MARK__: true }));
  // Worldwide must work without obtaining a position. Only the local fixtures
  // are changed; neither this test nor its assertions query a real location.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'denied' }) }, configurable: true });
  });
  await page.goto(product ? '/e2e/fixtures/product-host.html?e2eRoom=listener&location=denied' : '/?e2eRoom=listener');
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  return page.getByRole('region', { name: 'Room galaxy', exact: true });
}

// Reports share an anonymous server counter. Keep these cases sequential so a
// +1 assertion proves exactly one accepted report, not a concurrent case's send.
test.describe.configure({ mode: 'serial' });
for (const surface of ['Web', 'Product fixture'] as const) {
  test(`${surface}: Worldwide Report reaches the server, hides locally and can be undone`, async ({ browser, request }) => {
    test.setTimeout(60000);
    const hostContext = await browser.newContext();
    const reporterContext = await browser.newContext({ viewport: surface === 'Web' ? { width: 1440, height: 1000 } : { width: 390, height: 844 } });
    const observerContext = await browser.newContext();
    const host = await hostContext.newPage();
    try {
      await host.goto('/?e2eRoom=protected-authorized&e2eSync=on&e2eAutoplay=on');
      await host.getByRole('button', { name: 'Open a room', exact: true }).click();
      await host.getByRole('button', { name: `Select ${title}` }).click();
      const hostName = `${surface} report host`;
      await host.getByLabel('Your name or nickname').fill(hostName);
      await host.getByRole('radio', { name: 'Everyone', exact: true }).check();
      await host.getByRole('button', { name: 'Open the room' }).click();
      await expect(host.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/, { timeout: 15000 });
      const roomId = (await host.getByTestId('room-code').innerText()).trim();
      const reporter = await reporterContext.newPage();
      const wire = observeDiscovery(reporter);
      const radar = await openRadar(reporter, surface === 'Product fixture');
      const card = radar.getByRole('list', { name: 'Discovered rooms' }).getByRole('listitem').filter({ hasText: hostName });
      await expect(card).toContainText('Worldwide', { timeout: 20000 });
      await expect.poll(() => wire.discoveryIds.get(roomId)).toMatch(/^[a-f0-9-]{36}$/);
      const reports = async () => {
        const response = await request.get(`${signalUrl}/health`);
        expect(response.ok()).toBe(true);
        return (await response.json()).nearby.reports as number;
      };
      const before = await reports();
      const observer = await observerContext.newPage();
      const otherRadar = await openRadar(observer);
      const otherCard = otherRadar.getByRole('list', { name: 'Discovered rooms' }).getByRole('listitem').filter({ hasText: hostName });
      await expect(otherCard).toBeVisible({ timeout: 20000 });

      await card.getByLabel(`Options for ${title}`).press('Enter');
      const report = card.getByRole('button', { name: 'Report', exact: true });
      await report.click();
      await expect(report).toHaveAttribute('aria-expanded', 'true');
      await expect(card).toContainText('No moderator is notified');
      expect((await new AxeBuilder({ page: reporter }).include('.room-radar').analyze()).violations).toEqual([]);
      // Opening/closing the reason picker is not a submission or a Hide action.
      await report.click();
      await expect(report).toHaveAttribute('aria-expanded', 'false');
      await expect(card).toBeVisible();
      expect(wire.reportPayloads).toEqual([]);
      expect(await reports()).toBe(before);
      await report.click();
      await card.getByRole('button', { name: 'misleading', exact: true }).click();
      await expect(card).toHaveCount(0);
      await expect(radar.locator('.radar-room-dot').filter({ hasText: hostName })).toHaveCount(0);
      await expect.poll(reports).toBe(before + 1);
      expect(wire.reportPayloads).toEqual([{ discoveryId: wire.discoveryIds.get(roomId), reason: 'misleading' }]);
      await expect(otherCard).toBeVisible();
      await expect(host.getByTestId('room-code')).toHaveText(roomId);

      await radar.getByRole('button', { name: 'Hidden rooms (1)', exact: true }).click();
      const hidden = reporter.getByRole('dialog', { name: 'Hidden rooms' });
      await hidden.getByRole('button', { name: 'Show again', exact: true }).click();
      await hidden.getByRole('button', { name: 'Close hidden rooms', exact: true }).click();
      await expect(card).toBeVisible();
      await expect(radar.locator('.radar-room-dot').filter({ hasText: hostName })).toBeVisible();
      expect(wire.reportPayloads).toHaveLength(1);
      expect(await reports()).toBe(before + 1);
      if (surface === 'Product fixture') expect(await reporter.evaluate(() => window.identityFixture.requests)).toBe(0);

      // The anonymous signal is not a global ban: another person can still join
      // the genuine room and receive its protected WebRTC stream without keys.
      await otherCard.getByRole('button', { name: 'Join', exact: true }).click();
      await observer.getByLabel('Your name or nickname').fill('Unblocked guest');
      await observer.getByRole('button', { name: 'Join room', exact: true }).click();
      await expect(observer.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
      expect(await observer.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests)).toBe(0);
    } finally {
      try {
        if (await host.getByRole('button', { name: 'Close room', exact: true }).isVisible()) {
          await host.getByRole('button', { name: 'Close room', exact: true }).click();
          const confirm = host.getByRole('button', { name: 'Close for everyone', exact: true });
          await expect.poll(async () => !(await host.getByTestId('room-code').count()) || (await confirm.isVisible())).toBe(true);
          if (await confirm.isVisible()) await confirm.click();
          await expect(host.getByTestId('room-code')).toHaveCount(0);
        }
      } finally {
        await Promise.allSettled([hostContext.close(), reporterContext.close(), observerContext.close()]);
      }
    }
  });
}
