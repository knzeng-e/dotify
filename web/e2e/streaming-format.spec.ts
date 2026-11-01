import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { blake2b256 } from '@polkadot-apps/utils';

const fixture = JSON.parse(readFileSync(process.env.DOTIFY_STREAMING_FIXTURE_PATH ?? path.join(process.cwd(), '.data/streaming-fixture.json'), 'utf8')) as {
  schema: string;
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  manifest: string;
  files: Record<string, string>;
};
if (fixture.schema !== 'dotify.synthetic-streaming-fixture.v1') throw new Error('Synthetic codec fixture required');

// Test-only public-key fixture. Artist/canary keys never enter browser bundles.
const bulletinBlocks: Record<string, string> = {};
const block = (code: number, bytes: Uint8Array) => {
  const cid = CID.createV1(code, digest(0xb220, blake2b256(bytes)));
  bulletinBlocks[cid.toString()] = Buffer.from(bytes).toString('base64');
  return cid;
};
const directory = (links: Array<{ Name: string; Hash: CID }>) => {
  const bytes: unknown = dagPB.encode(dagPB.prepare({ Data: new UnixFS({ type: 'directory' }).marshal(), Links: links }));
  if (!(bytes instanceof Uint8Array)) throw new Error('Invalid test directory');
  return block(0x70, bytes);
};
const bulletinRoot = directory([
  { Name: 'manifest.json', Hash: block(0x55, Buffer.from(fixture.manifest, 'base64')) },
  ...[96, 160, 320].map(bitrate => ({
    Name: String(bitrate),
    Hash: directory(
      Object.entries(fixture.files)
        .filter(([name]) => name.startsWith(`${bitrate}/`))
        .map(([name, value]) => ({
          Name: name.split('/')[1],
          Hash: block(0x55, Buffer.from(value, 'base64'))
        }))
    )
  }))
]).toString();

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

for (const provider of ['IPFS', 'Bulletin'])
  test(`${provider} publication player reads authenticated segments and shares normalized audio without archive access`, async ({ page }) => {
    const requests: string[] = [];
    const edgeRequests: string[] = [];
    await page.route('https://media.edge.test/**', async route => {
      edgeRequests.push(route.request().url());
      expect(route.request().headers().authorization).toBeUndefined();
      expect(route.request().headers().cookie).toBeUndefined();
      expect(route.request().headers().range).toBeUndefined();
      await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    });
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
    await page.evaluate(
      async ({ fixture, cid }) => {
        const playerPath = '/src/features/catalog/streamingPlayback.ts',
          gainPath = '/src/features/player/audioNormalization.ts',
          outputPath = '/src/features/player/hostAudioOutput.ts';
        const player = (await import(playerPath)) as typeof import('../src/features/catalog/streamingPlayback');
        const gain = (await import(gainPath)) as typeof import('../src/features/player/audioNormalization');
        const output = (await import(outputPath)) as typeof import('../src/features/player/hostAudioOutput');
        const audio = document.querySelector('audio')!;
        const signal = new AbortController().signal;
        const prepared = await player.createStreamingPlayback({
          cid,
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
      },
      { fixture, cid: provider === 'Bulletin' ? bulletinRoot : 'Qm' + 'a'.repeat(44) }
    );
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
    expect(edgeRequests.some(url => url.endsWith('/manifest.json'))).toBe(provider === 'IPFS');
    expect(edgeRequests.some(url => url.endsWith('/96/segment-000.bin'))).toBe(provider === 'IPFS');
    expect(requests).toContain('manifest.json');
    expect(requests).toContain('96/init.bin');
    expect(requests).toContain('96/segment-000.bin');
    expect(requests.some(path => path.startsWith('archive/'))).toBe(false);
  });

test('actual Host Bulletin adapter feeds authenticated AAC into the publication player', async ({ page }) => {
  await page.route('**/bulletin-player', route => route.fulfill({ contentType: 'text/html', body: '<button>Play</button><audio></audio>' }));
  await page.goto('/bulletin-player');
  const result = await page.evaluate(
    async ({ fixture, root, blocks }) => {
      const playerPath = '/src/features/catalog/streamingPlayback.ts';
      const hostPath = '/src/features/catalog/bulletinHostMedia.ts';
      const { createStreamingPlayback } = (await import(playerPath)) as typeof import('../src/features/catalog/streamingPlayback');
      const { createBulletinHostMediaReader } = (await import(hostPath)) as typeof import('../src/features/catalog/bulletinHostMedia');
      const paths: string[] = [];
      const read = createBulletinHostMediaReader({
        insideHost: () => true,
        queryBytes: async cid => ({
          ok: true,
          value: Uint8Array.from(atob(blocks[cid]), character => character.charCodeAt(0))
        })
      });
      const audio = document.querySelector('audio')!;
      const prepared = await createStreamingPlayback({
        cid: root,
        key: Uint8Array.from(fixture.keyHex.replace(/^0x/, '').match(/../g)!, part => parseInt(part, 16)),
        scope: fixture.scope,
        signal: new AbortController().signal,
        audio: () => audio,
        onError: error => {
          Reflect.set(window, '__bulletinError', error.message);
        },
        fetchObject: async (cid, path, max, signal) => {
          paths.push(path);
          const bytes = await read(cid, path, max, signal);
          if (!bytes) throw new Error('Synthetic Host missing');
          return bytes;
        }
      });
      audio.src = prepared.url;
      document.querySelector('button')!.onclick = () => {
        void audio.play();
      };
      Reflect.set(window, '__bulletinPaths', paths);
      return { progressive: prepared.progressive };
    },
    { fixture, root: bulletinRoot, blocks: bulletinBlocks }
  );
  expect(result.progressive).toBe(true);
  await page.click('button');
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime), { timeout: 15_000 }).toBeGreaterThan(4.1);
  const paths = await page.evaluate(() => Reflect.get(window, '__bulletinPaths') as string[]);
  expect(paths).toContain('manifest.json');
  expect(paths).toContain('96/init.bin');
  expect(paths).toContain('96/segment-000.bin');
  expect(paths.some(name => name.startsWith('archive/'))).toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, '__bulletinError'))).toBeUndefined();
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

test('publication compatibility playback uses authenticated AAC when both streaming APIs are absent', async ({ page }) => {
  await page.route('**/publication-compatibility', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Play</button><audio></audio>' })
  );
  await page.goto('/publication-compatibility');
  const result = await page.evaluate(async fixture => {
    // The complete-rendition fallback requires both progressive readers to be unavailable.
    Object.defineProperty(window, 'MediaSource', { value: undefined, configurable: true });
    Object.defineProperty(window, 'ManagedMediaSource', { value: undefined, configurable: true });
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

test('the reader starts at 96, upgrades on measured headroom and downshifts after congestion', async ({ page }) => {
  await page.route('**/w35-adaptive', route => route.fulfill({ contentType: 'text/html', body: '<button>Play</button><audio></audio>' }));
  await page.goto('/w35-adaptive');
  await page.evaluate(async fixture => {
    const path = '/src/features/catalog/streamingPlayback.ts';
    const { createStreamingPlayback } = (await import(path)) as typeof import('../src/features/catalog/streamingPlayback');
    const audio = document.querySelector('audio')!;
    const metrics: number[] = [];
    Reflect.set(window, '__abrBitrates', metrics);
    const prepared = await createStreamingPlayback({
      cid: 'Qm' + 'e'.repeat(44),
      key: Uint8Array.from(fixture.keyHex.match(/../g)!, pair => parseInt(pair, 16)),
      scope: fixture.scope,
      signal: new AbortController().signal,
      audio: () => audio,
      onError: error => {
        Reflect.set(window, '__abrError', String(error));
      },
      onMetric: event => {
        if (event.phase === 'rendition-selected') metrics.push(event.bitrateKbps!);
      },
      fetchObject: async (_cid, name, _maximum, signal, observe) => {
        await new Promise(resolve => setTimeout(resolve, name.endsWith('segment-004.bin') ? 2500 : 30));
        signal.throwIfAborted();
        observe?.({ fromCache: false });
        return Uint8Array.from(atob(name === 'manifest.json' ? fixture.manifest : fixture.files[name]), character => character.charCodeAt(0));
      }
    });
    audio.src = prepared.url;
    document.querySelector('button')!.onclick = () => {
      void audio.play();
    };
  }, fixture);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bitrates: Reflect.get(window, '__abrBitrates'),
        error: Reflect.get(window, '__abrError') ?? null,
        mediaError: document.querySelector('audio')!.error?.message ?? null,
        paused: document.querySelector('audio')!.paused
      }))
    )
    .toMatchObject({ bitrates: expect.arrayContaining([320]), error: null, mediaError: null, paused: false });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const values = Reflect.get(window, '__abrBitrates') as number[];
        return values.length >= 7 && values[0] === 96 && values.at(-1)! < 320;
      })
    )
    .toBe(true);
  await expect(page.locator('audio')).toHaveJSProperty('error', null);
  expect(await page.evaluate(() => Reflect.get(window, '__abrError'))).toBeUndefined();
  await page.locator('audio').evaluate(audio => {
    audio.currentTime = 14;
  });
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(14.1);
});
