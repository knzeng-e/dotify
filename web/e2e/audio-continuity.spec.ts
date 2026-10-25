import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const fixture = JSON.parse(readFileSync(process.env.DOTIFY_STREAMING_FIXTURE_PATH ?? path.join(process.cwd(), '.data/streaming-fixture.json'), 'utf8')) as {
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  manifest: string;
  files: Record<string, string>;
};
type Fault = 'none' | 'relay' | 'retry' | 'truncated' | 'slow' | 'held' | 'corrupt' | 'failed' | 'failed-startup' | 'denied' | 'key-retry';
async function setup(page: Page, fault: Fault = 'none', blob = false) {
  const requests: string[] = [];
  let attempts = 0,
    keyRequests = 0;
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.addInitScript(
    ({ scope, blob }) => {
      Reflect.set(window, '__STREAMING_SCOPE__', scope);
      if (blob) Object.defineProperty(window, 'MediaSource', { value: undefined });
    },
    { scope: fixture.scope, blob }
  );
  await page.route('**/*', async route => {
    const request = route.request(),
      url = request.url();
    if (url.endsWith('/free-key')) {
      keyRequests++;
      if (fault === 'key-retry' && keyRequests === 1) return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
      return route.fulfill({
        json:
          fault === 'denied'
            ? { access: 'denied', reason: 'ACCESS_DENIED', message: 'Unavailable', hostAction: { type: 'none', label: '' } }
            : { access: 'allowed', playbackMode: 'full', contentKey: `0x${fixture.keyHex}`, runtime: fixture.scope.runtimeAddress }
      });
    }
    if (url.startsWith('http://rpc.audio.test')) {
      const rpc = request.postDataJSON();
      return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: rpc.method === 'eth_call' ? `0x${'0'.repeat(63)}1` : '0x190f1b41' } });
    }
    const match = /\/(?:ipfs|api\/media)\/Qm([ab])\1{43}\/(?:stream\/)?(.+)$/.exec(url);
    if (match) {
      const [, name, object] = match;
      requests.push(`${name}:${object}`);
      expect(request.headers().range).toBeUndefined();
      expect(object).not.toContain('archive');
      const value = object === 'manifest.json' ? fixture.manifest : fixture.files[object];
      if (!value) return route.fulfill({ status: 404 });
      if (fault === 'relay' && !url.includes('/api/media/')) return route.fulfill({ status: 503 });
      if (name === 'a' && object === '160/segment-001.bin') {
        attempts++;
        if (fault === 'held') await gate;
        if (fault === 'slow') await new Promise(resolve => setTimeout(resolve, 6000));
        if (fault === 'failed' || (fault === 'retry' && attempts === 1)) return route.fulfill({ status: 503 });
      }
      if (name === 'a' && fault === 'failed-startup' && object === 'manifest.json') return route.fulfill({ status: 503 });
      const body = Buffer.from(value, 'base64');
      if (name === 'a' && fault === 'corrupt' && object === '160/segment-001.bin') body[0] ^= 1;
      if (name === 'a' && fault === 'truncated' && object === '160/segment-001.bin' && attempts === 1)
        return route.fulfill({ body: body.subarray(0, body.length - 10), headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ body, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith('http://127.0.0.1:5286') || url.startsWith('blob:')) return route.continue();
    return route.fulfill({ status: 503, body: 'No live network in synthetic regression tests' });
  });
  await page.goto('/e2e/fixtures/audio-continuity.html');
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  return { requests, attempts: () => attempts, keyRequests: () => keyRequests, release };
}
const audio = (page: Page) => page.locator('audio').first();
const time = (page: Page) => audio(page).evaluate(element => element.currentTime);
async function playing(page: Page, minimum = 0.2) {
  await expect.poll(() => time(page)).toBeGreaterThan(minimum);
  await expect(audio(page)).toHaveJSProperty('paused', false);
}
for (const fault of ['retry', 'truncated', 'relay'] as const)
  test(`${fault}: current streaming retries transport without replacing the player`, async ({ page }) => {
    const probe = await setup(page, fault);
    await playing(page);
    if (fault !== 'relay') await expect.poll(probe.attempts).toBe(2);
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
    expect(probe.keyRequests()).toBe(1);
    expect(probe.requests.every(item => /manifest.json|160\//.test(item))).toBe(true);
  });
test('pause during an outstanding segment stays paused when transport resumes', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await expect.poll(probe.attempts).toBe(1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  const position = await time(page);
  probe.release();
  await page.waitForTimeout(400);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(await time(page)).toBeCloseTo(position, 1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, position + 0.2);
});
test('reselect and A to B to A create fresh authenticated streams', async ({ page }) => {
  await setup(page);
  await playing(page);
  for (const name of ['a', 'b', 'a']) {
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await playing(page);
    await expect(audio(page)).toHaveJSProperty('error', null);
  }
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '4');
});
test('a slow segment buffers and resumes without resetting the media clock', async ({ page }) => {
  await setup(page, 'slow');
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'buffering');
  expect(await time(page)).toBeGreaterThan(3);
  await playing(page, 4.1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});
test('changing track cancels an outstanding read without overwriting the new selection', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  probe.release();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
});
for (const blob of [false, true])
  test(`authentication failure is terminal, without another key or archival fallback (Blob=${blob})`, async ({ page }) => {
    const probe = await setup(page, 'corrupt', blob);
    if (blob) {
      await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
      await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
      await expect(audio(page)).toHaveJSProperty('paused', true);
    } else await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
    expect(probe.attempts()).toBe(1);
    expect(probe.keyRequests()).toBe(1);
  });
test('a denied key never starts playback or downloads media', async ({ page }) => {
  const probe = await setup(page, 'denied');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(probe.requests).toHaveLength(0);
});
test('exhausted segment readers end the loading state and another track can play', async ({ page }) => {
  await setup(page, 'failed');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('failure before metadata settles pending and permits a new selection', async ({ page }) => {
  await setup(page, 'failed-startup');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('a temporary key failure recovers without refresh and anonymous reselect checks access again', async ({ page }) => {
  const probe = await setup(page, 'key-retry');
  // One transient failure, then the existing quiet retry starts real audio.
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  expect(probe.keyRequests()).toBe(2);
  // This visitor has no signed session/prepared grant. A new selection must
  // recheck Free access instead of reusing the retired indefinite key map.
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await playing(page);
  expect(probe.keyRequests()).toBe(3);
});
test('hosts without MSE retry ciphertext objects and play the same authenticated AAC rendition', async ({ page }) => {
  const probe = await setup(page, 'retry', true);
  await playing(page);
  expect(probe.attempts()).toBe(2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});
