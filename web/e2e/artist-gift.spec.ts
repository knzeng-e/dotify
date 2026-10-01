import { expect, test, type Page } from '@playwright/test';
function amountField(page: Page, kind: 'gift' | 'tip' = 'gift') {
  return page.getByLabel(`${kind === 'gift' ? 'Gift' : 'Tip'} amount (PAS)`, { exact: true });
}
async function openGift(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.locator('.catalogue-card .artist-text-button').first().click();
  await expect(page.getByRole('heading', { name: 'Dotify Test Artist', exact: true })).toBeVisible();
  const gift = page.getByRole('main').getByRole('button', { name: 'Give to the artist', exact: true });
  await expect(gift).toBeVisible();
  await expect(async () => {
    await gift.click();
    await expect(page.getByRole('dialog', { name: 'Give to Dotify Test Artist' })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(amountField(page, 'gift')).toBeVisible();
}
async function review(page: Page, amount = '0.25', kind: 'gift' | 'tip' = 'gift') {
  await amountField(page, kind).fill(amount);
  await page.getByRole('button', { name: 'Review contribution', exact: true }).click();
}
async function giftState(page: Page) {
  return page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__') as { sends: number; confirmed: boolean });
}
for (const width of [320, 390, 430, 1440]) {
  test(`gift review and dated receipt at ${width}px preserve listening access`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await openGift(page);
    await review(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Where your contribution goes');
    await expect(dialog).toContainText('0.25 PAS');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`gift-review-${width}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Confirm gift · 0.25 PAS', exact: true }).click();
    await expect(dialog).toContainText('Contribution confirmed');
    await expect(dialog.locator('time')).toBeVisible();
    expect((await giftState(page)).sends).toBe(1);
    const access = await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_CLASSIC_UNLOCK__') as { paid: boolean; accessGranted: boolean });
    expect(access.paid).toBe(false);
    expect(access.accessGranted).toBe(false);
    await page.getByRole('button', { name: 'Close contribution' }).click();
    await expect(page.getByRole('button', { name: 'Give to the artist', exact: true })).toBeFocused();
  });
}
test('the player offers a work-specific tip', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('track-card-open').first().click();
  await page.getByRole('button', { name: 'Support this track', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Listening access stays unchanged');
  await review(page, '0.5', 'tip');
  await expect(page.getByRole('button', { name: 'Confirm tip · 0.5 PAS', exact: true })).toBeVisible();
});
test('a confirmed gift is visible in You with a dated exportable receipt', async ({ page }, info) => {
  await openGift(page);
  await review(page, '0.5');
  await page.getByRole('button', { name: 'Confirm gift · 0.5 PAS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Contribution confirmed');
  await page.getByRole('button', { name: 'Close contribution' }).click();
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
test('a pending contribution can close and reopen without another transfer', async ({ page }) => {
  await openGift(page, '?e2eGift=pending');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Closing does not cancel');
  await page.getByRole('button', { name: 'Close contribution' }).click();
  await page.getByRole('button', { name: 'Give to the artist', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Closing does not cancel');
  expect((await giftState(page)).sends).toBe(1);
  await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__').complete());
  await expect(page.getByRole('dialog')).toContainText('Contribution confirmed');
});
test('an interrupted contribution is recovered without a second payment', async ({ page }) => {
  await openGift(page, '?e2eGift=delayed');
  await review(page, '0.1');
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Confirmation was interrupted');
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').confirmed = true;
  });
  await page.getByRole('button', { name: 'Check status · no new payment' }).click();
  await expect(page.getByRole('dialog')).toContainText('Contribution confirmed');
  expect((await giftState(page)).sends).toBe(1);
});
test('zero amounts and rejected signatures never show a successful receipt', async ({ page }) => {
  await openGift(page, '?e2eGift=reject');
  await review(page, '0');
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await review(page, '1');
  await page.getByRole('button', { name: 'Confirm gift · 1 PAS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('No contribution was sent');
  await expect(page.getByRole('dialog')).not.toContainText('Contribution confirmed');
});
