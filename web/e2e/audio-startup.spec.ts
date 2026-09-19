import { expect, test, type Page } from '@playwright/test';

type AudioStartupSnapshot = {
  dav2: Array<{ phase: string; elapsedMs: number }>;
  host: Array<{ phase: string; elapsedMs: number }>;
  latestFirstSoundMs: number | null;
};

declare global {
  interface Window {
    __DOTIFY_AUDIO_STARTUP__?: {
      snapshot: () => AudioStartupSnapshot;
      clear: () => void;
    };
  }
}

async function readStartupSnapshot(page: Page) {
  return page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.snapshot());
}

function dav2IntentFixture(): Uint8Array {
  const header = new TextEncoder().encode(
    JSON.stringify({
      schema: 'dotify.audio.v2',
      version: 1,
      algorithm: 'AES-256-GCM',
      mediaMime: 'audio/mpeg',
      chunkSize: 4,
      chunkCount: 1,
      plaintextLength: 4,
      contentHash: `0x${'11'.repeat(32)}`,
      noncePrefix: '22'.repeat(8),
      chunks: [{ index: 0, plainLength: 4, encryptedLength: 20 }]
    })
  );
  const container = new Uint8Array(8 + header.length + 20);
  container.set(new TextEncoder().encode('DAV2'));
  new DataView(container.buffer).setUint32(4, header.length, false);
  container.set(header, 8);
  container.fill(5, 8 + header.length);
  return container;
}

test('audio startup telemetry is retained for QA in the browser', async ({ page }) => {
  await page.goto('/?e2eRoom=public');

  await expect.poll(() => page.evaluate(() => typeof window.__DOTIFY_AUDIO_STARTUP__?.snapshot === 'function')).toBe(true);

  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());
  await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect.poll(async () => (await readStartupSnapshot(page))?.host.some(metric => metric.phase === 'playback-intent')).toBe(true);

  await page.evaluate(() => {
    window.__DOTIFY_AUDIO_STARTUP__?.clear();
    window.dispatchEvent(
      new CustomEvent('dotify:dav2-startup', {
        detail: {
          phase: 'first-range-ready',
          audioRef: 'dotify:enc:v2:ipfs://bafy-audio',
          cid: 'bafy-audio',
          elapsedMs: 317.4,
          timestamp: Date.now(),
          gatewayUrl: 'https://gateway.example/ipfs/bafy-audio',
          rangeStart: 512,
          rangeEnd: 1024,
          chunkIndex: 0,
          hedged: true,
          fromCache: false
        }
      })
    );
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: {
          phase: 'first-audio',
          source: 'data:audio/wav;base64,test',
          elapsedMs: 821.6,
          timestamp: Date.now(),
          durationSeconds: 2
        }
      })
    );
  });

  const dav2Snapshot = await readStartupSnapshot(page);
  expect(dav2Snapshot?.dav2).toEqual([expect.objectContaining({ phase: 'first-range-ready', elapsedMs: 317.4 })]);
  expect(dav2Snapshot?.host).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'first-audio', elapsedMs: 821.6 })]));
  expect(dav2Snapshot?.latestFirstSoundMs).toBe(821.6);
});

test('resuming an already loaded track records a fresh warm startup attempt', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eSync=on&e2eAutoplay=on');

  const trackAction = page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ });
  await trackAction.click();
  const audio = page.locator('audio.native-player-source').first();
  await expect(audio).toHaveJSProperty('paused', false);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(audio).toHaveJSProperty('paused', true);

  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await trackAction.click();
  await expect(audio).toHaveJSProperty('paused', false);

  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.map(metric => metric.phase))
    .toEqual(expect.arrayContaining(['playback-intent', 'first-audio']));

  const snapshot = await readStartupSnapshot(page);
  const playbackIntentIndex = snapshot?.host.findIndex(metric => metric.phase === 'playback-intent') ?? -1;
  const firstAudioIndex = snapshot?.host.findIndex(metric => metric.phase === 'first-audio') ?? -1;
  expect(playbackIntentIndex).toBeGreaterThanOrEqual(0);
  expect(firstAudioIndex).toBeGreaterThan(playbackIntentIndex);
  expect(snapshot?.latestFirstSoundMs).not.toBeNull();
});

test('the readiness panel captures a candidate-bound first-sound sample without media identifiers', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eReadiness=true');
  await page.getByRole('button', { name: 'You', exact: true }).click();

  const panel = page.locator('[aria-labelledby="first-sound-evidence-title"]');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Use this candidate' }).click();
  await panel.getByLabel('Tested surface').selectOption('standalone-chrome');
  await panel.getByLabel('Listening flow').selectOption('free');
  await panel.getByLabel('Cache condition').selectOption('cold');
  await panel.getByRole('button', { name: 'Start sample' }).click();

  await page.evaluate(() => {
    const timestamp = Date.now();
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: { phase: 'playback-intent', source: 'private-track-id', elapsedMs: 0, timestamp }
      })
    );
    window.dispatchEvent(
      new CustomEvent('dotify:dav2-startup', {
        detail: {
          phase: 'first-range-ready',
          audioRef: 'dotify:enc:v2:ipfs://private-audio-ref',
          cid: 'private-cid',
          elapsedMs: 300,
          timestamp: timestamp + 300,
          gatewayUrl: 'https://private-gateway.example/ipfs/private-cid',
          rangeStart: 100,
          rangeEnd: 399,
          intentPrefetched: true
        }
      })
    );
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: { phase: 'source-selected', source: 'blob:private-source', elapsedMs: 0, timestamp: timestamp + 500 }
      })
    );
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: { phase: 'first-audio', source: 'blob:private-source', elapsedMs: 312, timestamp: timestamp + 812, durationSeconds: 10 }
      })
    );
  });

  await panel.getByRole('button', { name: 'Capture result' }).click();
  await expect(panel.getByText('1 sanitized sample')).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('dotify:first-sound-evidence:v1'));
  expect(stored).toContain('"firstSoundMs":812');
  expect(stored).toContain('"cacheState":"cold"');
  expect(stored).not.toContain('private-audio-ref');
  expect(stored).not.toContain('private-gateway');
  expect(stored).not.toContain('private-source');
});

test('DAV2 chunk decryption runs in a real browser worker', async ({ page }) => {
  await page.goto('/?e2eRoom=public');

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/features/catalog/audioV2Decryptor.ts';
    const { createAudioV2ChunkDecryptor } = await import(moduleUrl);
    const keyBytes = new Uint8Array(32).fill(0x7a);
    const clearBytes = new TextEncoder().encode('real browser worker audio');
    const header = {
      schema: 'dotify.audio.v2' as const,
      version: 1 as const,
      algorithm: 'AES-256-GCM' as const,
      chunkSize: clearBytes.length,
      chunkCount: 1,
      plaintextLength: clearBytes.length,
      mediaMime: 'audio/mpeg',
      contentHash: `0x${'ab'.repeat(32)}`,
      noncePrefix: '0102030405060708',
      chunks: [{ index: 0, plainLength: clearBytes.length, encryptedLength: clearBytes.length + 16 }]
    };
    const nonce = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]);
    const aad = new TextEncoder().encode(
      [
        header.schema,
        String(header.version),
        header.contentHash,
        String(header.chunkSize),
        String(header.chunkCount),
        String(header.plaintextLength),
        header.mediaMime,
        '0',
        String(clearBytes.length)
      ].join('|')
    );
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, cryptoKey, clearBytes));
    const decryptor = await createAudioV2ChunkDecryptor({ header, key: keyBytes });
    try {
      const decrypted = await decryptor.decrypt(0, encrypted);
      return { execution: decryptor.execution, text: new TextDecoder().decode(decrypted) };
    } finally {
      decryptor.close();
    }
  });

  expect(result).toEqual({ execution: 'worker', text: 'real browser worker audio' });
});

test('track intent warms encrypted DAV2 bytes without requesting a content key', async ({ page }) => {
  const container = dav2IntentFixture();
  const ranges: string[] = [];
  await page.route('**/ipfs/bafy-e2e-intent-audio', async route => {
    const range = route.request().headers().range;
    ranges.push(range ?? '');
    const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '');
    if (!match) return route.fulfill({ status: 400, body: 'range required' });
    const start = Number(match[1]);
    const requestedEnd = Number(match[2]);
    const end = Math.min(requestedEnd, container.length - 1);
    return route.fulfill({
      status: 206,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end}/${container.length}`
      },
      body: Buffer.from(container.slice(start, end + 1))
    });
  });

  await page.goto('/?e2eRoom=protected-authorized&e2eDav2Intent=on');
  const protectedCover = page.getByTestId('track-card').filter({ hasText: 'E2E Protected Room Track' }).getByTestId('track-artwork-action');
  await protectedCover.hover();

  await expect.poll(() => ranges.length).toBe(2);
  expect(ranges[0]).toBe('bytes=0-65535');
  expect(ranges[1]).toMatch(/^bytes=\d+-\d+$/);
  expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
});
