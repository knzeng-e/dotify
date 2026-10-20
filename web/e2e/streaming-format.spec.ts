import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const fixture = JSON.parse(readFileSync(process.env.DOTIFY_STREAMING_FIXTURE_PATH ?? path.join(process.cwd(), '.data/streaming-fixture.json'), 'utf8')) as {
  schema: string;
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  baseline: string;
  manifest: string;
  files: Record<string, string>;
};
if (fixture.schema !== 'dotify.synthetic-streaming-fixture.v1') throw new Error('Synthetic codec fixture required');

for (const bitrate of [96, 160, 320])
  test(`authenticated AAC ${bitrate} starts from init and one media segment`, async ({ page }) => {
    await page.route('**/w32-codec', route =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Synthetic streaming interoperability</title><button id="play">Play synthetic audio</button><audio id="audio"></audio>'
      })
    );
    await page.goto('/w32-codec');
    const result = await page.evaluate(
      async ({ fixture, bitrate }) => {
        const modulePath = '/src/features/catalog/streamingFormat.ts';
        const codec = (await import(modulePath)) as typeof import('../src/features/catalog/streamingFormat');
        const bytes = (base64: string) => Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const key = Uint8Array.from(fixture.keyHex.match(/../g)!, pair => Number.parseInt(pair, 16));
        const context = await codec.readStreamingManifest(bytes(fixture.manifest), key, fixture.scope);
        const rendition = context.manifest.renditions.find(item => item.bitrateKbps === bitrate)!;
        if (!MediaSource.isTypeSupported(rendition.mediaMime)) return { supported: false, mime: rendition.mediaMime, starts: false, duration: 0, decoded: 0 };
        const audio = document.querySelector('audio')!;
        const mediaSource = new MediaSource();
        const url = URL.createObjectURL(mediaSource);
        audio.src = url;
        await new Promise<void>((resolve, reject) => {
          mediaSource.addEventListener('sourceopen', () => resolve(), { once: true });
          mediaSource.addEventListener('sourceclose', () => reject(new Error('Source closed')), { once: true });
        });
        const buffer = mediaSource.addSourceBuffer(rendition.mediaMime);
        async function append(object: typeof rendition.init) {
          const clear = await codec.decryptStreamingMedia(context, object, bytes(fixture.files[object.path]));
          await new Promise<void>((resolve, reject) => {
            buffer.addEventListener('updateend', () => resolve(), { once: true });
            buffer.addEventListener('error', () => reject(new Error('Append failed')), { once: true });
            buffer.appendBuffer(clear);
          });
          return clear.length;
        }
        let decoded = await append(rendition.init);
        decoded += await append(rendition.segments[0]);
        const firstSegmentEnd = buffer.buffered.end(0);
        mediaSource.duration = context.manifest.durationSeconds;
        document.querySelector('button')!.addEventListener(
          'click',
          () => {
            void audio.play();
          },
          { once: true }
        );
        Object.assign(window, { w32Synthetic: { audio, url, firstSegmentEnd } });
        return { supported: true, mime: rendition.mediaMime, starts: firstSegmentEnd > 3.9, duration: context.manifest.durationSeconds, decoded };
      },
      { fixture, bitrate }
    );
    expect(result.supported, `Actual engine lacks ${result.mime}`).toBe(true);
    expect(result.starts).toBe(true);
    expect(result.duration).toBeGreaterThan(8);
    expect(result.decoded).toBeLessThan(256 * 1024);
    await page.locator('#play').click();
    await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0.1);
    expect(Object.keys(fixture.files).some(file => file.startsWith('archive/'))).toBe(false);
  });

test('browser authenticates identity/order and refuses archive playback', async ({ page }) => {
  await page.route('**/w32-codec', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Streaming authentication</title>' }));
  await page.goto('/w32-codec');
  const result = await page.evaluate(async fixture => {
    const modulePath = '/src/features/catalog/streamingFormat.ts';
    const codec = (await import(modulePath)) as typeof import('../src/features/catalog/streamingFormat');
    const bytes = (base64: string) => Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const key = Uint8Array.from(fixture.keyHex.match(/../g)!, pair => Number.parseInt(pair, 16));
    const failed = async (run: () => Promise<unknown>) => {
      try {
        await run();
        return false;
      } catch {
        return true;
      }
    };
    const context = await codec.readStreamingManifest(bytes(fixture.manifest), key, fixture.scope);
    const segment = context.manifest.renditions[0].segments[0];
    const altered = bytes(fixture.files[segment.path]);
    altered[0] ^= 1;
    const wrongScope = { ...fixture.scope, runtimeAddress: `0x${'ab'.repeat(20)}` };
    const manifest = JSON.parse(new TextDecoder().decode(bytes(fixture.manifest)));
    manifest.renditions[0].segments.reverse();
    return {
      tampered: await failed(() => codec.decryptStreamingMedia(context, segment, altered)),
      wrongScope: await failed(() => codec.readStreamingManifest(bytes(fixture.manifest), key, wrongScope)),
      reordered: await failed(() => codec.readStreamingManifest(new TextEncoder().encode(JSON.stringify(manifest)), key, fixture.scope)),
      archive: await failed(() => codec.decryptStreamingMedia(context, context.manifest.master, new Uint8Array(context.manifest.master.encryptedLength)))
    };
  }, fixture);
  expect(result).toEqual({ tampered: true, wrongScope: true, reordered: true, archive: true });
});

test('warm-key first sound improves over a whole original under the same bounded network model', async ({ page }, testInfo) => {
  const decode = (base64: string) => Buffer.from(base64, 'base64');
  const paths: Record<string, Buffer> = {
    'baseline.dav2': decode(fixture.baseline),
    'manifest.json': decode(fixture.manifest),
    ...Object.fromEntries(Object.entries(fixture.files).map(([name, bytes]) => [name, decode(bytes)]))
  };
  await page.route('**/w32-data/**', async route => {
    const name = new URL(route.request().url()).pathname.slice('/w32-data/'.length);
    const bytes = paths[name];
    if (!bytes) return route.abort();
    // Deterministic fixture model: 50 ms RTT + body time at 5 Mb/s. Not a
    // physical network, wallet/session timing or a human audibility measurement.
    await new Promise(resolve => setTimeout(resolve, 50 + bytes.length / 625));
    await route.fulfill({ contentType: 'application/octet-stream', body: bytes });
  });
  await page.route('**/w32-codec', route =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>First-sound model</title><button id="play">Play synthetic audio</button><audio></audio>'
    })
  );
  await page.goto('/w32-codec');
  const timings: Record<string, number> = {};
  for (const mode of ['baseline', 'streaming'] as const) {
    await page.evaluate(
      async ({ fixture, mode }) => {
        const key = Uint8Array.from(fixture.keyHex.match(/../g)!, pair => Number.parseInt(pair, 16));
        const audio = document.querySelector('audio')!;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        const get = async (name: string) => new Uint8Array(await (await fetch(`/w32-data/${name}`)).arrayBuffer());
        const start = performance.now();
        let url: string;
        if (mode === 'baseline') {
          const modulePath = '/src/shared/utils/audioV2.ts';
          const codec = (await import(modulePath)) as typeof import('../src/shared/utils/audioV2');
          const clear = await codec.decryptAudioV2Container(await get('baseline.dav2'), key);
          url = URL.createObjectURL(new Blob([clear.bytes], { type: clear.mediaMime }));
          audio.src = url;
        } else {
          const modulePath = '/src/features/catalog/streamingFormat.ts';
          const codec = (await import(modulePath)) as typeof import('../src/features/catalog/streamingFormat');
          const context = await codec.readStreamingManifest(await get('manifest.json'), key, fixture.scope);
          const rendition = context.manifest.renditions[1];
          if (!MediaSource.isTypeSupported(rendition.mediaMime)) throw new Error('Actual browser lacks AAC MSE');
          const mediaSource = new MediaSource();
          url = URL.createObjectURL(mediaSource);
          audio.src = url;
          await new Promise<void>(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), { once: true }));
          const buffer = mediaSource.addSourceBuffer(rendition.mediaMime);
          for (const object of [rendition.init, rendition.segments[0]]) {
            const clear = await codec.decryptStreamingMedia(context, object, await get(object.path));
            await new Promise<void>((resolve, reject) => {
              buffer.addEventListener('updateend', () => resolve(), { once: true });
              buffer.addEventListener('error', () => reject(new Error('Append failed')), { once: true });
              buffer.appendBuffer(clear);
            });
          }
          mediaSource.duration = context.manifest.durationSeconds;
        }
        const playing = new Promise<number>(resolve => audio.addEventListener('playing', () => resolve(performance.now() - start), { once: true }));
        Object.assign(window, { w32FirstSound: playing });
        document.querySelector('button')!.addEventListener(
          'click',
          () => {
            void audio.play();
          },
          { once: true }
        );
      },
      { fixture, mode }
    );
    await page.locator('#play').click();
    timings[mode] = await page.evaluate(() => (window as unknown as { w32FirstSound: Promise<number> }).w32FirstSound);
  }
  await testInfo.attach('synthetic-first-sound.json', {
    body: JSON.stringify({ networkModel: '50ms RTT, 5Mb/s, fixed known key, synthetic 8.2s WAV', timings }),
    contentType: 'application/json'
  });
  expect(timings.streaming).toBeLessThan(timings.baseline * 0.8);
});
