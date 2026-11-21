import { expect, test } from '@playwright/test';

test('only an explicit read contacts the Host, and its report contains no account data', async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/fixtures/host-qualification.html');
  await expect(page.getByRole('button', { name: 'Read app information', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual([]);
  await expect(page.getByRole('button', { name: 'Copy support report' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Read app information', exact: true }).click();
  await expect(page.getByText('Runtime 0.31 detected', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('qualification-mobile.png'), animations: 'disabled', fullPage: true });
  await page.getByText('View support report', { exact: true }).click();
  const report = JSON.parse(await page.getByLabel('Support report').inputValue());
  expect(report.hostSoftware.runtimeVersion).toBe('0.31.0');
  expect(JSON.stringify(report)).not.toContain('PRIVATE_UNRELATED_FIELD');
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual(['system.info']);
  expect(requests.some(url => /dotify-api|dotify-signal|eth-rpc|bulletin-paseo|ipfs\.io/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an older Runtime is reported without account or transaction work', async ({ page }) => {
  await page.goto('/e2e/fixtures/host-qualification.html?runtime=0.26.0');
  await page.getByRole('button', { name: 'Read app information' }).click();
  await expect(page.getByText('Runtime needs review', { exact: true })).toBeVisible();
  await page.getByText('View support report').click();
  expect(JSON.parse(await page.getByLabel('Support report').inputValue()).hostSoftware.runtimeVersion).toBe('0.26.0');
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual(['system.info']);
});

test('a stalled read times out once, and its late answer cannot rewrite the report', async ({ page }) => {
  await page.goto('/e2e/fixtures/host-qualification.html?delayed');
  const read = page.getByRole('button', { name: 'Read app information' });
  await read.click();
  await expect(read).toBeDisabled();
  await expect(page.getByText('The Host did not answer in time', { exact: true })).toBeVisible();
  await page.getByText('View support report').click();
  const report = await page.getByLabel('Support report').inputValue();
  expect(JSON.parse(report).hostSoftware).toEqual({ status: 'timeout' });
  await page.evaluate(() => window.qualificationFixture.release());
  await expect(page.getByLabel('Support report')).toHaveValue(report);
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual(['system.info']);
});
