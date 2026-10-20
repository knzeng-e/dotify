import { expect, test, type Page } from '@playwright/test';

const cid = 'bafybeigl5qg2jtqyz3vcd64q5dlisc5pia7mlr2yurj2tljdu435pgfezq';
const panelFor = (page: Page) => page.locator('[aria-labelledby="celerity-capture-title"]');

async function openPanel(page: Page) {
  await page.goto('/?e2eRoom=public&e2eReadiness=true');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(panelFor(page)).toBeVisible();
}

async function fillMetadata(page: Page) {
  const panel = panelFor(page);
  await panel.getByLabel('Paired run ID').fill('synthetic-operator-01');
  await panel.getByLabel('Deployed executable CID').fill(cid);
  await panel.getByLabel('Device and OS').fill('Synthetic browser fixture');
  await panel.getByLabel('Product Host version').fill('Not a real Product capture');
  await panel.getByRole('combobox', { name: 'Client', exact: true }).selectOption('B');
  await panel.getByRole('combobox', { name: 'Network', exact: true }).selectOption('wifi');
}

// Only this test harness supplies a clock probe; production still needs actual
// Product room admission. These fixtures never prove Celerity delivery.
async function installProbe(page: Page) {
  await page.evaluate(async () => {
    const moduleUrl = '/src/features/rooms/celerityCapture.ts';
    const { celerityCapture } = await import(moduleUrl);
    celerityCapture.setProbe(async () => ({
      at: Date.now(),
      monotonicAt: performance.now(),
      server: 'a'.repeat(32),
      offsetMs: 0,
      uncertaintyMs: 7
    }));
  });
}

test('capture controls stay out of the ordinary listener surface', async ({ page }) => {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(panelFor(page)).toHaveCount(0);
});

test('capture fails explicitly without a connected Product room and diagnostics never start a recorder', async ({ page }) => {
  await openPanel(page);
  await fillMetadata(page);
  const panel = panelFor(page);
  await panel.getByLabel('Deployed executable CID').fill('not-a-cid');
  await panel.getByRole('button', { name: 'Start capture', exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveText('A valid deployed executable CID is required.');
  await panel.getByLabel('Deployed executable CID').fill(cid);
  await panel.getByRole('button', { name: 'Start capture', exact: true }).click();
  await expect(panel.getByRole('alert')).toHaveText('A connected Product room is required for capture');
  await expect(panel.getByRole('button', { name: 'Stop capture', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Copy diagnostics' }).click();
  const diagnostics = JSON.parse(await panel.getByLabel('Diagnostics JSON').inputValue());
  expect(diagnostics.authority).toBe('socket.io');
  expect(diagnostics).not.toHaveProperty('capture');
});

test('operator capture survives navigation, freezes metadata and exports only stopped sanitized records', async ({ page }) => {
  await openPanel(page);
  await fillMetadata(page);
  await installProbe(page);
  const panel = panelFor(page);
  await panel.getByRole('button', { name: 'Start capture', exact: true }).click();
  await expect(panel.getByText('Recording', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Paired run ID')).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Copy capture' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Clear capture', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(panel.getByText('Recording', { exact: true })).toBeVisible();
  await panel.getByRole('combobox', { name: 'Test phase' }).selectOption('background');
  await page.evaluate(async () => {
    const moduleUrl = '/src/features/rooms/celerityCapture.ts';
    const { celerityCapture } = await import(moduleUrl);
    celerityCapture.frame(new TextEncoder().encode('private-payload'), {
      stream: 'private-member-id',
      seq: 1,
      kind: 'chat',
      stage: 'attempt',
      ttlMs: 10000
    });
  });
  await panel.getByRole('button', { name: 'Calibrate clock' }).click();
  await panel.getByRole('button', { name: 'Stop capture', exact: true }).click();
  await expect(panel.getByText('Stopped', { exact: true })).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('blocked'))
      }
    })
  );
  await panel.getByRole('button', { name: 'Copy capture' }).click();
  await expect(panel.getByRole('status')).toHaveText('Clipboard unavailable. JSON is available below.');
  const raw = await panel.getByLabel('Capture JSON', { exact: true }).inputValue();
  const evidence = JSON.parse(raw);
  expect(evidence.metadata).toMatchObject({ cid, client: 'B', network: 'wifi' });
  expect(evidence.endedAt).toBeGreaterThanOrEqual(evidence.startedAt);
  expect(evidence.pending).toBe(0);
  expect(evidence.clocks).toHaveLength(2);
  expect(evidence.frames).toHaveLength(1);
  expect(evidence.frames[0]).toMatchObject({ phase: 'background', stage: 'attempt' });
  expect(raw).not.toContain('private-payload');
  expect(raw).not.toContain('private-member-id');
  expect(evidence).not.toHaveProperty('observations');
  await panel.getByRole('button', { name: 'Clear capture', exact: true }).click();
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Start capture', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Clear capture', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm clear capture', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Start capture', exact: true })).toBeEnabled();
});

for (const width of [320, 390, 430, 1280]) {
  test(`operator controls remain reachable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await openPanel(page);
    await fillMetadata(page);
    const panel = panelFor(page);
    await expect(panel.getByRole('button', { name: 'Copy diagnostics' })).toBeVisible();
    await panel.getByRole('button', { name: 'Copy diagnostics' }).click();
    await expect(panel.getByLabel('Diagnostics JSON')).toBeVisible();
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const inputs = panel.locator('input, select, button');
    for (const control of await inputs.all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await panel.screenshot({ path: testInfo.outputPath(`celerity-operator-${width}.png`) });
    await panel.getByLabel('Diagnostics JSON').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`celerity-export-viewport-${width}.png`) });
  });
}
