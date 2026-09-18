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

test('audio startup telemetry is retained for QA in the browser', async ({ page }) => {
  await page.goto('/?e2eRoom=public');

  await expect.poll(() => page.evaluate(() => typeof window.__DOTIFY_AUDIO_STARTUP__?.snapshot === 'function')).toBe(true);

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
  expect(dav2Snapshot?.host).toEqual([expect.objectContaining({ phase: 'first-audio', elapsedMs: 821.6 })]);
  expect(dav2Snapshot?.latestFirstSoundMs).toBe(821.6);
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
