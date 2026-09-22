import { expect, test, type Page } from '@playwright/test';

type AudioStartupSnapshot = {
  dav2: Array<{ phase: string; elapsedMs: number }>;
  host: Array<{ phase: string; attemptId: string; elapsedMs: number; terminalReason?: string }>;
  latestMediaPlayingMs: number | null;
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
          phase: 'media-playing',
          attemptId: 'synthetic-a',
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
  expect(dav2Snapshot?.host).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'media-playing', elapsedMs: 821.6 })]));
  expect(dav2Snapshot?.latestMediaPlayingMs).toBe(821.6);
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
    .toEqual(expect.arrayContaining(['playback-intent', 'media-playing']));

  const snapshot = await readStartupSnapshot(page);
  const playbackIntentIndex = snapshot?.host.findIndex(metric => metric.phase === 'playback-intent') ?? -1;
  const mediaPlayingIndex = snapshot?.host.findIndex(metric => metric.phase === 'media-playing') ?? -1;
  expect(playbackIntentIndex).toBeGreaterThanOrEqual(0);
  expect(mediaPlayingIndex).toBeGreaterThan(playbackIntentIndex);
  expect(snapshot?.latestMediaPlayingMs).not.toBeNull();
});

test('autoplay rejection terminates a new-source startup attempt', async ({ page }) => {
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    Reflect.set(window, '__dotifyRejectNextHostPlay', true);
    HTMLMediaElement.prototype.play = function () {
      const hostAudio = document.querySelector('audio.native-player-source');
      if (this === hostAudio && Reflect.get(window, '__dotifyRejectNextHostPlay')) {
        Reflect.set(window, '__dotifyRejectNextHostPlay', false);
        return Promise.reject(new DOMException('Autoplay blocked for test', 'NotAllowedError'));
      }
      return nativePlay.call(this);
    };
  });
  await page.goto('/?e2eRoom=public&e2eAutoplay=on');
  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());

  await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.map(metric => metric.phase))
    .toEqual(expect.arrayContaining(['playback-intent', 'metadata-ready', 'error']));

  const phases = (await readStartupSnapshot(page))?.host.map(metric => metric.phase) ?? [];
  expect(phases.indexOf('error')).toBeGreaterThan(phases.indexOf('playback-intent'));
  expect(phases).not.toContain('media-playing');
});

test('a late play rejection cannot fail the replacement startup', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eCatalog=sequence');
  await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

  await page.evaluate(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    let deferFirstHostPlay = true;
    HTMLMediaElement.prototype.play = function () {
      const hostAudio = document.querySelector('audio.native-player-source');
      if (this === hostAudio && deferFirstHostPlay) {
        deferFirstHostPlay = false;
        return new Promise<void>((_resolve, reject) => {
          Reflect.set(window, '__dotifyRejectOldHostPlay', () => reject(new DOMException('Old source failed late', 'NotAllowedError')));
        });
      }
      return nativePlay.call(this);
    };
  });
  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, '__dotifyRejectOldHostPlay') === 'function')).toBe(true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'playback-intent').length).toBe(2);

  const replacementAttemptId = (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'playback-intent').at(-1)?.attemptId;
  expect(replacementAttemptId).toBeTruthy();
  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'media-playing'))
    .toBe(true);

  await page.evaluate(() => (Reflect.get(window, '__dotifyRejectOldHostPlay') as (() => void) | undefined)?.());
  await page.waitForTimeout(100);

  const host = (await readStartupSnapshot(page))?.host ?? [];
  expect(host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'media-playing')).toBe(true);
  expect(host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'error')).toBe(false);
});

test('a native error from a retired media element cannot fail its replacement', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eCatalog=sequence&e2eAutoplay=on');
  await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect(page.locator('audio.native-player-source').first()).toHaveJSProperty('paused', false);
  await page.evaluate(() => {
    Reflect.set(window, '__dotifyRetiredHostAudio', document.querySelector('audio.native-player-source'));
    window.__DOTIFY_AUDIO_STARTUP__?.clear();
  });

  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const retired = Reflect.get(window, '__dotifyRetiredHostAudio');
        const current = document.querySelector('audio.native-player-source');
        return Boolean(retired && current && retired !== current);
      })
    )
    .toBe(true);

  const replacementAttemptId = (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'source-selected').at(-1)?.attemptId;
  expect(replacementAttemptId).toBeTruthy();
  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'media-playing'))
    .toBe(true);

  await page.evaluate(() => {
    const retired = Reflect.get(window, '__dotifyRetiredHostAudio') as HTMLAudioElement | undefined;
    retired?.dispatchEvent(new Event('error'));
  });
  await page.waitForTimeout(100);

  const host = (await readStartupSnapshot(page))?.host ?? [];
  expect(host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'media-playing')).toBe(true);
  expect(host.some(metric => metric.attemptId === replacementAttemptId && metric.phase === 'error')).toBe(false);
});

test('repeat remains applied when a new host media generation replaces the track', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eCatalog=sequence');
  await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();

  const repeat = page.getByRole('button', { name: 'Repeat this track', exact: true });
  await repeat.click();
  await expect(repeat).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page
        .locator('audio.native-player-source')
        .first()
        .evaluate((audio: HTMLAudioElement) => audio.loop)
    )
    .toBe(true);

  await page.evaluate(() => Reflect.set(window, '__dotifyRepeatHostAudio', document.querySelector('audio.native-player-source')));
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const previous = Reflect.get(window, '__dotifyRepeatHostAudio');
        const current = document.querySelector('audio.native-player-source');
        return Boolean(previous && current && previous !== current);
      })
    )
    .toBe(true);
  await expect(repeat).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page
        .locator('audio.native-player-source')
        .first()
        .evaluate((audio: HTMLAudioElement) => audio.loop)
    )
    .toBe(true);
});

test('replacing a pending track terminates its startup attempt before the next intent', async ({ page }) => {
  let releaseMediaRequest = () => undefined;
  const mediaRequestGate = new Promise<void>(resolve => {
    releaseMediaRequest = resolve;
  });
  await page.route('**/__dotify_e2e__/room-sequence.wav', async route => {
    await mediaRequestGate;
    return route.abort();
  });

  try {
    await page.goto('/?e2eRoom=public&e2eCatalog=sequence&e2eTrackDelay=on');
    await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());

    await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();
    await expect.poll(async () => (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'playback-intent').length).toBe(1);

    await page.getByRole('button', { name: 'Music', exact: true }).click();
    await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
    await expect.poll(async () => (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'playback-intent').length).toBe(2);

    const phases = (await readStartupSnapshot(page))?.host.map(metric => metric.phase) ?? [];
    const firstIntent = phases.indexOf('playback-intent');
    const cancellation = phases.indexOf('error', firstIntent + 1);
    const replacementIntent = phases.indexOf('playback-intent', firstIntent + 1);
    expect(cancellation).toBeGreaterThan(firstIntent);
    expect(cancellation).toBeLessThan(replacementIntent);
  } finally {
    releaseMediaRequest();
  }
});

test('canplay keeps cancellation armed until the track reaches a terminal event', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eCatalog=sequence');
  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());

  await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();
  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.map(metric => metric.phase))
    .toEqual(expect.arrayContaining(['playback-intent', 'source-selected', 'metadata-ready']));
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  expect((await readStartupSnapshot(page))?.host.map(metric => metric.phase)).not.toContain('media-playing');

  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
  await expect.poll(async () => (await readStartupSnapshot(page))?.host.filter(metric => metric.phase === 'playback-intent').length).toBe(2);

  const phases = (await readStartupSnapshot(page))?.host.map(metric => metric.phase) ?? [];
  const firstIntent = phases.indexOf('playback-intent');
  const cancellation = phases.indexOf('error', firstIntent + 1);
  const replacementIntent = phases.indexOf('playback-intent', firstIntent + 1);
  expect(cancellation).toBeGreaterThan(firstIntent);
  expect(cancellation).toBeLessThan(replacementIntent);
});

test('Previous stays available during a slow Next and the final direction wins', async ({ page }) => {
  let releaseMediaRequest!: () => void;
  const gate = new Promise<void>(resolve => {
    releaseMediaRequest = resolve;
  });
  await page.route('**/__dotify_e2e__/room-sequence.wav', async route => {
    await gate;
    await route.abort();
  });
  try {
    await page.goto('/?e2eRoom=public&e2eCatalog=sequence&e2eTrackDelay=on&e2eSync=on&e2eAutoplay=on');
    await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
    const audio = page.locator('audio.native-player-source').first();
    await expect(audio).toHaveJSProperty('paused', false);
    await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole('button', { name: 'Next track', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Second room track', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Previous track', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'E2E Public Room Track', exact: true })).toBeVisible();
      await expect(audio).toHaveJSProperty('paused', false);
    }
    releaseMediaRequest();
    await page.waitForTimeout(200);
    const host = (await readStartupSnapshot(page))?.host ?? [];
    const intents = host.filter(metric => metric.phase === 'playback-intent');
    expect(intents).toHaveLength(4);
    for (const cancelled of [intents[0], intents[2]]) {
      expect(
        host.some(metric => metric.attemptId === cancelled.attemptId && metric.phase === 'error' && metric.terminalReason === 'selection-interrupted')
      ).toBe(true);
      expect(host.some(metric => metric.attemptId === cancelled.attemptId && metric.phase === 'media-playing')).toBe(false);
    }
    expect(host.some(metric => metric.attemptId === intents[3].attemptId && metric.phase === 'media-playing')).toBe(true);
    await expect(audio).toHaveJSProperty('paused', false);
  } finally {
    releaseMediaRequest();
  }
});

test('muted playback cannot satisfy a first-sound measurement', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eCatalog=sequence');

  await page.getByRole('button', { name: /^Play Second room track by Dotify Room Host,/ }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Mute', exact: true }).click();

  await page.evaluate(() => window.__DOTIFY_AUDIO_STARTUP__?.clear());
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect
    .poll(async () => (await readStartupSnapshot(page))?.host.map(metric => metric.phase))
    .toEqual(expect.arrayContaining(['playback-intent', 'error']));

  const phases = (await readStartupSnapshot(page))?.host.map(metric => metric.phase) ?? [];
  expect(phases).not.toContain('media-playing');
});

test('the readiness panel captures a candidate-bound first-sound sample without media identifiers', async ({ page }) => {
  await page.goto('/?e2eRoom=public&e2eReadiness=true');
  await page.getByRole('button', { name: 'You', exact: true }).click();

  const panel = page.locator('[aria-labelledby="first-sound-evidence-title"]');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Use this candidate' }).click();
  await panel.getByLabel('Tested surface').selectOption('standalone-chrome');
  await panel.getByLabel('Device class').selectOption('desktop');
  await panel.getByLabel('Operating system').selectOption('linux');
  await panel.getByLabel('Browser family').selectOption('chrome');
  await panel.getByLabel('Connection profile').selectOption('ethernet');
  await panel.getByRole('button', { name: 'Use this test profile' }).click();
  await panel.getByLabel('Listening flow').selectOption('free');
  await panel.getByLabel('Cache condition').selectOption('cold');
  await panel.getByRole('button', { name: 'Start sample' }).click();

  await page.evaluate(() => {
    const timestamp = Date.now();
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: { phase: 'playback-intent', attemptId: 'evidence-a', source: 'private-track-id', elapsedMs: 0, timestamp }
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
        detail: { phase: 'source-selected', attemptId: 'evidence-a', source: 'blob:private-source', elapsedMs: 0, timestamp: timestamp + 500 }
      })
    );
    window.dispatchEvent(
      new CustomEvent('dotify:host-audio-startup', {
        detail: {
          phase: 'media-playing',
          attemptId: 'evidence-a',
          source: 'blob:private-source',
          elapsedMs: 312,
          timestamp: timestamp + 812,
          durationSeconds: 10
        }
      })
    );
  });

  await panel.getByRole('button', { name: 'I hear the music / capture error' }).click();
  await expect(panel.getByText('1 sanitized sample')).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('dotify:first-sound-evidence:v5'));
  const firstSoundMs = JSON.parse(stored ?? '{}').samples?.[0]?.firstSoundMs;
  expect(firstSoundMs).toBeGreaterThanOrEqual(0);
  expect(firstSoundMs).toBeLessThan(2_000);
  expect(stored).toContain('"cacheState":"cold"');
  expect(stored).toContain('"scenario":"ordinary-playback"');
  expect(stored).toContain('"expectedOutcome":"first-audio"');
  expect(stored).toContain('"measurement":"human-confirmed"');
  expect(stored).toContain('"device":"desktop"');
  expect(stored).toContain('"connection":"ethernet"');
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

for (const saveData of [false, true]) {
  test(`transport prepares an encrypted neighbor only after playback (saveData=${saveData})`, async ({ page }) => {
    if (saveData) {
      await page.addInitScript(() => {
        const connection = new EventTarget();
        Object.assign(connection, { saveData: true, effectiveType: '4g' });
        Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
      });
    }
    const container = dav2IntentFixture();
    const ranges: string[] = [];
    await page.route('**/ipfs/bafy-e2e-intent-audio', async route => {
      const range = route.request().headers().range ?? '';
      ranges.push(range);
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!match) return route.fulfill({ status: 400, body: 'range required' });
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), container.length - 1);
      await route.fulfill({
        status: 206,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${container.length}`
        },
        body: Buffer.from(container.slice(start, end + 1))
      });
    });
    await page.goto('/?e2eRoom=protected-unauthorized&e2eDav2Intent=on&e2eSync=on');
    await page.getByRole('button', { name: /^Play E2E Public Room Track by Dotify Room Host,/ }).click();
    await page.mouse.move(0, 0);
    const audio = page.locator('audio.native-player-source').first();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await page.waitForTimeout(800);
    expect(ranges).toHaveLength(0);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(audio).toHaveJSProperty('paused', false);
    if (saveData) {
      await page.waitForTimeout(1000);
      expect(ranges).toHaveLength(0);
    } else {
      await expect.poll(() => ranges.length).toBe(2);
      expect(ranges[0]).toBe('bytes=0-65535');
      // Hover/focus uses the same cached two ranges, not a second download.
      await page.getByRole('button', { name: 'Previous track', exact: true }).hover();
      await page.waitForTimeout(200);
      expect(ranges).toHaveLength(2);
      // Previous restarts the current track after three seconds. Exercise the
      // actual previous-track branch here, after verifying its bytes are warm.
      await audio.evaluate(element => {
        element.currentTime = 1;
        element.dispatchEvent(new Event('timeupdate'));
      });
      await page.getByRole('button', { name: 'Previous track', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Deterministic Classic Unlock', exact: true })).toBeVisible();
      await expect(audio).toHaveJSProperty('paused', true);
    }
    expect(await page.evaluate(() => window.__DOTIFY_E2E_ROOM_JOIN__?.keyRequests ?? 0)).toBe(0);
  });
}
