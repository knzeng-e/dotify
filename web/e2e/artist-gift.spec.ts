import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { io } from 'socket.io-client';
import { encodeAbiParameters, encodeEventTopics, zeroHash } from 'viem';
import { musicRoyaltiesAbi } from '../src/generated/contracts/musicRoyalties';
import type { ContributionReceipt } from '../src/features/donations/contributions';
import { renderedTextContrast } from './helpers/renderedContrast';
function contributionDialog(page: Page) {
  return page.locator('.artist-gift-dialog');
}
function amountField(page: Page, kind: 'gift' | 'tip' = 'gift') {
  return contributionDialog(page).getByLabel(`${kind === 'gift' ? 'Gift' : 'Tip'} amount (PAS)`, { exact: true });
}
async function openGift(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.locator('.catalogue-card .artist-text-button').first().click();
  await expect(page.getByRole('heading', { name: 'Dotify Test Artist', exact: true })).toBeVisible();
  const gift = page.getByRole('main').getByRole('button', { name: 'Send a gift', exact: true });
  await expect(gift).toBeVisible();
  await expect(async () => {
    await gift.click();
    await expect(page.getByRole('dialog', { name: 'Gift to Dotify Test Artist' })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(amountField(page, 'gift')).toBeVisible();
}
async function review(page: Page, amount = '0.25', kind: 'gift' | 'tip' = 'gift') {
  await amountField(page, kind).fill(amount);
  await contributionDialog(page).getByRole('button', { name: /^Review (tip|gift)$/ }).click();
}
async function giftState(page: Page) {
  return page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__') as { sends: number; confirmed: boolean; finalizedReads?: number });
}
for (const width of [320, 390, 430, 1440]) {
  test(`gift review and dated receipt at ${width}px preserve listening access`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await openGift(page);
    await review(page);
    const dialog = contributionDialog(page);
    await expect(dialog).toContainText(/Where your (tip|gift) goes/);
    await expect(dialog).toContainText('0.25 PAS');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`gift-review-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Confirm gift · 0.25 PAS', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible();
    await expect(dialog.locator('time')).toBeVisible();
    expect((await giftState(page)).sends).toBe(1);
    const access = await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_CLASSIC_UNLOCK__') as { paid: boolean; accessGranted: boolean });
    expect(access.paid).toBe(false);
    expect(access.accessGranted).toBe(false);
    await page.getByRole('button', { name: /^Close (tip|gift)$/ }).click();
    await expect(page.getByRole('button', { name: 'Gift sent. View receipt', exact: true })).toBeFocused();
    await expect(page.locator('.toast-card[data-tone="success"]')).toContainText('Gift sent');
  });
}
for (const width of [320, 390, 430, 1440]) {
  test(`track tips stay separate from playback and paid access at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByTestId('track-card-open').first().click();
    const transport = page.getByRole('group', { name: 'Playback controls', exact: true });
    await expect(transport.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
    await expect(transport.getByRole('button', { name: 'Tip this track', exact: true })).toHaveCount(0);
    const tip = page.getByRole('button', { name: 'Tip this track', exact: true });
    await expect(tip).toBeVisible();
    await expect(tip).not.toHaveAttribute('title');
    await expect(tip).toHaveAttribute('aria-haspopup', 'dialog');
    const box = (await tip.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`track-actions-${width}.png`), animations: 'disabled' });
    const restingColor = await tip.evaluate(element => getComputedStyle(element).color);
    await tip.hover();
    await expect(tip).toHaveCSS('color', restingColor);
    expect(await tip.boundingBox()).toEqual(box);
    if (width === 1440) {
      const contrast = (await renderedTextContrast(page)).filter(sample => sample.text === 'Tip this track');
      expect(contrast).toHaveLength(1);
      expect(contrast[0].ratio).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: info.outputPath('tip-hover-desktop.png'), animations: 'disabled' });
    }
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await tip.focus();
    await expect(tip).toBeFocused();
    await expect(tip).toHaveCSS('outline-style', 'solid');
    await expect(tip).toHaveCSS('outline-width', '2px');
    await page.screenshot({ path: info.outputPath(`tip-focus-${width}.png`), animations: 'disabled' });
    await tip.click();
    await expect(contributionDialog(page)).toContainText('Listening access stays unchanged');
    await review(page, '0.5', 'tip');
    await contributionDialog(page).getByRole('button', { name: 'Confirm tip · 0.5 PAS', exact: true }).click();
    const dialog = contributionDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Tip sent', exact: true })).toBeVisible();
    await expect(dialog).toContainText('0.5 PAS for “Deterministic Classic Unlock”. Finalized and recorded.');
    const access = await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_CLASSIC_UNLOCK__') as { paid: boolean; accessGranted: boolean });
    expect(access.paid).toBe(false);
    expect(access.accessGranted).toBe(false);
    await page.getByRole('button', { name: /^Close (tip|gift)$/ }).click();
    const sentTip = page.getByRole('button', { name: 'Tip sent. View receipt', exact: true });
    await expect(sentTip).toBeFocused();
    await expect(sentTip).toHaveAttribute('data-confirmed', 'true');
    const notice = page.locator('.toast-card[data-tone="success"]');
    await expect(notice).toContainText('Tip sent');
    await expect(notice).toContainText('0.5 PAS for “Deterministic Classic Unlock”');
    await page.screenshot({ path: info.outputPath(`tip-confirmed-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Unlock listening', exact: true }).click();
    await expect(page.getByTestId('classic-unlock-button')).toHaveAccessibleName('Pay 0.5 PAS to unlock Deterministic Classic Unlock');
  });
}
test('a confirmed gift is visible in You with a dated exportable receipt', async ({ page }, info) => {
  await openGift(page);
  await review(page, '0.5');
  await page.getByRole('button', { name: 'Confirm gift · 0.5 PAS', exact: true }).click();
  await expect(contributionDialog(page).getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Close (tip|gift)$/ }).click();
  await page.getByRole('button', { name: 'You', exact: true }).click();
  const history = page.locator('.contribution-history');
  await expect(history).toContainText('Gift to artist');
  await expect(history).toContainText('0.5 PAS');
  await history.locator('.contribution-entry summary').click();
  await expect(history.getByRole('link', { name: 'View dated receipt' })).toBeVisible();
  const download = page.waitForEvent('download');
  await history.getByRole('button', { name: 'Export contribution receipts' }).click();
  expect((await download).suggestedFilename()).toBe('dotify-contributions.json');
  await page.screenshot({ path: info.outputPath('personal-contribution-history.png'), fullPage: true, animations: 'disabled' });
});

for (const width of [320, 390, 1440]) {
  test(`room tip belongs to the live track at ${width}px`, async ({ page, browser }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?e2eRoom=protected-authorized&e2eSync=on');
    await page.getByRole('button', { name: 'Open a room', exact: true }).click();
    await page.getByRole('button', { name: 'Select E2E Protected Room Track', exact: true }).click();
    await page.getByLabel('Your name in the room').fill('Tip room host');
    await page.getByRole('button', { name: 'Open the room', exact: true }).click();
    await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
    const room = (await page.getByTestId('room-code').innerText()).trim();
    const guestContext = await browser.newContext({ viewport: { width, height: 844 } });
    try {
      const guest = await guestContext.newPage();
      await guest.goto(`/?e2eRoom=public&e2eSync=on#/rooms/${room}`);
      await guest.getByLabel('Your name in the room').fill('Tip room guest');
      await guest.getByRole('button', { name: 'Join and listen', exact: true }).click();
      await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync');
      for (const [role, participant] of [
        ['host', page],
        ['guest', guest]
      ] as const) {
        const tip = participant.getByRole('button', { name: 'Tip this track', exact: true });
        await expect(tip).toBeVisible();
        expect(await participant.locator('.player-transport').getByRole('button', { name: 'Tip this track' }).count()).toBe(0);
        expect(await participant.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await participant.screenshot({ path: info.outputPath(`room-tip-${role}-${width}.png`), animations: 'disabled' });
        await tip.click();
        await expect(contributionDialog(participant)).toContainText('E2E Protected Room Track');
        await expect(contributionDialog(participant)).toContainText('Listening access stays unchanged');
        await participant.getByRole('button', { name: /^Close (tip|gift)$/ }).click();
      }
      expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
    } finally {
      await guestContext.close();
    }
  });
}

test('the host repairs legacy tip metadata while browsing outside the player', async ({ page, browser }) => {
  let hostSocket: WebSocketRoute | undefined;
  await page.routeWebSocket('**/socket.io/**', socket => {
    hostSocket = socket;
    socket.connectToServer();
  });
  await page.goto('/?e2eRoom=protected-authorized&e2eSync=on');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Protected Room Track', exact: true }).click();
  await page.getByLabel('Your name in the room').fill('Recovery host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z0-9]{4,}/);
  const room = (await roomCode.innerText()).trim();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await guest.goto(`/?e2eRoom=public&e2eSync=on#/rooms/${room}`);
    await guest.getByLabel('Your name in the room').fill('Recovery guest');
    await guest.getByRole('button', { name: 'Join and listen', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Tip this track', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Music', exact: true }).click();
    await expect(page.locator('.catalogue-card').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tip this track', exact: true })).toHaveCount(0);
    await expect.poll(() => Boolean(hostSocket)).toBe(true);

    // Restore a legacy snapshot to the host via its real session event handler.
    // The mounted session must repair/broadcast it without a PlayerView effect.
    hostSocket!.send(
      `42${JSON.stringify([
        'room:track',
        {
          title: 'Recovered live room work',
          artist: 'Dotify Room Host',
          hash: '0xb0b0000000000000000000000000000000000000000000000000000000000001',
          duration: 60,
          updatedAt: Date.now(),
          bulletinRef: ''
        }
      ])}`
    );
    await expect(guest.getByRole('heading', { name: 'Recovered live room work', exact: true })).toBeVisible();
    const tip = guest.getByRole('button', { name: 'Tip this track', exact: true });
    await expect(tip).toBeEnabled();
    await tip.click();
    await expect(contributionDialog(guest)).toContainText('E2E Protected Room Track');
    expect(await guest.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
  } finally {
    await guestContext.close();
  }
});

test('a legacy room keeps the tip location visible while attribution is unavailable', async ({ page }, info) => {
  const host = io('http://127.0.0.1:8789', { transports: ['websocket'], forceNew: true });
  try {
    await new Promise<void>((resolve, reject) => {
      host.once('connect', resolve);
      host.once('connect_error', reject);
    });
    const created = await new Promise<{ ok: boolean; roomId?: string; error?: string }>(resolve => {
      host.emit(
        'room:create',
        {
          displayName: 'Legacy host',
          playbackMode: 'full',
          track: {
            title: 'Legacy room track',
            artist: 'Dotify Test Artist',
            duration: 60,
            updatedAt: Date.now(),
            bulletinRef: '',
            hash: `0x${'a1'.repeat(32)}`,
            accessMode: 'free',
            priceDot: '0',
            personhoodLevel: 'DIM1'
          }
        },
        resolve
      );
    });
    expect(created.ok).toBe(true);
    expect(created.roomId).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?e2eRoom=public&e2eSync=on#/rooms/${created.roomId}`);
    await page.getByLabel('Your name in the room').fill('Legacy room guest');
    await page.getByRole('button', { name: 'Join and listen', exact: true }).click();

    const unavailable = page.getByRole('button', { name: 'Tip this track unavailable', exact: true });
    await expect(unavailable).toBeVisible();
    await expect(unavailable).toBeDisabled();
    await expect(page.locator('#tip-status')).toContainText('no verified contribution route');
    expect(
      await page
        .locator('.player-transport')
        .getByRole('button', { name: /Tip this track/ })
        .count()
    ).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('legacy-room-tip-unavailable-390.png'), animations: 'disabled' });
  } finally {
    host.disconnect();
  }
});

test('a pending contribution can close and reopen without another transfer', async ({ page }) => {
  await openGift(page, '?e2eGift=pending');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(contributionDialog(page).getByRole('status')).toContainText('Waiting for confirmation');
  await page.getByRole('button', { name: /^Close (tip|gift)$/ }).click();
  await page.getByRole('button', { name: 'Send a gift', exact: true }).click();
  await expect(contributionDialog(page).getByRole('status')).toContainText('Waiting for confirmation');
  expect((await giftState(page)).sends).toBe(1);
  await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__').complete());
  await expect(contributionDialog(page).getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible();
});
test('a reload resumes the saved contribution without a new signature', async ({ page }) => {
  await openGift(page, '?e2eGift=pending');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(contributionDialog(page).getByRole('status')).toContainText('Waiting for confirmation');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const key = Object.keys(localStorage).find(item => item.startsWith('dotify.contribution.v1:'));
          const raw = key ? localStorage.getItem(key) : null;
          return raw ? (JSON.parse(raw) as { hash?: string }).hash : undefined;
        }),
      { timeout: 15000 }
    )
    .toMatch(/^0x[\da-f]{64}$/i);
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(item => item.startsWith('dotify.contribution.v1:'));
    return key ? { key, value: localStorage.getItem(key) } : null;
  });
  expect(saved?.value).toBeTruthy();
  await page.reload();
  await page.locator('.catalogue-card .artist-text-button').first().click();
  await page.getByRole('main').getByRole('button', { name: 'Send a gift', exact: true }).click();
  await expect(contributionDialog(page).getByRole('status')).toContainText('Waiting for confirmation');
  await expect(amountField(page)).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), saved!.key)).toBe(saved!.value);
  expect(await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__')?.sends ?? 0)).toBe(0);
});
test('an interrupted contribution is recovered without a second payment', async ({ page }) => {
  await openGift(page, '?e2eGift=delayed');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(contributionDialog(page).getByRole('status')).toContainText('Checking network finality');
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').confirmed = true;
  });
  await expect(contributionDialog(page).getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible({ timeout: 15000 });
  expect((await giftState(page)).sends).toBe(1);
});
test('zero amounts and rejected signatures never show a successful receipt', async ({ page }) => {
  await openGift(page, '?e2eGift=reject');
  await review(page, '0');
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await review(page, '1');
  await page.getByRole('button', { name: 'Confirm gift · 1 PAS', exact: true }).click();
  await expect(contributionDialog(page)).toContainText('No contribution was sent');
  await expect(contributionDialog(page)).not.toContainText('Gift sent');
});

test('a mobile confirmation timeout keeps checking without exposing raw wallet errors', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openGift(page, '?e2eGift=timeout');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  const dialog = contributionDialog(page);
  await expect(dialog.getByRole('status')).toContainText('Checking network finality');
  await expect(dialog.getByRole('status')).toContainText('without sending another payment');
  const state = await giftState(page);
  expect(state.sends).toBe(1);
  expect(state.finalizedReads).toBe(1);
  await expect(dialog.getByRole('button', { name: /Confirm gift|Confirming/ })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'View transaction' })).toBeVisible();
  await expect(dialog.getByText(/viem@2.55.19/)).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const pending = dialog.locator('.contribution-pending');
  expect((await pending.boundingBox())!.width).toBeLessThanOrEqual((await dialog.boundingBox())!.width);
  await page.screenshot({ path: info.outputPath('tip-pending-mobile-320.png'), animations: 'disabled' });
});

test('a mobile host timeout preserves its diagnostic across reload without another approval', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGift(page, '?e2eGift=host-timeout');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  const dialog = contributionDialog(page);
  await expect(dialog.getByRole('status')).toContainText('Checking payment status');
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText(/Transaction timed out after 300s/)).toBeVisible();
  await expect(dialog).toContainText('Contribution reference:');
  await expect(dialog.getByRole('link', { name: 'View transaction' })).toHaveCount(0);
  await page.reload();
  await page.locator('.catalogue-card .artist-text-button').first().click();
  await page.getByRole('main').getByRole('button', { name: 'Send a gift', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Checking payment status');
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText(/Transaction timed out after 300s/)).toBeVisible();
  expect((await giftState(page)).sends).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__')?.confirmed)).toBe(false);
});

test('an older Product payment recovers from its native receipt block without resubmitting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGift(page, '?e2eGift=native-recovery');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  const dialog = contributionDialog(page);
  await expect(dialog.getByRole('status')).toContainText('Checking contribution receipt');
  await expect(dialog.getByRole('link', { name: 'View transaction' })).toHaveAttribute('href', /assethub-paseo\.subscan\.io\/extrinsic\//);
  await dialog.getByText('Technical details', { exact: true }).click();
  await dialog.getByLabel('Receipt block number').fill('123');
  await dialog.getByRole('button', { name: 'Check receipt block' }).click();
  await expect(dialog.getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible();
  expect((await giftState(page)).sends).toBe(1);
});

for (const available of [true, false]) {
  test(`mobile native receipt API ${available ? 'confirms the saved payment' : 'shows its latest archive error'} without resubmitting`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let reads = 0;
    await page.route('https://receipt.dotify.test/api/contributions/native-receipt', async route => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      reads++;
      const input = route.request().postDataJSON() as { hash: string; block: { number: number } };
      expect(input.block.number).toBe(123);
      if (!available) return route.fulfill({ status: 503, headers, json: { error: 'Native archive unavailable', requestId: 'native-check-123' } });
      const receipt = await page.evaluate(() => {
        const r = Reflect.get(window, '__DOTIFY_E2E_DONATION__').receipt;
        return { ...r, amount: r.amount.toString(), shares: r.shares.map((s: { amount: bigint }) => ({ ...s, amount: s.amount.toString() })) };
      });
      const row = receipt as ContributionReceipt;
      const logs = [
        {
          address: row.runtime,
          transactionHash: input.hash,
          logIndex: 0,
          topics: encodeEventTopics({
            abi: musicRoyaltiesAbi,
            eventName: 'ContributionReceived',
            args: { id: row.id, contentHash: row.contentHash, sender: row.sender }
          }),
          data: encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }],
            [BigInt(row.amount), row.host, row.room, row.campaign, zeroHash, BigInt(Math.floor(row.timestamp / 1000))]
          )
        },
        ...row.shares.map((s, i) => ({
          address: row.runtime,
          transactionHash: input.hash,
          logIndex: i + 1,
          topics: encodeEventTopics({ abi: musicRoyaltiesAbi, eventName: 'ContributionShare', args: { id: row.id, recipient: s.recipient } }),
          data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }, { type: 'bool' }], [BigInt(s.amount), s.role, s.paid])
        }))
      ];
      await route.fulfill({
        status: 200,
        headers,
        json: {
          ...input,
          block: { number: 123, hash: zeroHash },
          genesisHash: '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2',
          status: 'success',
          logs
        }
      });
    });
    await openGift(page, '?e2eGift=native-api-recovery');
    await review(page, '0.1');
    await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
    const dialog = contributionDialog(page);
    await expect(dialog.getByRole('status')).toContainText('Checking contribution receipt');
    await dialog.getByText('Technical details', { exact: true }).click();
    await dialog.getByLabel('Receipt block number').fill('123');
    await dialog.getByRole('button', { name: 'Check receipt block' }).click();
    if (available) await expect(dialog.getByRole('heading', { name: 'Gift sent', exact: true })).toBeVisible();
    else {
      await expect(dialog).toContainText('Latest check:');
      await expect(dialog).toContainText('Native archive unavailable Reference: native-check-123');
      await expect(dialog).toContainText('This Product transaction needs its receipt block.');
      await expect(dialog.getByRole('heading', { name: 'Gift sent', exact: true })).toHaveCount(0);
    }
    expect(reads).toBeGreaterThanOrEqual(1);
    expect((await giftState(page)).sends).toBe(1);
  });
}
