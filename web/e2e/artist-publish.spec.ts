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
  tracks: Array<{ id: string; hash: `0x${string}` }>;
};

declare global {
  interface Window {
    __DOTIFY_E2E_ARTIST_PUBLISH__?: ArtistPublishE2eState;
  }
}

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const audioFixture = path.join(fixtureDir, 'artist-release.wav');
const coverFixture = path.join(fixtureDir, 'artist-cover.svg');
const E2E_NATIVE_PAYMENT_SYMBOL = 'PAS';
const E2E_ARTIST_SHARE_PERCENT = '72.5';
const E2E_ARTIST_RUNTIME = '0x000000000000000000000000000000000000a712';
const E2E_ARTIST_COLLISION_RUNTIME = '0x000000000000000000000000000000000000b712';

async function readArtistPublishState(page: Page) {
  return page.evaluate(() => window.__DOTIFY_E2E_ARTIST_PUBLISH__ as ArtistPublishE2eState | undefined);
}

// Explicit per-test state reset. Playwright already gives each test a fresh browser
// context (empty storage), but the artist-publish mock persists to both
// window.__DOTIFY_E2E_ARTIST_PUBLISH__ and localStorage, so we clear them before any
// page script runs rather than relying solely on that default isolation.
//
// addInitScript re-runs on every navigation within a test, so we gate the reset on a
// sessionStorage marker: each test gets a fresh context (and fresh sessionStorage), so
// the clear fires exactly once on the first page load and then leaves in-test state
// (e.g. a published track inspected after navigating to '/') intact.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('dotify:e2e:artist-publish:reset')) return;
    window.__DOTIFY_E2E_ARTIST_PUBLISH__ = undefined;
    window.localStorage.removeItem('dotify:e2e:artist-publish');
    window.sessionStorage.setItem('dotify:e2e:artist-publish:reset', '1');
  });
});

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

async function completeReleaseDraft(page: Page, options: { royaltySharePercent?: string } = {}) {
  const royaltySharePercent = options.royaltySharePercent ?? E2E_ARTIST_SHARE_PERCENT;
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
  await page.getByTestId('release-royalty-input').fill(royaltySharePercent);

  await page.getByRole('button', { name: 'Continue' }).click();
  const reviewPanel = page.locator('.release-review');
  await expect(reviewPanel.getByText('E2E Published Signal')).toBeVisible();
  await expect(page.locator('.release-stepper button[aria-current="step"]')).toContainText('Review');
  await expect(page.getByTestId('release-preflight-panel')).toContainText('Listening access');
  await expect(page.getByTestId('release-preflight-panel')).toContainText('Published when');
  await expect(page.getByTestId('release-preflight-panel')).toContainText(`0.75 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
  if (Number(royaltySharePercent) > 0) {
    await expect(page.getByTestId('release-value-flow')).toContainText('You receive');
    await expect(page.getByTestId('release-value-flow')).toContainText('100%');
    await expect(page.getByTestId('release-value-flow')).not.toContainText('remainder');
  } else {
    await expect(page.getByTestId('release-value-flow')).toContainText('Payment split');
    await expect(page.getByTestId('release-value-flow')).toContainText('Add at least 0.01%');
    await expect(page.getByTestId('release-value-flow')).not.toContainText('Artist remainder');
  }
}

test('artist can create a runtime, publish a release, and see it in the listener catalog', async ({ page }) => {
  await createArtistProfile(page);
  await completeReleaseDraft(page);

  await page.getByTestId('publish-release-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Release published');
  await expect(dialog).toContainText('Visible in Dotify');
  await expect(dialog.getByText('Technical details')).toBeVisible();
  await expect(dialog.getByText('Artist space record')).not.toBeVisible();

  const publishState = await readArtistPublishState(page);
  expect(publishState?.runtimeCreated).toBe(true);
  expect(publishState?.registerArtistTransactions).toBe(1);
  expect(publishState?.registerTrackTransactions).toBe(1);
  expect(publishState?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(publishState?.devAccountFallbackUsed).toBe(false);

  await page.goto('/');
  const publishedCard = page.getByTestId('track-card').filter({ hasText: 'E2E Published Signal' });
  await expect(publishedCard).toContainText('E2E Artist');
  await expect(publishedCard).toContainText(`0.75 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
  await publishedCard.getByRole('button', { name: 'E2E Artist', exact: true }).click();
  const release = page.locator('.artist-release-card').filter({ hasText: 'E2E Published Signal' });
  await release.getByText('About this release', { exact: true }).click();
  await expect(release).toContainText(`0.75 ${E2E_NATIVE_PAYMENT_SYMBOL}`);
  await expect(release).toContainText('A deterministic artist publish e2e release.');
});

test('artist onboarding handles a missing wallet without enabling profile creation', async ({ page }) => {
  await openArtistScenario(page, 'missing-wallet');

  await expect(page.getByTestId('artist-name-input')).toHaveValue('');
  await expect(page.getByText('Connect your account to create an artist space.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use my account/i })).toBeVisible();
  await expect(page.getByTestId('create-artist-profile')).toBeDisabled();
  await expect(page.getByText('Connect your account to continue.')).toBeVisible();

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

test('upload failure surfaces an error and halts registration', async ({ page }) => {
  await createArtistProfile(page, 'upload-failure');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  await expect(page.getByRole('dialog')).toContainText('Publication needs attention');
  await expect(page.getByRole('dialog')).toContainText('No release was published');
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

  await expect(page.getByRole('dialog')).toContainText('Publication needs attention');
  await expect(page.getByRole('dialog')).toContainText('No release was published');
  await expect(page.getByRole('dialog')).toContainText('E2E registration transaction rejected.');

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(state?.transactionFailures).toBe(1);
  expect(state?.registerTrackTransactions).toBe(0);
});

test('artist publish blocks empty paid royalty splits before metadata and registry work', async ({ page }) => {
  await createArtistProfile(page);
  await completeReleaseDraft(page, { royaltySharePercent: '0' });

  await expect(page.locator('.release-review .error-box')).toContainText('Add at least 0.01% to the artist or another rights holder before publishing.');
  await expect(page.getByTestId('publish-release-button')).toBeDisabled();

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 0 });
  expect(state?.registerTrackTransactions).toBe(0);
});

test('artist publish keeps submitted but unconfirmed transactions at the registry stage', async ({ page }) => {
  await createArtistProfile(page, 'transaction-timeout');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Publication needs attention');
  await expect(dialog).toContainText('confirmation did not finish');
  await expect(dialog).toContainText('check your account activity');

  const roadmapStatuses = await dialog.locator('.transaction-roadmap li').evaluateAll(items => items.map(item => item.getAttribute('data-status')));
  expect(roadmapStatuses).toEqual(['complete', 'complete', 'submitted', 'upcoming']);

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(state?.transactionFailures).toBe(1);
  expect(state?.registerTrackTransactions).toBe(1);
  expect(state?.tracks).toHaveLength(0);
});

test('artist publish remains recoverable while catalog read-back is delayed', async ({ page }) => {
  await createArtistProfile(page, 'catalog-delay');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Approved, still waiting for the catalog');
  await expect(dialog).toContainText('publication approval was confirmed');
  await expect(dialog).toContainText('will not call the release published');
  await expect(dialog).toContainText('Visible in Dotify');

  const state = await readArtistPublishState(page);
  expect(state?.uploadRequests).toEqual({ audio: 1, cover: 1, metadata: 1 });
  expect(state?.registerTrackTransactions).toBe(1);

  await page.goto('/');
  await expect(page.getByTestId('track-card').filter({ hasText: 'E2E Published Signal' })).toHaveCount(0);
});

test('artist publish does not accept a same-hash track from another runtime as visible', async ({ page }) => {
  await createArtistProfile(page, 'catalog-hash-collision');
  await completeReleaseDraft(page);
  await page.getByTestId('publish-release-button').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Approved, still waiting for the catalog');
  await expect(dialog).toContainText('The catalog read-back did not include this release yet.');

  const state = await readArtistPublishState(page);
  expect(state?.registerTrackTransactions).toBe(1);
  expect(state?.tracks).toHaveLength(1);
  expect(state?.tracks[0]?.id.toLowerCase().startsWith(`${E2E_ARTIST_COLLISION_RUNTIME}:`)).toBe(true);
  expect(state?.tracks.some(track => track.id.toLowerCase().startsWith(`${E2E_ARTIST_RUNTIME}:`))).toBe(false);
});

test('new artist mobile overview presents one clear next step and scrollable tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createArtistProfile(page);

  await expect(page.locator('.studio-next-label')).toHaveText('Your next step');
  await expect(page.getByRole('button', { name: 'Start your first release' })).toHaveCount(1);
  await expect(page.getByText('Swipe for more →')).toBeVisible();
  await expect(page.locator('.studio-metric')).toHaveCount(0);
});
