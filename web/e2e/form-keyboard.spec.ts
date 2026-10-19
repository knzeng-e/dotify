import { expect, test, type Locator, type Page } from '@playwright/test';
import { io } from 'socket.io-client';

// Real forms, with the browser viewport events a software keyboard produces.
// This is deterministic layout coverage, not proof of a physical iPhone or
// Product Host keyboard, native focus scrolling, or permission behavior.
type ViewportSample = { height: number; offsetTop?: number; width?: number; offsetLeft?: number; scale?: number };

async function installViewport(page: Page, initial: Partial<ViewportSample> = {}) {
  await page.addInitScript(initialSample => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error('VisualViewport is required by this layout fixture');
    const sample = { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, ...initialSample };
    for (const key of Object.keys(sample) as Array<keyof typeof sample>) {
      Object.defineProperty(viewport, key, { configurable: true, get: () => sample[key] });
    }
    Reflect.set(window, '__setFormTestViewport', (next: Partial<typeof sample>) => {
      Object.assign(sample, next);
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
    });
  }, initial);
}

async function viewport(page: Page, sample: ViewportSample) {
  await page.evaluate(next => Reflect.get(window, '__setFormTestViewport')(next), sample);
}

async function expectFieldAboveKeyboard(field: Locator, top: number, bottom: number) {
  await expect(field).toBeFocused();
  await expect
    .poll(async () => {
      const box = await field.boundingBox();
      return !!box && box.y >= top + 8 && box.y + box.height <= bottom - 8;
    })
    .toBe(true);
  expect(await field.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
}

async function openCreateRoom(page: Page) {
  await page.goto('/?e2eRoom=public');
  const opener = page.getByRole('button', { name: 'Open a room', exact: true });
  // Safari intentionally does not focus a button on pointer click. Open by
  // keyboard here so dismissal can verify restoration of a real prior focus.
  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Open a room', exact: true });
  await dialog.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
  return { dialog, opener };
}

test.describe('form keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('room name and invitation remain readable through a panned keyboard and invalid transition', async ({ page }, info) => {
    await installViewport(page);
    const { dialog, opener } = await openCreateRoom(page);
    const backgroundScroll = await page.evaluate(() => window.scrollY);
    await dialog.getByLabel('Your name or nickname').fill('Nia');
    await dialog.locator('.room-profile-optional > summary').click();
    const name = dialog.getByLabel('Room name', { exact: false });
    const invitation = dialog.getByLabel('A short invitation', { exact: false });
    await name.fill('Escale à Libreville');
    await viewport(page, { height: 390, offsetTop: 44 });
    await expectFieldAboveKeyboard(name, 44, 434);
    await name.pressSequentially(' ensemble');
    await invitation.fill('Découvertes et discussion, bienvenue chez nous.');
    await expectFieldAboveKeyboard(invitation, 44, 434);
    expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScroll);

    const beforeInvalidSample = await invitation.boundingBox();
    await viewport(page, { height: 0, offsetTop: 0 });
    // Two rendering frames include the viewport handler without a fixed sleep.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await invitation.boundingBox()).toEqual(beforeInvalidSample);
    await expect(invitation).toHaveValue('Découvertes et discussion, bienvenue chez nous.');
    await viewport(page, { height: 370, offsetTop: 60 });
    await expectFieldAboveKeyboard(invitation, 60, 430);
    await page.screenshot({ path: info.outputPath('room-invitation-keyboard.png'), animations: 'disabled' });

    await viewport(page, { height: 844, offsetTop: 0 });
    await expect(name).toHaveValue('Escale à Libreville ensemble');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScroll);
  });

  test('editing a live room saves on the first tap while the keyboard dismisses', async ({ page }) => {
    await installViewport(page);
    const { dialog } = await openCreateRoom(page);
    await dialog.getByLabel('Your name or nickname').fill('Keyboard host');
    await dialog.getByRole('button', { name: 'Open the room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(/[A-Z2-9]{6}/);
    await page.getByRole('tab', { name: /People/ }).click();
    const settings = page.getByRole('button', { name: /Who can find this room/ });
    await settings.focus();
    await settings.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'Who can find this room?' });
    await sheet.getByText('Room name and invitation', { exact: true }).click();
    await sheet.getByLabel('Room name', { exact: false }).fill('After hours');
    const invitation = sheet.getByLabel('A short invitation', { exact: false });
    await invitation.fill('One more song together.');
    await viewport(page, { height: 430, offsetTop: 0 });
    await expectFieldAboveKeyboard(invitation, 0, 430);

    const done = sheet.getByRole('button', { name: 'Done', exact: true });
    await done.scrollIntoViewIfNeeded();
    const box = (await done.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(430);
    // Real pointer down/up: blur and keyboard closing happen before click.
    // Moving the action between these events would require a second tap.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await viewport(page, { height: 844, offsetTop: 0 });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await page.mouse.up();
    await expect(sheet).toHaveCount(0);
    await expect(settings).toBeFocused();
    await settings.click();
    await sheet.getByText('Room name and invitation', { exact: true }).click();
    await expect(sheet.getByLabel('Room name', { exact: false })).toHaveValue('After hours');
    await expect(sheet.getByLabel('A short invitation', { exact: false })).toHaveValue('One more song together.');
    await sheet.getByRole('button', { name: 'Close visibility settings' }).click();
    await page.getByRole('button', { name: 'Close room', exact: true }).click();
  });

  test('joining nickname stays above the keyboard without reintroducing a room-code field', async ({ page }) => {
    await installViewport(page);
    const host = io('http://127.0.0.1:8789', { transports: ['websocket'], autoConnect: false });
    try {
      const connected = new Promise<void>((resolve, reject) => {
        host.once('connect', resolve);
        host.once('connect_error', reject);
      });
      host.connect();
      await connected;
      const room = (await host.timeout(5000).emitWithAck('room:create', {
        displayName: 'Keyboard room host',
        track: { title: 'A shared moment', artist: 'Ada' }
      })) as { roomId: string };
      expect(room.roomId).toMatch(/[A-Z2-9]{6}/);
      await page.goto(`/?e2eRoom=listener#/rooms/${room.roomId}`);
      // Link-only rooms intentionally do not disclose host/track metadata
      // before joining; the explicit invitation resolves a generic threshold.
      const sheet = page.locator('.join-room-modal');
      await expect(sheet.getByRole('button', { name: 'Join and listen', exact: true })).toBeDisabled();
      const nickname = sheet.getByLabel('Your name or nickname', { exact: true });
      await nickname.fill('Élo');
      await viewport(page, { height: 360, offsetTop: 35 });
      await expectFieldAboveKeyboard(nickname, 35, 395);
      await expect(sheet.getByLabel('Room code', { exact: true })).toHaveCount(0);
      await viewport(page, { height: 844, offsetTop: 0 });
      await sheet.getByRole('button', { name: 'Join and listen', exact: true }).click();
      await expect(page.getByTestId('room-code')).toHaveText(room.roomId);
      await expect(page.locator('.room-live-chip')).toContainText('Together');
      await page.getByRole('tab', { name: /People/ }).click();
      // The listener's People form is inside the room shell, but it is not
      // the dedicated chat composer and still needs shared form scrolling.
      const roomNickname = page.locator('#room-display-name');
      await roomNickname.fill('Élo together');
      await viewport(page, { height: 390, offsetTop: 24 });
      await expectFieldAboveKeyboard(roomNickname, 24, 414);
      await expect(roomNickname).toHaveValue('Élo together');
      await viewport(page, { height: 844, offsetTop: 0 });
      await page.getByRole('button', { name: 'Update room name', exact: true }).click();
      await expect(roomNickname).toHaveValue('Élo together');
    } finally {
      host.emit('room:leave');
      host.disconnect();
    }
  });

  test('an initially invalid viewport recovers while an artist field is already focused', async ({ page }) => {
    await installViewport(page, { height: 0, width: 0, scale: 0 });
    await page.goto('/artists?e2eArtist=missing-wallet');
    const name = page.getByTestId('artist-name-input');
    await name.fill('First frame artist');
    // WebViews can publish zero geometry while a native surface opens. The
    // first valid sample must still reveal the active field above the keyboard.
    await viewport(page, { height: 370, width: 390, offsetTop: 30, scale: 1 });
    await expectFieldAboveKeyboard(name, 30, 400);
    await expect(name).toHaveValue('First frame artist');
    await viewport(page, { height: 844, width: 390, offsetTop: 0, scale: 1 });
    await expect(name).toHaveValue('First frame artist');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('inline artist fields remain visible with a keyboard that resizes the layout viewport', async ({ page }) => {
    // Actual page resizing covers WebViews that resize innerHeight too, rather
    // than only shrinking VisualViewport over the existing layout viewport.
    await page.route('https://eth-rpc-testnet.polkadot.io/**', async route => {
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const input = route.request().postDataJSON();
      if (input?.method !== 'eth_chainId') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: input.id, result: `0x${(420420417).toString(16)}` })
      });
    });
    await page.goto('/artists?e2eArtist=happy');
    const name = page.getByTestId('artist-name-input');
    await name.fill('Keyboard Artist');
    await page.setViewportSize({ width: 390, height: 430 });
    await expectFieldAboveKeyboard(name, 0, 430);
    await expect(name).toHaveValue('Keyboard Artist');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel(/I understand and consent/i).check();
    await page.getByTestId('create-artist-profile').click();
    await expect(page.getByRole('dialog')).toContainText('Artist registered');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Rights & support', exact: true }).click();
    const policy = page.locator('.contribution-policy');
    await policy.getByLabel('Purpose', { exact: true }).fill('A community music school');
    await policy.getByRole('button', { name: 'Add recipient', exact: true }).click();
    const account = policy.getByLabel('Receiving account', { exact: true });
    await account.fill('0x0000000000000000000000000000000000001234');
    await page.setViewportSize({ width: 390, height: 430 });
    await expectFieldAboveKeyboard(account, 0, 430);
    await expect(policy.getByLabel('Purpose', { exact: true })).toHaveValue('A community music school');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(account).toHaveValue('0x0000000000000000000000000000000000001234');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('tip amount remains readable and review preserves the amount after keyboard closing', async ({ page }) => {
    await installViewport(page);
    await page.goto('/');
    await page.getByTestId('track-card-open').first().click();
    const tip = page.getByRole('button', { name: 'Tip this track', exact: true });
    await tip.click();
    const sheet = page.locator('.artist-gift-dialog');
    const amount = sheet.getByLabel('Tip amount (PAS)', { exact: true });
    await amount.fill('0.25');
    await viewport(page, { height: 380, offsetTop: 24 });
    await expectFieldAboveKeyboard(amount, 24, 404);
    await expect(amount).toHaveValue('0.25');
    await viewport(page, { height: 844, offsetTop: 0 });
    await sheet.getByRole('button', { name: 'Review tip', exact: true }).click();
    await expect(sheet).toContainText('Where your tip goes');
    await expect(sheet.getByRole('button', { name: 'Confirm tip · 0.25 PAS', exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close tip', exact: true }).click();
    await expect(tip).toBeFocused();
    // Review alone never sends a contribution or changes listening access.
    expect(await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__')?.sends ?? 0)).toBe(0);
  });
});

test('form keyboard: desktop dialog focus does not move the listening page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { dialog, opener } = await openCreateRoom(page);
  const backgroundScroll = await page.evaluate(() => window.scrollY);
  await dialog.getByLabel('Your name or nickname').fill('Desktop host');
  await dialog.locator('.room-profile-optional > summary').click();
  const roomName = dialog.getByLabel('Room name', { exact: false });
  await roomName.fill('A quiet evening');
  await expect(roomName).toBeFocused();
  const box = (await roomName.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(1000);
  expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScroll);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScroll);
});
