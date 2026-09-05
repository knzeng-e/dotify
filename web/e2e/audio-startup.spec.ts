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
