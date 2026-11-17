import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { blake2b } from '@noble/hashes/blake2';
import { encodeStreamingRelease, streamingLoudness } from './streamingEncoder.js';
import { decryptStreamingObject, verifyStreamingManifest, type StreamingScope } from './streamingFormat.js';
import { initializeStreamingNonceLedger, StreamingNonceLedger } from './streamingNonces.js';

function wave(seconds: number): Buffer {
  const sampleRate = 48000;
  const frames = Math.floor(sampleRate * seconds);
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index += 1)
    bytes.writeInt16LE(Math.round(Math.sin((index * 2 * Math.PI * 440) / sampleRate) * 2000), 44 + index * 2);
  return bytes;
}

const binary = process.env.DOTIFY_TEST_FFMPEG;
describe('streaming encoder', () => {
  it('computes bounded playback gain without amplifying silence or clipping peaks', () => {
    assert.deepEqual(streamingLoudness('I: -20.0 LUFS\nPeak: -8.0 dBFS'), { integratedLufs: -20, gainDb: 6 });
    assert.deepEqual(streamingLoudness('I: -20.0 LUFS\nPeak: -2.0 dBFS'), { integratedLufs: -20, gainDb: 1 });
    assert.deepEqual(streamingLoudness('I: -70.0 LUFS\nPeak: -inf dBFS'), { integratedLufs: null, gainDb: 0 });
    assert.throws(() => streamingLoudness('decoder failed'));
  });

  it(
    'transcodes all three fMP4 renditions, authenticates every object, preserves the original and cleans plaintext',
    { skip: !binary && 'Set DOTIFY_TEST_FFMPEG to an inspected FFmpeg binary', timeout: 30_000 },
    async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'dotify-encoder-test-'));
      try {
        const master = wave(8.2);
        const key = Buffer.alloc(32, 71);
        const scope: StreamingScope = {
          chainId: 420420417,
          runtimeAddress: `0x${'12'.repeat(20)}`,
          contentHash: `0x${Buffer.from(blake2b(master, { dkLen: 32 })).toString('hex')}`,
          keyVersion: 'dotify-content-key-v2'
        };
        const ledgerPath = path.join(directory, 'ledger');
        await initializeStreamingNonceLedger(ledgerPath);
        const ledger = new StreamingNonceLedger(ledgerPath);
        const phases: string[] = [];
        const mutableMaster = Buffer.from(master);
        const mutableKey = Buffer.from(key);
        const mutableScope = { ...scope };
        const pendingResult = encodeStreamingRelease({
          master: mutableMaster,
          key: mutableKey,
          scope: mutableScope,
          ledger,
          ffmpegPath: binary,
          temporaryRoot: directory,
          onProgress: phase => {
            phases.push(phase);
            if (phase === 'measuring') mutableMaster.fill(0);
          }
        });
        mutableKey.fill(0);
        mutableScope.contentHash = `0x${'99'.repeat(32)}`;
        const result = await pendingResult;
        verifyStreamingManifest(result.manifest, key, scope);
        assert.deepEqual(
          result.manifest.renditions.map(item => item.bitrateKbps),
          [96, 160, 320]
        );
        assert(Math.abs(result.manifest.durationSeconds - 8.2) < 0.1);
        assert(result.manifest.integratedLufs !== null);
        assert(phases.includes('measuring') && phases.includes('encoding') && phases.includes('encrypting'));
        const get = (name: string) => {
          const file = result.files.find(item => item.name === name);
          assert(file);
          return file.bytes;
        };
        assert.deepEqual(decryptStreamingObject(get(result.manifest.master.path), key, result.manifest, result.manifest.master), master);
        for (const rendition of result.manifest.renditions) {
          assert.equal(rendition.segments.length, 3);
          const clear = [rendition.init, ...rendition.segments].map(object =>
            decryptStreamingObject(get(object.path), key, result.manifest, object)
          );
          const file = path.join(directory, `${rendition.bitrateKbps}.mp4`);
          await writeFile(file, Buffer.concat(clear));
          // Actual decoder round-trip, not only checking an MP4 filename/header.
          execFileSync(binary!, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', '-'], {
            stdio: 'pipe',
            timeout: 10_000
          });
          await rm(file);
        }
        assert.deepEqual(await readdir(directory), ['ledger']);
        // A genuine retry creates fresh ciphertext/generation, never a reset counter.
        const second = await encodeStreamingRelease({ master, key, scope, ledger, ffmpegPath: binary, temporaryRoot: directory });
        assert.notEqual(second.manifest.generation, result.manifest.generation);
        // A failed external encoder still cleans all clear files and burns its prefix.
        await assert.rejects(
          encodeStreamingRelease({ master, key, scope, ledger, ffmpegPath: '/nonexistent/dotify-ffmpeg', temporaryRoot: directory }),
          /unavailable/
        );
        assert.deepEqual(await readdir(directory), ['ledger']);
        const malformed = Buffer.alloc(42);
        malformed.write('fLaC');
        malformed[4] = 0x80;
        malformed[7] = 34;
        const malformedScope = { ...scope, contentHash: `0x${Buffer.from(blake2b(malformed, { dkLen: 32 })).toString('hex')}` };
        await assert.rejects(
          encodeStreamingRelease({ master: malformed, key, scope: malformedScope, ledger, ffmpegPath: binary, temporaryRoot: directory })
        );
        assert.deepEqual(await readdir(directory), ['ledger']);
        // A trusted executable stub ensures cancellation happens during a running
        // child, not only during the initial signal precheck. No orphan child.
        const blockedEncoder = path.join(directory, 'blocked-encoder');
        await writeFile(blockedEncoder, '#!/bin/sh\nif [ -n "$DOTIFY_SYNTHETIC_SENTINEL" ]; then exit 42; fi\nexec /bin/sleep 10\n', {
          mode: 0o700
        });
        const controller = new AbortController();
        const previousSentinel = process.env.DOTIFY_SYNTHETIC_SENTINEL;
        process.env.DOTIFY_SYNTHETIC_SENTINEL = 'synthetic-fixture-only';
        try {
          await assert.rejects(
            encodeStreamingRelease({
              master,
              key,
              scope,
              ledger,
              ffmpegPath: blockedEncoder,
              temporaryRoot: directory,
              signal: controller.signal,
              onProgress: phase => {
                if (phase === 'measuring') setTimeout(() => controller.abort(), 30);
              }
            }),
            /cancelled/
          );
        } finally {
          if (previousSentinel === undefined) delete process.env.DOTIFY_SYNTHETIC_SENTINEL;
          else process.env.DOTIFY_SYNTHETIC_SENTINEL = previousSentinel;
        }
        await rm(blockedEncoder);
        assert.deepEqual(await readdir(directory), ['ledger']);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
