import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptAudioV2Container, encryptAudioV2Container, parseAudioV2Container } from './audioV2.js';

const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const KEY = Buffer.from('cd'.repeat(32), 'hex');

describe('dotify.audio.v2 container', () => {
  it('round-trips audio bytes split across authenticated chunks', () => {
    const plaintext = Buffer.from('first chunk / second chunk / tail', 'utf8');
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg',
      chunkSize: 11,
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
      chunkSize: 8,
    });
    container[container.length - 1] ^= 0xff;

    assert.throws(() => decryptAudioV2Container(container, KEY));
  });

  it('rejects reordered encrypted chunks', () => {
    const plaintext = Buffer.from('chunk-onechunk-two', 'utf8');
    const container = encryptAudioV2Container(plaintext, KEY, {
      contentHash: CONTENT_HASH,
      mediaMime: 'audio/mpeg',
      chunkSize: 9,
    });
    const parsed = parseAudioV2Container(container);
    const firstStart = parsed.bodyOffset;
    const firstEnd = firstStart + parsed.header.chunks[0].encryptedLength;
    const secondEnd = firstEnd + parsed.header.chunks[1].encryptedLength;
    const reordered = Buffer.concat([
      container.subarray(0, parsed.bodyOffset),
      container.subarray(firstEnd, secondEnd),
      container.subarray(firstStart, firstEnd),
    ]);

    assert.throws(() => decryptAudioV2Container(reordered, KEY));
  });

  it('rejects non-DAV2 input', () => {
    assert.throws(() => parseAudioV2Container(Buffer.from('not dav2')), /DAV2/);
  });
});
