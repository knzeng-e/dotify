import { expect, test, type Page } from '@playwright/test';
import { encodeAbiParameters, pad, parseAbiItem, toEventSelector, toHex } from 'viem';

const account = '0x000000000000000000000000000000000000a711';
const runtime = '0x000000000000000000000000000000000000a712';
const collaborator = '0x000000000000000000000000000000000000b711';
const hash = `0x${'ab'.repeat(32)}` as const;
const paidTopic = toEventSelector(
  parseAbiItem('event MusicRoyRoyaltyPaid(bytes32 indexed contentHash, address indexed listener, address indexed recipient, uint256 amount)')
);

async function openStudio(page: Page) {
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
    ({ account, runtime, hash }) => {
      const titles = ['Street scriptures', 'Mon cerveau', 'Odzambogha'];
      const tracks = titles.map((title, index) => ({
        id: `${runtime}:${index === 0 ? hash : `0x${String(index).repeat(64)}`}`,
        hash: index === 0 ? hash : `0x${String(index).repeat(64)}`,
        source: 'artist',
        artistAddress: account,
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
      localStorage.setItem('dotify:e2e:artist-publish', JSON.stringify({ runtimeCreated: true, tracks }));
      localStorage.setItem(`dotify:artist-name:${account}`, 'Lord Ekomy Ndong');
    },
    { account, runtime, hash }
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

for (const width of [320, 390, 430, 1440]) {
  test(`artist earnings and works are readable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await openStudio(page);
    await expect(page.getByRole('region', { name: 'Release earnings' })).toContainText('4.2 PAS');
    for (const tab of ['Overview', 'Releases', 'Earnings', 'Rights']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.locator('.studio-portrait img')).toHaveAttribute('data-cover-loaded', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`studio-${tab}-${width}.png`), fullPage: true, animations: 'disabled' });
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
