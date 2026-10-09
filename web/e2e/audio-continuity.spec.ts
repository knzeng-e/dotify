import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createCipheriv } from 'node:crypto';

const key = Buffer.alloc(32, 7);
const plain = readFileSync(new URL('./fixtures/continuity-tone.mp3', import.meta.url));
const chunkSize = 16 * 1024;

function fixture(digit: string) {
  const header = {
    schema: 'dotify.audio.v2',
    version: 1,
    algorithm: 'AES-256-GCM',
    mediaMime: 'audio/mpeg',
    contentHash: `0x${digit.repeat(64)}`,
    noncePrefix: '2222222222222222',
    chunkSize,
    chunkCount: Math.ceil(plain.length / chunkSize),
    plaintextLength: plain.length,
    chunks: [] as { index: number; plainLength: number; encryptedLength: number }[]
  };
  const chunks: Buffer[] = [];
  for (let index = 0; index < header.chunkCount; index++) {
    const clear = plain.subarray(index * chunkSize, (index + 1) * chunkSize);
    header.chunks.push({ index, plainLength: clear.length, encryptedLength: clear.length + 16 });
    const nonce = Buffer.alloc(12);
    Buffer.from(header.noncePrefix, 'hex').copy(nonce);
    nonce.writeUInt32BE(index, 8);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(
      Buffer.from(
        [
          header.schema,
          header.version,
          header.contentHash,
          header.chunkSize,
          header.chunkCount,
          header.plaintextLength,
          header.mediaMime,
          index,
          clear.length
        ].join('|')
      )
    );
    chunks.push(Buffer.concat([cipher.update(clear), cipher.final(), cipher.getAuthTag()]));
  }
  const json = Buffer.from(JSON.stringify(header)),
    prefix = Buffer.alloc(8);
  prefix.write('DAV2');
  prefix.writeUInt32BE(json.length, 4);
  const bodyOffset = 8 + json.length;
  return { bytes: Buffer.concat([prefix, json, ...chunks]), firstStart: bodyOffset, failingStart: bodyOffset + chunks[0].length + chunks[1].length };
}

type Fault = 'none' | 'retry' | 'fallback' | 'slow' | 'corrupt' | 'denied' | 'failed-fallback' | 'failed-startup' | 'key-retry';
async function setup(page: Page, fault: Fault = 'none', holdRecovery = false) {
  const media = { a: fixture('1'), b: fixture('2') };
  const requests: string[] = [];
  let attempts = 0;
  let keyRequests = 0;
  let releaseRecovery = () => {};
  const recoveryGate = new Promise<void>(resolve => {
    releaseRecovery = resolve;
  });
  await page.route('**/*', async route => {
    const request = route.request(),
      url = request.url();
    if (url.startsWith('http://127.0.0.1:5286') || url.startsWith('blob:http://127.0.0.1:5286/')) return route.continue();
    if (url.endsWith('/free-key')) {
      keyRequests++;
      if (fault === 'key-retry' && keyRequests === 1) return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
      return route.fulfill({
        json:
          fault === 'denied'
            ? { access: 'denied', reason: 'ACCESS_DENIED', message: 'Unavailable', hostAction: { type: 'none', label: '' } }
            : { access: 'allowed', playbackMode: 'full', contentKey: `0x${key.toString('hex')}`, runtime: `0x${'33'.repeat(20)}` }
      });
    }
    if (url.startsWith('http://rpc.audio.test')) return route.fulfill({ json: { jsonrpc: '2.0', id: request.postDataJSON().id, result: '0x190f1b41' } });
    const match = /\/ipfs\/continuity-([ab])/.exec(url);
    if (!match) return route.fulfill({ status: 503, body: 'No live network in media regression tests' });
    const name = match[1] as 'a' | 'b',
      item = media[name];
    const range = request.headers().range;
    requests.push(`${name}:${range ?? 'full'}`);
    if (!range) {
      if (holdRecovery && name === 'a') await recoveryGate;
      return route.fulfill({ status: fault === 'failed-fallback' || fault === 'failed-startup' ? 503 : 200, body: item.bytes });
    }
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range)!;
    const start = Number(from),
      end = Math.min(Number(to), item.bytes.length - 1);
    if (fault === 'failed-startup' && name === 'a' && start === item.firstStart) return route.fulfill({ status: 503, body: 'First range unavailable' });
    if (name === 'a' && start === item.failingStart) {
      attempts++;
      if (fault === 'slow') await new Promise(resolve => setTimeout(resolve, 6000));
      if (fault === 'fallback' || fault === 'failed-fallback') {
        await new Promise(resolve => setTimeout(resolve, 2400));
        return route.fulfill({ status: 503, body: 'Range outage' });
      }
      if (fault === 'retry' && attempts === 1) return route.fulfill({ status: 503, body: 'Transient range outage' });
    }
    const body = Buffer.from(item.bytes.subarray(start, end + 1));
    if (fault === 'corrupt' && name === 'a' && start === item.failingStart) body[0] ^= 1;
    return route.fulfill({
      status: 206,
      body,
      headers: { 'content-range': `bytes ${start}-${end}/${item.bytes.length}`, 'content-type': 'application/octet-stream' }
    });
  });
  await page.goto('/e2e/fixtures/audio-continuity.html');
  await page.evaluate(() => {
    Reflect.set(window, 'continuityEvents', []);
    document.addEventListener(
      'playing',
      event => {
        if (event.target instanceof HTMLAudioElement)
          Reflect.get(window, 'continuityEvents').push({ time: event.target.currentTime, source: event.target.src });
      },
      true
    );
  });
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  return { requests, attempts: () => attempts, keyRequests: () => keyRequests, releaseRecovery };
}

const audio = (page: Page) => page.locator('audio').first();
const time = (page: Page) => audio(page).evaluate(element => element.currentTime);
async function playing(page: Page, minimum = 0.5) {
  await expect.poll(() => time(page)).toBeGreaterThan(minimum);
  await expect(audio(page)).toHaveJSProperty('paused', false);
  const before = await time(page);
  await expect.poll(() => time(page)).toBeGreaterThan(before + 0.1);
}

test('a transient 503 retries the same segment without replacing the player', async ({ page }) => {
  const probe = await setup(page, 'retry');
  await playing(page);
  await expect.poll(probe.attempts).toBe(2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  expect(probe.requests.some(request => request.endsWith('full'))).toBe(false);
});

test('full-file recovery resumes the media clock before any replacement playing event', async ({ page }) => {
  const probe = await setup(page, 'fallback', true);
  // Recovery is deliberately held: the short buffered prefix may already
  // be exhausted. Require the saved clock, then release the replacement.
  await expect.poll(() => time(page)).toBeGreaterThan(1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'recovering');
  const positionAtRelease = await time(page);
  probe.releaseRecovery();
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await playing(page, positionAtRelease + 0.5);
  const starts = await page.evaluate(() => Reflect.get(window, 'continuityEvents') as { time: number; source: string }[]);
  expect(new Set(starts.map(start => start.source)).size).toBe(2);
  expect(starts.at(-1)!.time).toBeGreaterThanOrEqual(positionAtRelease - 0.1);
});

test('pause during recovery remains paused at the saved position', async ({ page }) => {
  const probe = await setup(page, 'fallback', true);
  await playing(page, 1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'recovering');
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  const pausedAt = await time(page);
  probe.releaseRecovery();
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await expect.poll(() => time(page)).toBeCloseTo(pausedAt, 1);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, pausedAt + 0.2);
});

test('reselect and A → B → A create fresh playable streams', async ({ page }) => {
  const probe = await setup(page);
  await playing(page);
  for (const name of ['a', 'b', 'a']) {
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await playing(page);
    await expect(audio(page)).toHaveJSProperty('error', null);
  }
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '4');
  expect(probe.requests.some(request => request.endsWith('full'))).toBe(false);
});

test('a slow segment shows buffering and returns to playing without a reset', async ({ page }) => {
  await setup(page, 'slow');
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'buffering');
  expect(await time(page)).toBeGreaterThan(3);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'playing');
  await playing(page, 4);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});

test('changing tracks cancels the old recovery without overwriting the new selection', async ({ page }) => {
  const probe = await setup(page, 'fallback', true);
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'recovering');
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  probe.releaseRecovery();
  await playing(page);
  await playing(page, 1.5);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', 'b');
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await expect(audio(page)).toHaveJSProperty('error', null);
});

test('an authentication failure never falls back to a complete download', async ({ page }) => {
  const probe = await setup(page, 'corrupt');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  expect(probe.requests.some(request => request.endsWith('full'))).toBe(false);
});

test('a denied key never starts playback', async ({ page }) => {
  const probe = await setup(page, 'denied');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'idle');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'access-not-confirmed');
  expect(probe.keyRequests()).toBe(3);
  // Only the public header/first ciphertext may be warmed, never decrypted.
  expect(probe.requests.some(request => request.endsWith('full'))).toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, 'continuityEvents'))).toEqual([]);
});

test('failure of both range and complete-file recovery ends the loading state', async ({ page }) => {
  await setup(page, 'failed-fallback');
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  await expect(audio(page)).toHaveJSProperty('paused', true);
});

test('failure before metadata settles the pending selection and permits another track', async ({ page }) => {
  await setup(page, 'failed-startup');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});

test('a temporary key-service failure retries authorization and clears its failure on success', async ({ page }) => {
  const probe = await setup(page, 'key-retry');
  await playing(page);
  expect(probe.keyRequests()).toBe(2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
});
