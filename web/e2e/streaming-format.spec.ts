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

test('publication player reads authenticated segments and shares normalized audio without archive access', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/publication-player', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><button id="play">Play</button><audio id="audio"></audio>' })
  );
  await page.route('**/api/media/**/stream/**', async route => {
    const object = new URL(route.request().url()).pathname.split('/stream/')[1];
    requests.push(object);
    const value = object === 'manifest.json' ? fixture.manifest : fixture.files[object];
    if (!value) return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    if (object.includes('segment-001') || object.includes('segment-002')) await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }, body: Buffer.from(value, 'base64') });
  });
  await page.goto('/publication-player');
  await page.evaluate(async fixture => {
    const playerPath = '/src/features/catalog/streamingPlayback.ts',
      gainPath = '/src/features/player/audioNormalization.ts',
      outputPath = '/src/features/player/hostAudioOutput.ts';
    const player = (await import(playerPath)) as typeof import('../src/features/catalog/streamingPlayback');
    const gain = (await import(gainPath)) as typeof import('../src/features/player/audioNormalization');
    const output = (await import(outputPath)) as typeof import('../src/features/player/hostAudioOutput');
    const audio = document.querySelector('audio')!;
    const signal = new AbortController().signal;
    const prepared = await player.createStreamingPlayback({
      cid: 'Qm' + 'a'.repeat(44),
      key: Uint8Array.from(fixture.keyHex.replace(/^0x/, '').match(/../g)!, part => parseInt(part, 16)),
      scope: fixture.scope,
      signal,
      audio: () => audio,
      onError: error => {
        throw error;
      }
    });
    audio.src = prepared.url;
    audio.disableRemotePlayback = true;
    gain.registerAudioGain(prepared.url, prepared.gainDb);
    gain.attachAudioNormalization(audio);
    document.querySelector('button')!.onclick = () => {
      void Promise.all([output.resumeHostAudioOutput(audio), audio.play()]);
    };
    (window as typeof window & { publicationPlayer?: unknown }).publicationPlayer = { gainDb: prepared.gainDb, progressive: prepared.progressive };
  }, fixture);
  await page.click('#play');
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')!.currentTime)).toBeGreaterThan(0.2);
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/player/audioNormalization.ts';
    const gain = (await import(modulePath)) as typeof import('../src/features/player/audioNormalization');
    const audio = document.querySelector('audio')!;
    const capture = gain.normalizedAudioCapture(audio);
    const data = (window as typeof window & { publicationPlayer: { gainDb: number; progressive: boolean } }).publicationPlayer;
    audio.muted = true;
    capture?.sync();
    return { ...data, capturedTracks: capture?.stream.getAudioTracks().filter(track => track.readyState === 'live').length, duration: audio.duration };
  });
  expect(result.progressive).toBe(true);
  expect(result.capturedTracks).toBe(1);
  expect(result.duration).toBeGreaterThan(8);
  expect(requests).toContain('manifest.json');
  expect(requests).toContain('160/init.bin');
  expect(requests).toContain('160/segment-000.bin');
  expect(requests.some(path => path.startsWith('archive/') || path.startsWith('96/') || path.startsWith('320/'))).toBe(false);
});

test('publication player refuses a bad key before reading any media or archive', async ({ page }) => {
  await page.route('**/publication-denial', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><audio></audio>' }));
  await page.goto('/publication-denial');
  const result = await page.evaluate(async fixture => {
    const modulePath = '/src/features/catalog/streamingPlayback.ts';
    const player = (await import(modulePath)) as typeof import('../src/features/catalog/streamingPlayback');
    const paths: string[] = [];
    let denied = false;
    try {
      await player.createStreamingPlayback({
        cid: 'Qm' + 'a'.repeat(44),
        key: new Uint8Array(32),
        scope: fixture.scope,
        signal: new AbortController().signal,
        audio: () => document.querySelector('audio'),
        onError: () => {},
        fetchObject: async (_cid, path) => {
          paths.push(path);
          return Uint8Array.from(atob(fixture.manifest), char => char.charCodeAt(0));
        }
      });
    } catch {
      denied = true;
    }
    return { denied, paths };
  }, fixture);
  expect(result).toEqual({ denied: true, paths: ['manifest.json'] });
});

test('publication compatibility playback uses authenticated AAC when standard MSE is absent', async ({ page }) => {
  await page.route('**/publication-compatibility', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Play</button><audio></audio>' })
  );
  await page.goto('/publication-compatibility');
  const result = await page.evaluate(async fixture => {
    Object.defineProperty(window, 'MediaSource', { value: undefined, configurable: true });
    const modulePath = '/src/features/catalog/streamingPlayback.ts';
    const player = (await import(modulePath)) as typeof import('../src/features/catalog/streamingPlayback');
    const paths: string[] = [];
    const audio = document.querySelector('audio')!;
    const prepared = await player.createStreamingPlayback({
      cid: 'Qm' + 'a'.repeat(44),
      key: Uint8Array.from(fixture.keyHex.replace(/^0x/, '').match(/../g)!, part => parseInt(part, 16)),
      scope: fixture.scope,
      signal: new AbortController().signal,
      audio: () => audio,
      onError: () => {},
      fetchObject: async (_cid, path) => {
        paths.push(path);
        const encoded = path === 'manifest.json' ? fixture.manifest : fixture.files[path];
        return Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      }
    });
    audio.src = prepared.url;
    document.querySelector('button')!.onclick = () => {
      void audio.play();
    };
    return { progressive: prepared.progressive, paths };
  }, fixture);
  expect(result.progressive).toBe(false);
  expect(result.paths.some(path => path.startsWith('archive/'))).toBe(false);
  await page.click('button');
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')!.currentTime)).toBeGreaterThan(0.2);
});
