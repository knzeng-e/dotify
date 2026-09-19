import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_AUDIO_V2_CHUNK_SIZE,
  DEFAULT_AUDIO_V2_FIRST_CHUNK_SIZE,
  MIN_AUDIO_V2_FIRST_PAYLOAD_BYTES,
  decryptAudioV2Container,
  encryptAudioV2Container,
  parseAudioV2Container
} from './audioV2.js';

const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const KEY = Buffer.from('cd'.repeat(32), 'hex');

describe('dotify.audio.v2 container', () => {
  it('round-trips audio bytes split across authenticated chunks', () => {
    const plaintext = Buffer.from('first chunk / second chunk / tail', 'utf8');
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg',
      chunkSize: 11
    });

    const parsed = parseAudioV2Container(container);
    assert.equal(parsed.header.schema, 'dotify.audio.v2');
    assert.equal(parsed.header.mediaMime, 'audio/mpeg');
    assert.equal(parsed.header.chunkCount, 3);
    assert.equal(parsed.header.contentHash, CONTENT_HASH);
    assert.deepEqual(decryptAudioV2Container(container, KEY), plaintext);
  });

  it('rejects tampered chunk bytes', () => {
    const plaintext = Buffer.from('authenticated audio bytes', 'utf8');
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg',
      chunkSize: 8
    });
    container[container.length - 1] ^= 0xff;

    assert.throws(() => decryptAudioV2Container(container, KEY));
  });

  it('uses a smaller first range for new production containers', () => {
    const tailLength = 37;
    const plaintext = Buffer.alloc(DEFAULT_AUDIO_V2_FIRST_CHUNK_SIZE + DEFAULT_AUDIO_V2_CHUNK_SIZE + tailLength, 0x5a);
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg'
    });

    const parsed = parseAudioV2Container(container);
    assert.equal(parsed.header.chunkSize, DEFAULT_AUDIO_V2_CHUNK_SIZE);
    assert.deepEqual(
      parsed.header.chunks.map(chunk => chunk.plainLength),
      [DEFAULT_AUDIO_V2_FIRST_CHUNK_SIZE, DEFAULT_AUDIO_V2_CHUNK_SIZE, tailLength]
    );
    assert.equal(parsed.header.chunks[0].encryptedLength, DEFAULT_AUDIO_V2_FIRST_CHUNK_SIZE + 16);
    assert.deepEqual(decryptAudioV2Container(container, KEY), plaintext);
  });

  it('keeps explicit chunk-size callers uniform unless they opt into a smaller first chunk', () => {
    const plaintext = Buffer.alloc(25, 0x2a);
    const uniform = parseAudioV2Container(encryptAudioV2Container(plaintext, KEY, { contentHash: CONTENT_HASH, mediaMime: 'audio/mpeg', chunkSize: 10 }));
    const frontLoaded = parseAudioV2Container(
      encryptAudioV2Container(plaintext, KEY, { contentHash: CONTENT_HASH, mediaMime: 'audio/mpeg', chunkSize: 10, firstChunkSize: 4 })
    );

    assert.deepEqual(
      uniform.header.chunks.map(chunk => chunk.plainLength),
      [10, 10, 5]
    );
    assert.deepEqual(
      frontLoaded.header.chunks.map(chunk => chunk.plainLength),
      [4, 10, 10, 1]
    );
  });

  it('expands the first range past validated leading metadata without exceeding the old 512 KiB boundary', () => {
    const leadingMetadataBytes = 300 * 1024;
    const plaintext = Buffer.alloc(DEFAULT_AUDIO_V2_CHUNK_SIZE * 2, 0x31);
    const parsed = parseAudioV2Container(
      encryptAudioV2Container(plaintext, KEY, {
        contentHash: CONTENT_HASH,
        mediaMime: 'audio/mpeg',
        leadingMetadataBytes
      })
    );

    assert.equal(parsed.header.chunks[0].plainLength, leadingMetadataBytes + MIN_AUDIO_V2_FIRST_PAYLOAD_BYTES);

    const nearBoundary = parseAudioV2Container(
      encryptAudioV2Container(plaintext, KEY, {
        contentHash: CONTENT_HASH,
        mediaMime: 'audio/mpeg',
        leadingMetadataBytes: DEFAULT_AUDIO_V2_CHUNK_SIZE - 1024
      })
    );
    assert.equal(nearBoundary.header.chunks[0].plainLength, DEFAULT_AUDIO_V2_CHUNK_SIZE);
  });

  it('rejects a first-chunk budget above the steady-state chunk size', () => {
    assert.throws(
      () =>
        encryptAudioV2Container(Buffer.alloc(32), KEY, {
          contentHash: CONTENT_HASH,
          mediaMime: 'audio/mpeg',
          chunkSize: 8,
          firstChunkSize: 9
        }),
      /first chunk size/i
    );
  });

  it('rejects reordered encrypted chunks', () => {
    const plaintext = Buffer.from('chunk-onechunk-two', 'utf8');
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg',
      chunkSize: 9
    });
    const parsed = parseAudioV2Container(container);
    const firstStart = parsed.bodyOffset;
    const firstEnd = firstStart + parsed.header.chunks[0].encryptedLength;
    const secondEnd = firstEnd + parsed.header.chunks[1].encryptedLength;
    const reordered = Buffer.concat([
      container.subarray(0, parsed.bodyOffset),
      container.subarray(firstEnd, secondEnd),
      container.subarray(firstStart, firstEnd)
    ]);

    assert.throws(() => decryptAudioV2Container(reordered, KEY));
  });

  it('rejects non-DAV2 input', () => {
    assert.throws(() => parseAudioV2Container(Buffer.from('not dav2')), /DAV2/);
  });
});
