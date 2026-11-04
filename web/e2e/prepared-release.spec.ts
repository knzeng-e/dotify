import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`prepared release recovery requires explicit confirmation and preserves cancel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    // The recovery preview reads public artwork only. No live network required.
    await page.route('**/api/assets/**', route => route.fulfill({ status: 404 }));
    await page.goto('/e2e/fixtures/prepared-release.html');
    await page.getByRole('button', { name: 'Show conflict' }).click();
    await page.getByRole('button', { name: 'Review prepared release', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Restore your release details?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Thot Nzeng');
    await expect(dialog).toContainText('1.21 PAS');
    await expect(dialog).toContainText('100%');
    await expect(page.getByTestId('restores')).toHaveText('0');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ animations: 'disabled', path: `/private/tmp/dotify-prepared-release-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Keep current draft', exact: true }).last().click();
    await expect(page.getByTestId('draft')).toHaveText('Current unsaved values');
    await page.getByRole('button', { name: 'Show conflict' }).click();
    await page.getByRole('button', { name: 'Review prepared release', exact: true }).click();
    await page.getByRole('button', { name: 'Use prepared release', exact: true }).click();
    await expect(page.getByTestId('restores')).toHaveText('1');
    await expect(page.getByTestId('draft')).toContainText('Bulletin pilot - 8s');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
for (const change of ['account', 'chain', 'audio', 'runtime', 'disconnect']) {
  test(`stale feedback cannot restore after ${change} changes`, async ({ page }) => {
    await page.goto('/e2e/fixtures/prepared-release.html');
    await page.getByRole('button', { name: 'Show conflict' }).click();
    await page.evaluate(id => document.getElementById(id)!.click(), change === 'disconnect' ? 'disconnect' : `switch-${change}`);
    await page.getByRole('button', { name: 'Review prepared release', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Restore your release details?' })).toHaveCount(0);
    await expect(page.getByTestId('restores')).toHaveText('0');
  });
}
test('an open preview expires when the artist account changes', async ({ page }) => {
  await page.goto('/e2e/fixtures/prepared-release.html');
  await page.getByRole('button', { name: 'Show conflict' }).click();
  await page.getByRole('button', { name: 'Review prepared release', exact: true }).click();
  await page.evaluate(() => document.getElementById('switch-account')!.click());
  await expect(page.getByRole('dialog', { name: 'Restore your release details?' })).toHaveCount(0);
  await expect(page.getByTestId('restores')).toHaveText('0');
});
