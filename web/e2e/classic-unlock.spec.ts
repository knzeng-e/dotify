import { expect, test, type Page } from '@playwright/test';

type ClassicUnlockE2eState = {
  fullKeyRequests: number;
  deniedFullKeyRequests: number;
  paid: boolean;
};

declare global {
  interface Window {
    __DOTIFY_E2E_CLASSIC_UNLOCK__?: ClassicUnlockE2eState;
  }
}

async function readClassicUnlockState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_CLASSIC_UNLOCK__ as ClassicUnlockE2eState | undefined);
}

test('Classic track stays locked before payment and unlocks full playback after payment', async ({ page }) => {
  await page.goto('/');

  const trackCard = page.getByTestId('track-card');
  await expect(trackCard).toContainText('Deterministic Classic Unlock');
  await expect(trackCard).toContainText('0.5 DOT');

  await page.getByTestId('track-card-open').click();

  await expect(page.getByTestId('locked-player-state')).toContainText('Listening closed');
  await expect(page.getByTestId('access-warning')).toContainText('Support and open this work');
  await expect(page.getByTestId('access-warning')).toContainText('0.5 DOT');

  const beforePayment = await readClassicUnlockState(page);
  expect(beforePayment?.fullKeyRequests ?? 0).toBe(0);
  expect(beforePayment?.deniedFullKeyRequests ?? 0).toBe(0);

  await page.getByTestId('classic-unlock-button').click();

  await expect(page.getByTestId('unlock-transaction-status')).toContainText('Work opened');
  await expect(page.getByTestId('full-playback-state')).toContainText('Full track opened');
  await expect(page.getByText('Opened for this wallet')).toBeVisible();

  const afterPayment = await readClassicUnlockState(page);
  expect(afterPayment?.paid).toBe(true);
  expect(afterPayment?.fullKeyRequests ?? 0).toBeGreaterThanOrEqual(1);
  expect(afterPayment?.deniedFullKeyRequests ?? 0).toBe(0);
});
