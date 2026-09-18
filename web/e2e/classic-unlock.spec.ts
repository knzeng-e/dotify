import { expect, test, type Page } from '@playwright/test';

type ClassicUnlockE2eState = {
  fullKeyRequests: number;
  deniedFullKeyRequests: number;
  paid: boolean;
  accessGranted: boolean;
  paymentAttempts?: number;
};

declare global {
  interface Window {
    __DOTIFY_E2E_CLASSIC_UNLOCK__?: ClassicUnlockE2eState;
  }
}

async function readClassicUnlockState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_CLASSIC_UNLOCK__ as ClassicUnlockE2eState | undefined);
}

async function openClassicSupport(page: Page) {
  await page.getByRole('button', { name: 'Support and open', exact: true }).click();
  const dialog = page.getByTestId('access-warning');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Support and open this track', { exact: true })).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollTop)).toBe(0);
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Not now', exact: true })).toBeFocused();
}

const E2E_NATIVE_PAYMENT_SYMBOL = 'PAS';

// The deterministic payment fixture still resolves the chain's currency through
// the real application path. Stub this external read so public RPC rate limits
// cannot turn an access/recovery test into a network-availability test.
test.beforeEach(async ({ page }) => {
  await page.route('https://eth-rpc-testnet.polkadot.io/**', async route => {
    const request = route.request().postDataJSON();
    if (request?.method !== 'eth_chainId') return route.continue();
    await route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result: `0x${(420420417).toString(16)}` } });
  });
});

test('Classic track stays locked before payment and unlocks full playback after payment', async ({ page }) => {
  await page.goto('/');

  const trackCard = page.getByTestId('track-card');
  await expect(trackCard).toContainText('Deterministic Classic Unlock');
  await expect(trackCard).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);

  await page.getByTestId('track-card-open').click();

  await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
  await expect(page.getByTestId('access-warning')).toHaveCount(0);
  await expect(page.locator('.solo-room-invite')).toHaveCount(0);
  await expect(page.locator('.player-lower-grid')).toBeHidden();
  await openClassicSupport(page);
  await expect(page.getByTestId('access-warning')).toContainText('Support and open this track');
  await expect(page.getByTestId('access-warning')).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
  await expect(page.getByTestId('access-warning')).toContainText('Primary recipient');
  await expect(page.getByTestId('access-warning')).toContainText('Nothing is sent until you confirm.');
  await expect(page.getByTestId('access-warning')).not.toContainText(/runtime|registry|chain|EVM/i);

  const beforePayment = await readClassicUnlockState(page);
  expect(beforePayment?.fullKeyRequests ?? 0).toBe(0);
  expect(beforePayment?.deniedFullKeyRequests ?? 0).toBe(0);

  await page.getByTestId('classic-unlock-button').click();

  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Access verified');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Amount');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Recipients');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Settlement');
  await expect(page.getByTestId('full-playback-state')).toContainText('Full track opened');

  const afterPayment = await readClassicUnlockState(page);
  expect(afterPayment?.paid).toBe(true);
  expect(afterPayment?.accessGranted).toBe(true);
  expect(afterPayment?.fullKeyRequests ?? 0).toBeGreaterThanOrEqual(1);
  expect(afterPayment?.deniedFullKeyRequests ?? 0).toBe(0);
});

test('Classic payment record remains visible when runtime read-back denies playable access', async ({ page }) => {
  await page.goto('/?e2eClassic=paid-without-access');

  const trackCard = page.getByTestId('track-card');
  await expect(trackCard).toContainText('Deterministic Classic Unlock');

  await page.getByTestId('track-card-open').click();
  await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');

  await openClassicSupport(page);
  await page.getByTestId('classic-unlock-button').click();

  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Listening access not verified');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Check access again');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Protected audio stays closed');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Settlement');
  await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
  await expect(page.getByTestId('full-playback-state')).toHaveCount(0);

  const afterPayment = await readClassicUnlockState(page);
  expect(afterPayment?.paid).toBe(true);
  expect(afterPayment?.accessGranted).toBe(false);
  expect(afterPayment?.fullKeyRequests ?? 0).toBe(0);

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'You' }).first().click();

  const supportedTracks = page.getByLabel('Supported tracks');
  await expect(page.getByRole('heading', { name: 'Supported tracks' })).toBeVisible();
  await expect(page.getByLabel('Music summary')).toContainText(/1\s*supported tracks/);
  await expect(page.getByLabel('Music summary')).toContainText(/1\s*artists supported/);
  await expect(supportedTracks.getByText('Deterministic Classic Unlock')).toBeVisible();
  await expect(supportedTracks.getByText('Dotify Test Artist', { exact: true })).toBeVisible();
  await expect(supportedTracks.getByText('Payment recorded', { exact: true })).toBeVisible();
  await expect(supportedTracks.locator('code')).toHaveCount(0);
});

test.describe('mobile Classic support receipt states', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('mobile receipt shows confirmed support facts', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('track-card-open').click();
    await openClassicSupport(page);
    await page.getByTestId('classic-unlock-button').click();

    const receipt = page.getByTestId('unlock-transaction-status');
    await expect(receipt).toContainText('Access verified');
    await expect(receipt).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
    await expect(receipt).toContainText('Recipients');
    await expect(receipt).toContainText('Settlement');
  });

  test('mobile receipt keeps included-but-unverified support closed', async ({ page }) => {
    await page.goto('/?e2eClassic=paid-without-access');
    await page.getByTestId('track-card-open').click();
    await openClassicSupport(page);
    await page.getByTestId('classic-unlock-button').click();

    const receipt = page.getByTestId('unlock-transaction-status');
    await expect(receipt).toContainText('Listening access not verified');
    await expect(receipt).toContainText('Protected audio stays closed');
    await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
  });

  test('mobile Product funding failure stays plain and confirms that nothing was sent', async ({ page }) => {
    await page.goto('/?e2eClassic=funding-required');
    await page.getByTestId('track-card-open').click();
    await openClassicSupport(page);
    await page.getByTestId('classic-unlock-button').click();

    const receipt = page.getByTestId('unlock-transaction-status');
    await expect(receipt).toContainText(`Add ${E2E_NATIVE_PAYMENT_SYMBOL} to continue`);
    await expect(receipt).toContainText('could not cover the support and network fee');
    await expect(receipt).toContainText('No payment was sent');
    await expect(receipt).not.toContainText(/TransferFailed|Revive|dry-run|musicRoyPayAccess/i);
    await expect(receipt.getByRole('button', { name: 'Check access again' })).toHaveCount(0);
    await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
    expect((await readClassicUnlockState(page))?.paymentAttempts).toBe(1);
    expect((await readClassicUnlockState(page))?.paid).toBe(false);
  });
});

for (const width of [390, 1440]) {
  test(`support recovery at ${width}px checks access without a second payment`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?e2eClassic=confirmation-delayed');
    await page.getByTestId('track-card-open').click();
    await openClassicSupport(page);
    await page.getByTestId('classic-unlock-button').click();
    const receipt = page.getByTestId('unlock-transaction-status');
    await expect(receipt).toContainText('Payment status needs checking');
    await expect(receipt).toContainText('Proof reference');
    await expect(page.getByTestId('full-playback-state')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`support-recovery-${width}.png`) });
    // Simulate a late chain read-back; the real coordinator must use only reads.
    await page.evaluate(() => {
      window.__DOTIFY_E2E_CLASSIC_UNLOCK__!.accessGranted = true;
    });
    await page.getByRole('button', { name: 'Check access again' }).click();
    await expect(receipt).toContainText('Access verified');
    await expect(page.getByTestId('full-playback-state')).toBeVisible();
    expect((await readClassicUnlockState(page))?.paymentAttempts).toBe(1);
    expect((await readClassicUnlockState(page))?.deniedFullKeyRequests).toBe(0);
  });
}

test('a rejected support signature allows an explicit fresh attempt', async ({ page }) => {
  await page.goto('/?e2eClassic=reject-payment');
  await page.getByTestId('track-card-open').click();
  await openClassicSupport(page);
  await page.getByTestId('classic-unlock-button').click();
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Support canceled');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Support and open', exact: true }).click();
  await page.getByTestId('classic-unlock-button').click();
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Access verified');
  expect((await readClassicUnlockState(page))?.paymentAttempts).toBe(2);
});
