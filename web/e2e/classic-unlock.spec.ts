import { expect, test, type Page } from '@playwright/test';

type ClassicUnlockE2eState = {
  fullKeyRequests: number;
  deniedFullKeyRequests: number;
  paid: boolean;
  accessGranted: boolean;
};

declare global {
  interface Window {
    __DOTIFY_E2E_CLASSIC_UNLOCK__?: ClassicUnlockE2eState;
  }
}

async function readClassicUnlockState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_CLASSIC_UNLOCK__ as ClassicUnlockE2eState | undefined);
}

const E2E_NATIVE_PAYMENT_SYMBOL = 'PAS';

test('Classic track stays locked before payment and unlocks full playback after payment', async ({ page }) => {
  await page.goto('/');

  const trackCard = page.getByTestId('track-card');
  await expect(trackCard).toContainText('Deterministic Classic Unlock');
  await expect(trackCard).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);

  await page.getByTestId('track-card-open').click();

  await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
  await expect(page.getByTestId('access-warning')).toContainText('Support and open this track');
  await expect(page.getByTestId('access-warning')).toContainText(`0.5 ${E2E_NATIVE_PAYMENT_SYMBOL}`);

  const beforePayment = await readClassicUnlockState(page);
  expect(beforePayment?.fullKeyRequests ?? 0).toBe(0);
  expect(beforePayment?.deniedFullKeyRequests ?? 0).toBe(0);

  await page.getByTestId('classic-unlock-button').click();

  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Access verified');
  await expect(page.getByTestId('full-playback-state')).toContainText('Full track opened');
  await expect(page.getByTestId('player-access-price')).toContainText('Access verified');

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

  await page.getByTestId('classic-unlock-button').click();

  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Payment included, access not verified');
  await expect(page.getByTestId('unlock-transaction-status')).toContainText('payment record may still exist');
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
  await expect(page.getByLabel('Music summary')).toContainText(/1\s*payment records/);
  await expect(page.getByLabel('Music summary')).toContainText(/1\s*artists supported/);
  await expect(supportedTracks.getByText('Deterministic Classic Unlock')).toBeVisible();
  await expect(supportedTracks.getByText(`Dotify Test Artist / 0.5 ${E2E_NATIVE_PAYMENT_SYMBOL} paid`)).toBeVisible();
});
