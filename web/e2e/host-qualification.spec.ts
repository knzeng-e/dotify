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

test('account qualification needs two explicit gestures and exports only public addresses with a separate owner acknowledgement', async ({
  page
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/fixtures/account-qualification.html');
  const connect = page.getByRole('button', { name: 'Share my Dotify account' });
  await expect(connect).toBeDisabled();
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual([]);
  await page.getByRole('button', { name: 'Read app information' }).click();
  await expect(connect).toBeEnabled();
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual(['system.info']);
  await connect.click();
  await expect(connect).toBeDisabled();
  await expect(page.getByText('0x9621dde636de098b43efb0fa9b61facfe328f99d', { exact: true })).toBeVisible();
  await page.getByText('View support report', { exact: true }).click();
  const before = JSON.parse(await page.getByLabel('Support report').inputValue());
  expect(before.account.ownerConfirmed).toBe(false);
  await page.getByRole('checkbox', { name: 'This is the account I want to use for my artist space.' }).check();
  const report = JSON.parse(await page.getByLabel('Support report').inputValue());
  expect(report.account.ownerConfirmed).toBe(true);
  expect(report.account.addressMapping).toBe('local-sdk-derivation-only');
  expect(report.boundary).toMatchObject({
    accountRequested: true,
    signingRequested: false,
    chainQueried: false,
    applicationApiContacted: false,
    chainMappingVerified: false,
    signerControlVerified: false
  });
  expect(report.accountContext).toEqual({ productId: 'dotify-test01.dot', derivationIndex: 0, ss58Prefix: 42 });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE_/);
  const calls = await page.evaluate(() => window.qualificationFixture.calls);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toContain('dotify-test01.dot');
  expect(requests.some(url => /dotify-api|dotify-signal|eth-rpc|bulletin-paseo/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('account-qualification-mobile.png'), fullPage: true, animations: 'disabled' });
});

test('account qualification refuses an unsupported Runtime before an account prompt', async ({ page }) => {
  await page.goto('/e2e/fixtures/account-qualification.html?runtime=0.26.0');
  await page.getByRole('button', { name: 'Read app information' }).click();
  await expect(page.getByText('Runtime needs review', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share my Dotify account' })).toBeDisabled();
  expect(await page.evaluate(() => window.qualificationFixture.calls)).toEqual(['system.info']);
});

for (const outcome of ['denied', 'malformed'])
  test(`account ${outcome} yields a bounded report without addresses or a second attempt`, async ({ page }) => {
    await page.goto(`/e2e/fixtures/account-qualification.html?${outcome}`);
    await page.getByRole('button', { name: 'Read app information' }).click();
    const connect = page.getByRole('button', { name: 'Share my Dotify account' });
    await expect(connect).toBeEnabled();
    await connect.click();
    await expect(page.getByText('Account check incomplete. Keep the report before reopening Dotify.')).toBeVisible();
    await expect(connect).toBeDisabled();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await page.getByText('View support report', { exact: true }).click();
    const report = JSON.parse(await page.getByLabel('Support report').inputValue());
    expect(report.account.status).not.toBe('reported');
    expect(report.account).not.toHaveProperty('publicKey');
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE_/);
    expect(await page.evaluate(() => window.qualificationFixture.calls)).toHaveLength(2);
  });
