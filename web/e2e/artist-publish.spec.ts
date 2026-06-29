import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ArtistPublishE2eState = {
  runtimeCreated: boolean;
  uploadRequests: {
    audio: number;
    cover: number;
    metadata: number;
  };
  uploadFailures: number;
  registerArtistTransactions: number;
  registerTrackTransactions: number;
  transactionFailures: number;
  devAccountFallbackUsed: boolean;
};

declare global {
  interface Window {
    __DOTIFY_E2E_ARTIST_PUBLISH__?: ArtistPublishE2eState;
  }
}

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const audioFixture = path.join(fixtureDir, 'artist-release.wav');
const coverFixture = path.join(fixtureDir, 'artist-cover.svg');

async function readArtistPublishState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_ARTIST_PUBLISH__ as ArtistPublishE2eState | undefined);
}

async function openArtistScenario(page: Page, scenario: string) {
  await page.goto(`/artists?e2eArtist=${scenario}`);
}

async function createArtistProfile(page: Page, scenario = 'happy') {
  await openArtistScenario(page, scenario);
  await page.getByTestId('artist-name-input').fill('E2E Artist');
  await page.getByLabel(/I understand and consent/i).check();
  await page.getByTestId('create-artist-profile').click();
  await expect(page.getByRole('dialog')).toContainText('Artist registered');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('tab', { name: /New Release/i })).toBeVisible();
}

async function completeReleaseDraft(page: Page) {
  await page.getByRole('tab', { name: /New Release/i }).click();
  await page.getByTestId('artist-audio-input').setInputFiles(audioFixture);
  await expect(page.getByText('Audio ready', { exact: true })).toBeVisible();
  await page.getByTestId('artist-cover-input').setInputFiles(coverFixture);
  await expect(page.getByText('Cover ready', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('release-title-input').fill('E2E Published Signal');
  await page.getByTestId('release-description-input').fill('A deterministic artist publish e2e release.');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('release-access-select').selectOption('classic');
  await page.getByTestId('release-price-input').fill('0.75');
  await page.getByTestId('release-royalty-input').fill('7250');

  await page.getByRole('button', { name: 'Continue' }).click();
  const reviewPanel = page.locator('.release-review');
  await expect(reviewPanel.getByText('E2E Published Signal')).toBeVisible();
  await expect(reviewPanel.getByText('0.75 DOT')).toBeVisible();
}

test('artist can create a runtime, publish a release, and see it in the listener catalog', async ({ page }) => {
  await createArtistProfile(page);
  await completeReleaseDraft(page);

  await page.getByTestId('publish-release-button').click();
  await expect(page.getByRole('dialog')).toContainText('Track registered');

  const publishState = await readArtistPublishState(page);
  expect(publishState?.runtimeCreated).toBe(true);
  expect(publishState?.registerArtistTransactions).toBe(1);
  expect(publishState?.registerTrackTransactions).toBe(1);
  expect(publishState?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(publishState?.devAccountFallbackUsed).toBe(false);

  await page.goto('/');
  const publishedCard = page.getByTestId('track-card').filter({ hasText: 'E2E Published Signal' });
  await expect(publishedCard).toContainText('E2E Artist');
  await expect(publishedCard).toContainText('A deterministic artist publish e2e release.');
  await expect(publishedCard).toContainText('0.75 DOT');
});

test('artist onboarding handles a missing wallet without enabling profile creation', async ({ page }) => {
  await openArtistScenario(page, 'missing-wallet');

  await expect(page.getByText('Connect your wallet to claim an artist profile.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use my wallet/i })).toBeVisible();
  await expect(page.getByTestId('create-artist-profile')).toBeDisabled();

  const state = await readArtistPublishState(page);
  expect(state?.registerArtistTransactions ?? 0).toBe(0);
  expect(state?.devAccountFallbackUsed ?? false).toBe(false);
});

test('artist profile creation rejects a mismatched wallet network', async ({ page }) => {
  await openArtistScenario(page, 'network-mismatch');
  await page.getByTestId('artist-name-input').fill('E2E Artist');
  await page.getByLabel(/I understand and consent/i).check();
  await page.getByTestId('create-artist-profile').click();

  await expect(page.getByRole('dialog')).toContainText('Network mismatch');
  await expect(page.getByRole('dialog')).toContainText('Switch your wallet to chain 420420417');

  const state = await readArtistPublishState(page);
  expect(state?.runtimeCreated ?? false).toBe(false);
  expect(state?.registerArtistTransactions ?? 0).toBe(0);
});

test('artist publish surfaces upload failure before registration', async ({ page }) => {
  await createArtistProfile(page, 'upload-failure');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  await expect(page.getByRole('dialog')).toContainText('Registration failed');
  await expect(page.getByRole('dialog')).toContainText('E2E metadata upload failed.');

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests.audio).toBe(1);
  expect(state?.uploadRequests.cover).toBe(1);
  expect(state?.uploadRequests.metadata).toBe(0);
  expect(state?.uploadFailures).toBe(1);
  expect(state?.registerTrackTransactions).toBe(0);
});

test('artist publish surfaces transaction failure after successful uploads', async ({ page }) => {
  await createArtistProfile(page, 'transaction-failure');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  await expect(page.getByRole('dialog')).toContainText('Registration failed');
  await expect(page.getByRole('dialog')).toContainText('E2E registration transaction rejected.');

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(state?.transactionFailures).toBe(1);
  expect(state?.registerTrackTransactions).toBe(0);
});
