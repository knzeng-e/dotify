import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Catalog hover prefetch can inspect the two synthetic protected entries.
  // They have no real manifests; do not depend on external gateway CORS/uptime.
  for (const root of ['QmafmXF11dKMXto7s39giJoRBJdZ3yvVtYx5fCCEVnW3qF', 'Qm5xzsjUGVDnGMtfq5NAwBBGxVEJnkiYjMtHPTtv9qz855']) {
    await page.route(`**/ipfs/${root}/manifest.json`, route =>
      route.fulfill({ status: 404, json: { error: 'Synthetic manifest unavailable' }, headers: { 'access-control-allow-origin': '*' } })
    );
  }
});
async function solo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: /^Open E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect(page.locator('.player-stage')).toBeVisible();
  const audio = page.locator('audio').first();
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => !node.paused)).toBe(true);
  await audio.evaluate(node => Reflect.set(node, '__motionIdentity__', true));
  return audio;
}
async function expectSource(page: Page) {
  expect(
    await page
      .locator('audio')
      .first()
      .evaluate(node => Reflect.get(node, '__motionIdentity__'))
  ).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((node: HTMLAudioElement) => !node.paused)
    )
    .toBe(true);
}

test('player expands and collapses without replacing or pausing the persistent source', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await solo(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
    await expect(page.locator('.player-dock')).toBeVisible();
    await expectSource(page);
    await page.locator('.player-dock-art').click();
    await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
    await expectSource(page);
  }
  await expect.poll(() => page.locator('html').getAttribute('data-player-motion')).toBeNull();
  expect(errors).toEqual([]);
});

test('queue sheet closes through drag, Escape and Back while retaining focus and audio', async ({ page }, testInfo) => {
  await solo(page);
  const trigger = page.getByRole('button', { name: 'Queue', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Queue', exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('E2E Public Room Track', { exact: true })).toBeVisible();
  await expectSource(page);
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(845);
  expect((await sheet.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('queue-sheet.png') });
  const handle = sheet.getByRole('button', { name: 'Collapse queue' }),
    h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 35, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await handle.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Collapse queue' }).hover();
  const handle2 = (await page.getByRole('button', { name: 'Collapse queue' }).boundingBox())!;
  await page.mouse.move(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2);
  await page.mouse.down();
  await expect(sheet).toHaveAttribute('data-pulling', 'true');
  await page.mouse.move(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2 + 110, { steps: 6 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  await expectSource(page);
  await trigger.click();
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.player-stage')).toBeVisible();
  await expectSource(page);
});

test('reduced motion and missing transition APIs preserve immediate player navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
  });
  await solo(page);
  await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
  await page.locator('.player-dock-art').click();
  await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
  expect(await page.locator('html').getAttribute('data-player-motion')).toBeNull();
  await expectSource(page);
});

test('minimizing a live room retains membership and the same host audio source', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name or nickname').fill('Motion host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const code = await page.getByTestId('room-code').innerText();
  await expect
    .poll(() =>
      page
        .locator('audio')
        .first()
        .evaluate((node: HTMLAudioElement) => !node.paused)
    )
    .toBe(true);
  await page
    .locator('audio')
    .first()
    .evaluate(node => Reflect.set(node, '__motionIdentity__', true));
  await page.getByRole('button', { name: 'Keep listening and browse' }).click();
  await expect(page.locator('.player-dock')).toBeVisible();
  await expectSource(page);
  await page.locator('.player-dock-art').click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await expectSource(page);
});

for (const newerIntent of ['tab', 'back'] as const) {
  test(`delayed player capture cannot override a newer ${newerIntent} navigation or push history`, async ({ page }) => {
    await solo(page);
    await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-player-motion');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: 'Rooms', exact: true }).click();
    await nav.getByRole('button', { name: 'Music', exact: true }).click();
    // Hold the browser snapshot deterministically, then deliver its callback
    // after the newer route. No production timing switch is introduced.
    await page.evaluate(() => {
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          let finish!: () => void;
          const done = new Promise<void>(resolve => {
            finish = resolve;
          });
          Reflect.set(window, '__releasePlayerCapture__', () => {
            update();
            finish();
          });
          return { ready: Promise.resolve(), finished: done, updateCallbackDone: done, skipTransition() {} };
        }
      });
    });
    await page.locator('.player-dock-art').click();
    await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'open');
    const destination = newerIntent === 'tab' ? 'you' : 'rooms';
    if (newerIntent === 'tab') await nav.getByRole('button', { name: 'You', exact: true }).click();
    else await page.goBack();
    await expect(page.locator(`.content-${destination}`)).toBeVisible();
    const entries = await page.evaluate(() => history.length);
    await page.evaluate(() => Reflect.get(window, '__releasePlayerCapture__')());
    await expect(page.locator(`.content-${destination}`)).toBeVisible();
    await expect(page.locator('.player-stage')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-player-motion');
    expect(await page.evaluate(() => history.length)).toBe(entries);
    expect(await page.evaluate(() => history.state.dotifyView)).toBe(destination);
    if (newerIntent === 'back') {
      await page.goForward();
      await expect(page.locator('.content-listen')).toBeVisible();
    }
    await expectSource(page);
  });
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`release sheet hands off to artist and back without losing listening (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await solo(page);
    const artist = page.locator('.track-copy').getByRole('button', { name: 'Dotify Room Host', exact: true });
    await artist.scrollIntoViewIfNeeded();
    const top = await page.evaluate(() => scrollY);
    await page.getByRole('button', { name: 'About this release', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'About this release', exact: true });
    await expect(sheet).toContainText('Behind the music');
    await expect(sheet.getByRole('button', { name: 'Explore this artist' })).toBeVisible();
    await sheet.getByText('Listening & support', { exact: true }).click();
    await expect(sheet).toContainText('Free with basic human verification');
    await expect(sheet.locator('.release-story')).toHaveText('A deterministic public track used by the room-join e2e flow.');
    await page.screenshot({ path: testInfo.outputPath('release-discovery.png'), animations: 'disabled' });
    await sheet.getByRole('button', { name: 'Explore this artist' }).click();
    await expect(page.getByRole('heading', { name: 'Dotify Room Host', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectSource(page);
    await page.getByRole('button', { name: 'Back to listening', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
    await expect(artist).toBeFocused();
    await expect.poll(() => page.evaluate(saved => Math.abs(scrollY - saved), top)).toBeLessThan(5);
    await expectSource(page);
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Back to listening', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
    await expectSource(page);
  });
}

test('Back and Escape cancel room exit without changing the source or membership', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Careful host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const code = await page.getByTestId('room-code').innerText();
  await page
    .locator('audio')
    .first()
    .evaluate(node => Reflect.set(node, '__motionIdentity__', true));
  for (const cancel of ['back', 'escape']) {
    await page.getByRole('button', { name: 'Close room', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Close this room?' });
    await expect(dialog).toBeFocused();
    if (cancel === 'back') await page.goBack();
    else await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('room-code')).toHaveText(code);
    await expectSource(page);
  }
});

test('room preparation keeps the current cover and can cancel a late room acknowledgment', async ({ page }, testInfo) => {
  let releaseAck: (() => void) | undefined;
  let ackPrefix = '';
  await page.routeWebSocket(/\/socket\.io\//, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => {
      const frame = String(message);
      if (frame.includes('"room:create"')) {
        const id = /^42(\d+)\[/.exec(frame)?.[1];
        if (id) ackPrefix = `43${id}[`;
      }
      server.send(message);
    });
    server.onMessage(message => {
      if (ackPrefix && String(message).startsWith(ackPrefix) && !releaseAck) {
        releaseAck = () => socket.send(message);
        return;
      }
      socket.send(message);
    });
  });
  await solo(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0)).toBeGreaterThan(0);
  await page.locator('.cover').evaluate(element => Reflect.set(window, '__coverAnchor', element));
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByLabel('Your name or nickname').fill('Preparing host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const note = page.locator('.room-preparation-note');
  await expect(note).toContainText('Opening your room');
  await expect.poll(() => Boolean(releaseAck)).toBe(true);
  expect(await page.locator('.cover').evaluate(element => element === Reflect.get(window, '__coverAnchor'))).toBe(true);
  await expect(page.getByTestId('room-code')).toHaveCount(0);
  await expectSource(page);
  await page.screenshot({ path: testInfo.outputPath('room-preparation.png'), animations: 'disabled' });
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  releaseAck!();
  await expect(note).toHaveCount(0);
  await expect(page.getByTestId('room-code')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Player', exact: true })).toBeVisible();
  await expectSource(page);
});
