import assert from 'node:assert/strict';
import crypto, { randomBytes } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { encryptAudioV2Container, parseAudioV2Container } from './audioV2.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger, streamingNonce, streamingKeyFingerprint } from './streamingNonces.js';
import {
  decryptStreamingObject,
  StreamingEncryptor,
  verifyStreamingManifest,
  STREAM_MIME,
  type StreamingScope,
  type StreamingManifest
} from './streamingFormat.js';

const KEY = Buffer.alloc(32, 37);
const SCOPE: StreamingScope = {
  chainId: 420420417,
  runtimeAddress: `0x${'12'.repeat(20)}`,
  contentHash: `0x${'34'.repeat(32)}`,
  keyVersion: 'dotify-content-key-v2'
};

async function fixture<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'dotify-nonce-test-'));
  const ledger = path.join(parent, 'ledger');
  try {
    await initializeStreamingNonceLedger(ledger);
    return await run(ledger);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

async function encrypted(ledger: StreamingNonceLedger) {
  const encryptor = new StreamingEncryptor(KEY, await ledger.reserve(KEY), SCOPE);
  const master = encryptor.object(Buffer.from('archival master'), {
    rendition: 'archive',
    kind: 'master',
    index: 0,
    path: 'archive/master.bin'
  });
  const renditions: StreamingManifest['renditions'] = [];
  const objects = [master];
  for (const rate of [96, 160, 320] as const) {
    const init = encryptor.object(Buffer.from(`init ${rate}`), {
      rendition: String(rate),
      kind: 'init',
      index: 0,
      path: `${rate}/init.bin`
    });
    const segment = encryptor.object(Buffer.from(`media ${rate}`), {
      rendition: String(rate),
      kind: 'media',
      index: 0,
      path: `${rate}/segment-000.bin`
    });
    objects.push(init, segment);
    renditions.push({ bitrateKbps: rate, mediaMime: STREAM_MIME, init: init.descriptor, segments: [segment.descriptor] });
  }
  const manifest = encryptor.manifest({ durationSeconds: 4, integratedLufs: -18, gainDb: 4, master: master.descriptor, renditions });
  return { manifest, objects };
}

describe('streaming nonce custody and authenticated format', () => {
  it('instruments every AES invocation across legacy, all renditions, retries and crash/resume', async () =>
    fixture(async directory => {
      const invocations = new Set<string>();
      const original = crypto.createCipheriv;
      crypto.createCipheriv = ((algorithm: string, key: Buffer, iv: Buffer, ...rest: unknown[]) => {
        const identity = `${streamingKeyFingerprint(key)}:${iv.toString('hex')}`;
        assert(!invocations.has(identity), 'duplicate actual key/nonce reached AES');
        invocations.add(identity);
        return Reflect.apply(original, crypto, [algorithm, key, iv, ...rest]);
      }) as typeof crypto.createCipheriv;
      syncBuiltinESMExports();
      try {
        const legacy = encryptAudioV2Container(Buffer.from('old master fixture'), KEY, {
          contentHash: SCOPE.contentHash,
          mediaMime: 'audio/mpeg',
          chunkSize: 8
        });
        const prefix = Buffer.from(parseAudioV2Container(legacy).header.noncePrefix, 'hex');
        let calls = 0;
        // First generation intentionally shares the legacy prefix: low/high halves
        // remain disjoint. Later reservations force that occupied prefix again.
        const ledger = new StreamingNonceLedger(directory, () => (calls++ < 2 ? prefix : randomBytes(8)));
        const first = await encrypted(ledger);
        verifyStreamingManifest(first.manifest, KEY, SCOPE);
        const count = invocations.size;
        // Reusing completed ciphertext and verifying it must never encrypt again.
        assert.equal(
          decryptStreamingObject(first.objects[0].bytes, KEY, first.manifest, first.objects[0].descriptor).toString(),
          'archival master'
        );
        assert.equal(invocations.size, count);
        const failed = await ledger.reserve(KEY);
        new StreamingEncryptor(KEY, failed, SCOPE).object(Buffer.from('failed job'), {
          rendition: '96',
          kind: 'init',
          index: 0,
          path: '96/init.bin'
        });
        const restarted = new StreamingNonceLedger(directory);
        const retried = await encrypted(restarted);
        assert.notEqual(retried.manifest.generation, first.manifest.generation);
        assert.notEqual(retried.manifest.generation, failed.generation);
        assert.equal(invocations.size, 3 + 8 + 1 + 8);
        // Fault-inject exhausted in-memory state; overflow must not reach AES.
        (failed as unknown as { counter: number }).counter = 0x80000000;
        const beforeOverflow = invocations.size;
        assert.throws(
          () =>
            new StreamingEncryptor(KEY, failed, SCOPE).object(Buffer.from('overflow'), {
              rendition: '96',
              kind: 'init',
              index: 0,
              path: '96/init.bin'
            }),
          /exhausted/
        );
        assert.equal(invocations.size, beforeOverflow);
        // Reservation files contain no key or plaintext and survive failure.
        const files = await readdir(path.join(directory, streamingKeyFingerprint(KEY)));
        assert.equal(files.length, 3);
        assert(!(await readFile(path.join(directory, streamingKeyFingerprint(KEY), files[0]), 'utf8')).includes(KEY.toString('hex')));
      } finally {
        crypto.createCipheriv = original;
        syncBuiltinESMExports();
      }
    }));

  it('rejects substitution, reordering, wrong release/generation and manifest tampering', async () =>
    fixture(async directory => {
      const { manifest, objects } = await encrypted(new StreamingNonceLedger(directory));
      const media = objects[2];
      const tampered = Buffer.from(media.bytes);
      tampered[0] ^= 1;
      assert.throws(() => decryptStreamingObject(tampered, KEY, manifest, media.descriptor));
      for (const altered of [
        { ...media.descriptor, index: 1 },
        { ...media.descriptor, rendition: '160' },
        { ...media.descriptor, kind: 'init' as const }
      ])
        assert.throws(() => decryptStreamingObject(media.bytes, KEY, manifest, altered));
      assert.throws(() => decryptStreamingObject(media.bytes, KEY, { ...manifest, generation: '0011223344556677' }, media.descriptor));
      assert.throws(() => decryptStreamingObject(media.bytes, KEY, { ...manifest, contentHash: `0x${'56'.repeat(32)}` }, media.descriptor));
      assert.throws(() => verifyStreamingManifest({ ...manifest, gainDb: 12 }, KEY, SCOPE));
      assert.throws(() => verifyStreamingManifest(manifest, KEY, { ...SCOPE, runtimeAddress: `0x${'78'.repeat(20)}` }));
      const reordered = structuredClone(manifest);
      reordered.renditions.reverse();
      assert.throws(() => verifyStreamingManifest(reordered, KEY, SCOPE));
    }));

  it('reserves exclusively across concurrent ledger instances and fails on exhausted collisions', async () =>
    fixture(async directory => {
      const prefix = Buffer.alloc(8, 1);
      const ledgers = Array.from({ length: 8 }, () => {
        let first = true;
        return new StreamingNonceLedger(directory, () => {
          if (first) {
            first = false;
            return prefix;
          }
          return randomBytes(8);
        });
      });
      const reservations = await Promise.all(ledgers.map(ledger => ledger.reserve(KEY)));
      assert.equal(new Set(reservations.map(item => item.generation)).size, 8);
      await assert.rejects(new StreamingNonceLedger(directory, () => prefix).reserve(KEY), /exhausted/);
      assert.throws(() => reservations[0].next(Buffer.alloc(32, 99)), /another key/);
    }));

  it('fails before encryption on overflow, unproven legacy scope and missing/corrupt ledger', async () =>
    fixture(async directory => {
      assert.equal(streamingNonce('0011223344556677', 0).readUInt32BE(8), 0x80000000);
      assert.equal(streamingNonce('0011223344556677', 0x7fffffff).readUInt32BE(8), 0xffffffff);
      assert.throws(() => streamingNonce('0011223344556677', 0x80000000), /exhausted/);
      const reserved = await new StreamingNonceLedger(directory).reserve(KEY);
      assert.throws(() => new StreamingEncryptor(KEY, reserved, { ...SCOPE, keyVersion: 'dotify-content-key-v1' }), /Unproven legacy/);
      await assert.rejects(new StreamingNonceLedger(path.join(directory, 'missing')).reserve(KEY));
      await writeFile(path.join(directory, 'ledger.json'), '{corrupt');
      await assert.rejects(new StreamingNonceLedger(directory).reserve(KEY));
    }));
});
