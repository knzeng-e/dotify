import { expect, test, type Page } from '@playwright/test';
async function openGift(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.locator('.catalogue-card .artist-text-button').first().click();
  await page.getByRole('button', { name: 'Give to the artist', exact: true }).click();
  await expect(page.getByLabel('Gift amount (PAS)')).toBeVisible();
}
async function giftState(page: Page) {
  return page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_DONATION__') as { sends: number; confirmed: boolean });
}
for (const width of [390, 1440]) {
  test(`gift at ${width}px confirms the amount and artist without buying access`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await openGift(page);
    await page.getByLabel('Gift amount (PAS)').fill('0,25');
    await page.getByRole('button', { name: 'Review gift', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('does not unlock paid tracks');
    await expect(dialog).toContainText('Dotify Test Artist');
    await expect(dialog).toContainText('0.25 PAS');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const confirm = page.getByRole('button', { name: 'Confirm gift · 0.25 PAS', exact: true });
    const box = await confirm.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: info.outputPath(`gift-review-${width}.png`) });
    await confirm.click();
    await expect(page.getByRole('heading', { name: 'Gift confirmed' })).toBeVisible();
    expect((await giftState(page)).sends).toBe(1);
    const access = await page.evaluate(() => Reflect.get(window, '__DOTIFY_E2E_CLASSIC_UNLOCK__') as { paid: boolean; accessGranted: boolean });
    expect(access.paid).toBe(false);
    expect(access.accessGranted).toBe(false);
    await page.getByRole('button', { name: 'Close gift' }).click();
    await expect(page.getByRole('button', { name: 'Give to the artist' })).toBeFocused();
  });
}
test('an interrupted gift is checked without a second transfer', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGift(page, '?e2eGift=delayed');
  await page.getByLabel('Gift amount (PAS)').fill('0.1');
  await page.getByRole('button', { name: 'Review gift', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm gift · 0.1 PAS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Confirmation was interrupted');
  await page.screenshot({ path: info.outputPath('gift-recovery-390.png') });
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').confirmed = true;
  });
  await page.getByRole('button', { name: 'Check gift status' }).click();
  await expect(page.getByRole('heading', { name: 'Gift confirmed' })).toBeVisible();
  expect((await giftState(page)).sends).toBe(1);
});
test('invalid amounts and rejected signatures do not show a success receipt', async ({ page }) => {
  await openGift(page, '?e2eGift=reject');
  await page.getByLabel('Gift amount (PAS)').fill('0');
  await page.getByRole('button', { name: 'Review gift', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  expect((await giftState(page)).sends).toBe(0);
  await page.getByLabel('Gift amount (PAS)').fill('1');
  await page.getByRole('button', { name: 'Review gift', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm gift · 1 PAS', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('No gift was sent');
  await expect(page.getByRole('heading', { name: 'Gift confirmed' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review again' })).toBeVisible();
});
