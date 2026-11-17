import { expect, test, type Page } from '@playwright/test';

async function mount(page: Page, harness: 'mountPreparationRetry' | 'mountCatalogConfirmation') {
  await page.goto('/?e2eArtist=happy');
  await page.evaluate(async name => {
    const path = '/e2e/fixtures/publication-review.tsx';
    const fixtures = await import(/* @vite-ignore */ path);
    fixtures[name]();
  }, harness);
}

for (const change of ['draft', 'account'] as const) {
  test(`preparation retry revalidates the current ${change} after background edits`, async ({ page }) => {
    await mount(page, 'mountPreparationRetry');
    await page.getByRole('button', { name: 'Start fixture publication' }).click();
    await expect(page.getByRole('dialog', { name: 'Preparing your music' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: change === 'draft' ? 'Remove draft recipients' : 'Disconnect fixture account' }).click();
    await page.getByRole('button', { name: 'Fail fixture preparation' }).click();
    await expect(page.getByRole('dialog', { name: 'Publication needs attention' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry preparation', exact: true }).click();
    await expect(page.getByRole('dialog', { name: change === 'draft' ? 'Payment split incomplete' : 'Account required' })).toBeVisible();
    await expect(page.getByTestId('fixture-status')).toHaveText(
      change === 'draft' ? 'Add at least 0.01% to the artist or another rights holder before publishing.' : 'Connect your account before publishing'
    );
    expect(await page.evaluate(() => window.__DOTIFY_E2E_ARTIST_PUBLISH__?.registerTrackTransactions ?? 0)).toBe(0);
  });
}

for (const otherTask of ['payment', 'recovery'] as const) {
  test(`catalog confirmation preserves another ${otherTask} dialog and still reconciles`, async ({ page }) => {
    await mount(page, 'mountCatalogConfirmation');
    await page.getByRole('button', { name: `Confirm behind ${otherTask}` }).click();
    const dialog = page.getByRole('dialog', { name: otherTask === 'payment' ? 'Approve another payment' : 'Another task needs attention' });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('fixture-confirmation')).toContainText('"reads":1');
    // Resolve through the browser rather than clicking behind the modal.
    await page.getByRole('button', { name: 'Resolve catalog read' }).evaluate(button => (button as HTMLButtonElement).click());
    await expect(page.getByTestId('fixture-confirmation')).toContainText('"pending":false');
    await expect(page.getByTestId('fixture-confirmation')).toContainText('"status":"Release published"');
    await expect(page.getByTestId('fixture-confirmation')).toContainText('"navigations":0');
    await expect(dialog).toBeVisible();
    if (otherTask === 'recovery') {
      await page.getByRole('button', { name: 'Recover another task' }).click();
      await expect(page.getByTestId('fixture-confirmation')).toContainText('"recoveryClicks":1');
    }
  });
}

test('visibility checks are single-flight and shared catalog updates finish a stopped observation', async ({ page }) => {
  await page.clock.install();
  await mount(page, 'mountCatalogConfirmation');
  await page.getByRole('button', { name: 'Confirm fixture approval', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Release approved' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Check visibility', exact: true })).toBeDisabled();
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"reads":1');
  await page.getByRole('button', { name: 'Check fixture visibility' }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"reads":1');
  await page.getByRole('button', { name: 'Use empty catalog responses' }).evaluate(button => (button as HTMLButtonElement).click());
  await page.clock.runFor(10 * 60_000);
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"reads":28');
  await expect(dialog).toContainText('Approval confirmed');
  await expect(dialog).toContainText('taking longer to appear');
  await expect(dialog.getByRole('button', { name: 'Check visibility', exact: true })).toBeEnabled();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"reads":28');
  await page.getByRole('button', { name: 'Reveal shared catalog track' }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"pending":false');
  await expect(page.getByTestId('fixture-confirmation')).toContainText('"navigations":1');
  await expect(page.getByRole('dialog')).toContainText('Release published');
});
