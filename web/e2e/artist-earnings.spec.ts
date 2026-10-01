import { expect, test, type Page } from '@playwright/test';
import { encodeAbiParameters, pad, parseAbiItem, toEventSelector, toHex } from 'viem';

const account = '0x000000000000000000000000000000000000a711';
const runtime = '0x000000000000000000000000000000000000a712';
const collaborator = '0x000000000000000000000000000000000000b711';
const hash = `0x${'ab'.repeat(32)}` as const;
const paidTopic = toEventSelector(
  parseAbiItem('event MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount)')
);

async function openStudio(page: Page, options: { collaboratorOnly?: boolean } = {}) {
  const control = { failed: false, payments: 1, queries: 0 };
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image' && route.request().url().includes('QmYtt')) {
      return route.fulfill({ path: 'e2e/fixtures/artist-cover.svg', contentType: 'image/svg+xml' });
    }
    if (route.request().method() !== 'POST') return route.continue();
    let body;
    try {
      body = route.request().postDataJSON();
    } catch {
      return route.continue();
    }
    if (!body?.jsonrpc) return route.continue();
    let result: unknown = '0x';
    if (body.method === 'eth_chainId') result = toHex(420420417);
    else if (body.method === 'eth_call') result = encodeAbiParameters([{ type: 'uint256' }], [0n]);
    else if (body.method === 'eth_getCode') result = '0x01';
    else if (body.method === 'eth_getLogs') {
      control.queries++;
      if (control.failed) return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, error: { code: -32603, message: 'History unavailable' } } });
      result =
        body.params[0].topics[0] === paidTopic
          ? Array.from({ length: control.payments }, (_, index) =>
              [account, collaborator].map((recipient, split) => ({
                address: runtime,
                blockHash: `0x${'de'.repeat(32)}`,
                blockNumber: toHex(100 + index),
                transactionHash: `0x${String(index + 1).padStart(64, '0')}`,
                transactionIndex: '0x0',
                logIndex: toHex(split),
                removed: false,
                topics: [paidTopic, hash, pad(collaborator), pad(recipient)],
                data: encodeAbiParameters([{ type: 'uint256' }], [split === 0 ? 1764000000000000000n : 2436000000000000000n])
              }))
            ).flat()
          : [];
    } else if (body.method === 'eth_getBlockByNumber')
      result = { number: body.params[0], hash: `0x${'de'.repeat(32)}`, timestamp: toHex(1790798400), transactions: [] };
    return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result } });
  });
  await page.addInitScript(
    ({ account, runtime, hash, collaborator, collaboratorOnly }) => {
      const titles = ['Street scriptures', 'Mon cerveau', 'Odzambogha'];
      const tracks = titles.map((title, index) => ({
        id: `${runtime}:${index === 0 ? hash : `0x${String(index).repeat(64)}`}`,
        hash: index === 0 ? hash : `0x${String(index).repeat(64)}`,
        source: 'artist',
        artistAddress: collaboratorOnly ? collaborator : account,
        artist: 'Lord Ekomy Ndong',
        title,
        zone: 'Gabon',
        imageRef: 'ipfs://QmYttHXoEPnTVNXiqTxjJi6ZTKin8DXF4FnQjGE1yHMQQw',
        audioRef: '',
        priceDot: '4.2',
        description: 'An independent release from Gabon.',
        bulletinRef: '',
        metadataRef: '',
        royaltyBps: 10000,
        durationLabel: '3:12',
        accessMode: 'classic',
        active: true,
        royaltySplits: [{ recipient: account, bps: 4200, label: 'Artist' }],
        personhoodLevel: 'DIM1',
        encrypted: true,
        registeredAtBlock: 2
      }));
      localStorage.setItem('dotify:e2e:artist-publish', JSON.stringify({ runtimeCreated: !collaboratorOnly, tracks }));
      localStorage.setItem(`dotify:artist-name:${account}`, 'Lord Ekomy Ndong');
    },
    { account, runtime, hash, collaborator, collaboratorOnly: options.collaboratorOnly ?? false }
  );
  await page.goto('/artists?e2eArtist=happy');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  return control;
}

test('overview loads real event-shaped earnings, refreshes automatically, and preserves last amounts on failure', async ({ page }) => {
  const control = await openStudio(page);
  const summary = page.getByRole('region', { name: 'Release earnings' });
  await expect(summary).toContainText('4.2 PAS');
  await expect(summary).toContainText('1.764 PAS');
  control.payments = 2;
  await expect(summary).toContainText('8.4 PAS', { timeout: 22000 });
  await expect(summary).toContainText('3.528 PAS');
  control.failed = true;
  await page.getByRole('button', { name: 'Refresh earnings' }).click();
  await expect(summary).toContainText('Update delayed');
  await expect(summary).toContainText('8.4 PAS');
  await page.getByRole('tab', { name: 'Earnings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'By release' })).toBeVisible();
  await expect(page.locator('.earnings-release-row').first()).toContainText('2 payments');
});

test('unavailable history is never displayed as zero earned', async ({ page }) => {
  const control = await openStudio(page);
  control.failed = true;
  await page.reload();
  const summary = page.getByRole('region', { name: 'Release earnings' });
  await expect(summary).toContainText('History unavailable');
  await expect(summary.locator('.earnings-totals > div').first()).toContainText('Unavailable');
  await expect(summary.locator('.earnings-totals > div').first()).not.toContainText('0 PAS');
});

async function addContributionSources(page: Page) {
  await page.getByRole('tab', { name: 'Earnings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'All earnings' })).toContainText('4.2 PAS');
  await page.evaluate(
    ({ account, runtime, hash, collaborator }) => {
      const state = Reflect.get(window, '__DOTIFY_E2E_DONATION__');
      const zero = `0x${'0'.repeat(64)}`;
      const base = { runtime, sender: collaborator, host: collaborator, room: zero, campaign: zero, timestamp: Date.now(), transactionHash: hash };
      state.receipts = [
        {
          ...base,
          id: hash,
          contentHash: zero,
          amount: 1000000000000000000n,
          shares: [
            { recipient: account, amount: 400000000000000000n, paid: true, claimed: false, role: 0 },
            { recipient: collaborator, amount: 600000000000000000n, paid: true, claimed: false, role: 0 }
          ]
        },
        {
          ...base,
          id: zero,
          contentHash: hash,
          amount: 2000000000000000000n,
          shares: [
            { recipient: account, amount: 500000000000000000n, paid: false, claimed: false, role: 0 },
            { recipient: collaborator, amount: 1500000000000000000n, paid: true, claimed: false, role: 1 }
          ]
        }
      ];
    },
    { account, runtime, hash, collaborator }
  );
  await page.getByRole('button', { name: 'Refresh all earnings' }).click();
  await expect(page.getByRole('region', { name: 'All earnings' }).locator('.earnings-totals')).toContainText('7.2 PAS');
}

test('earnings leads with all sources, distinguishes shares and keeps its summary across detail tabs', async ({ page }) => {
  await openStudio(page);
  await addContributionSources(page);
  const summary = page.getByRole('region', { name: 'All earnings' });
  const metrics = summary.locator('.earnings-totals > div');
  await expect(metrics.nth(0)).toContainText('7.2 PAS');
  await expect(metrics.nth(1)).toContainText('2.164 PAS');
  await expect(metrics.nth(2)).toContainText('0.5 PAS');
  await expect(page.getByRole('tabpanel', { name: 'Listening payments', exact: true })).toBeVisible();
  await expect(page.locator('.contribution-history')).toHaveCount(0);
  const listening = page.getByRole('tab', { name: 'Listening payments', exact: true });
  await listening.focus();
  await listening.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Gifts & tips', exact: true })).toBeFocused();
  await expect(page.locator('.contribution-history')).toBeVisible();
  await expect(summary).toContainText('7.2 PAS');
  expect((await summary.boundingBox())!.y).toBeLessThan((await page.locator('.earnings-detail').boundingBox())!.y);
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').receipts[1].shares[0].claimed = true;
  });
  await page.getByRole('button', { name: 'Refresh all earnings' }).click();
  await expect(metrics.nth(1)).toContainText('2.664 PAS');
  await expect(metrics.nth(2)).toContainText('0 PAS');
  await expect(metrics.nth(0)).toContainText('7.2 PAS');
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').historyError = 'Receipt source unavailable';
  });
  await page.getByRole('button', { name: 'Refresh all earnings' }).click();
  await expect(summary.getByRole('status')).toContainText('Update delayed');
  await expect(metrics.nth(0)).toContainText('7.2 PAS');
});

test('an unavailable contribution source does not become a misleading global zero', async ({ page }) => {
  await openStudio(page);
  await addContributionSources(page);
  await page.evaluate(() => {
    Reflect.get(window, '__DOTIFY_E2E_DONATION__').historyError = 'Receipt source unavailable';
  });
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Earnings', exact: true }).click();
  const summary = page.getByRole('region', { name: 'All earnings' });
  await expect(summary.getByRole('status')).toContainText('Some sources unavailable');
  await expect(summary.locator('.earnings-totals > div').first()).toContainText('Unavailable');
  await expect(summary.locator('[data-source="listening"]')).toContainText('4.2 PAS');
  await expect(summary.locator('[data-source="gifts"]')).not.toContainText('0 PAS');
});

test('a collaborator without a runtime can create an artist profile without losing earnings', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page, { collaboratorOnly: true });
  await expect(page.getByRole('region', { name: 'Release earnings' })).toContainText('1.764 PAS');
  await expect(page.getByRole('heading', { name: 'Create your artist space' })).toBeVisible();
  const createProfile = page.getByRole('button', { name: 'Create artist profile' });
  await expect(createProfile).toBeDisabled();
  await page.screenshot({ path: info.outputPath('collaborator-profile-390.png'), fullPage: true, animations: 'disabled' });
  await page.getByLabel('I understand and consent to shared listening on Dotify.').check();
  await expect(createProfile).toBeEnabled();
  await createProfile.click();
  await expect(page.getByRole('dialog')).toContainText('Artist registered');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start your first release' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Release earnings' })).toContainText('1.764 PAS');
});

for (const width of [320, 390, 430, 1440]) {
  test(`artist earnings and works are readable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudio(page);
    await expect(page.getByRole('region', { name: 'Release earnings' })).toContainText('4.2 PAS');
    if (width <= 430) expect((await page.locator('.studio-id h1').boundingBox())!.width).toBeGreaterThan(180);
    for (const tab of ['Overview', 'Releases', 'Earnings', 'Rights']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      if (tab === 'Earnings') await addContributionSources(page);
      await expect(page.locator('.studio-portrait img')).toHaveAttribute('data-cover-loaded', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`studio-${tab}-${width}.png`), fullPage: true, animations: 'disabled' });
      if (tab === 'Earnings') {
        await page.getByRole('tab', { name: 'Gifts & tips', exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`studio-contributions-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.getByRole('tab', { name: 'Releases', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search releases' }).fill('cerveau');
    await expect(page.getByRole('tablist', { name: 'Published releases' }).getByRole('tab')).toHaveCount(1);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.screenshot({ path: info.outputPath(`studio-enlarged-${width}.png`), fullPage: true, animations: 'disabled' });
    const overflow = await page.locator('*').evaluateAll(elements =>
      elements
        .filter(element => element.getBoundingClientRect().right > innerWidth || element.scrollWidth > element.clientWidth + 1)
        .map(element => ({
          tag: element.tagName,
          class: element.className,
          width: element.clientWidth,
          scroll: element.scrollWidth,
          text: element.textContent?.slice(0, 60)
        }))
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
  });
}
