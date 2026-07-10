import { describe, expect, it } from 'vitest';
import { AudioV2HeaderIncompleteError, decryptAudioV2Container, parseAudioV2Container, parseAudioV2HeaderPrefix } from './audioV2';

const CONTENT_HASH = `0x${'ab'.repeat(32)}`;
const KEY = new Uint8Array(Array.from({ length: 32 }, () => 0xcd));
const encoder = new TextEncoder();

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function uint32be(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

async function encryptChunk(header: Record<string, unknown>, index: number, plain: Uint8Array, noncePrefix: Uint8Array) {
  const nonce = new Uint8Array(12);
  nonce.set(noncePrefix);
  nonce[11] = index;
  const aad = encoder.encode(
    [
      header.schema,
      String(header.version),
      header.contentHash,
      String(header.chunkSize),
      String(header.chunkCount),
      String(header.plaintextLength),
      header.mediaMime,
      String(index),
      String(plain.length)
    ].join('|')
  );
  const cryptoKey = await crypto.subtle.importKey('raw', KEY, 'AES-GCM', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, cryptoKey, plain));
}

async function makeContainer() {
  const plaintext = encoder.encode('hello chunked audio');
  const chunks = [plaintext.slice(0, 7), plaintext.slice(7)];
  const noncePrefix = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const header = {
    schema: 'dotify.audio.v2',
    version: 1,
    algorithm: 'AES-256-GCM',
    chunkSize: 7,
    chunkCount: chunks.length,
    plaintextLength: plaintext.length,
    mediaMime: 'audio/mpeg',
    contentHash: CONTENT_HASH,
    noncePrefix: hex(noncePrefix),
    chunks: chunks.map((chunk, index) => ({ index, plainLength: chunk.length, encryptedLength: chunk.length + 16 }))
  };
  const encryptedChunks = await Promise.all(chunks.map((chunk, index) => encryptChunk(header, index, chunk, noncePrefix)));
  const headerBytes = encoder.encode(JSON.stringify(header));
  const prefix = new Uint8Array([...encoder.encode('DAV2'), ...uint32be(headerBytes.length)]);
  const container = new Uint8Array(prefix.length + headerBytes.length + encryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  container.set(prefix, offset);
  offset += prefix.length;
  container.set(headerBytes, offset);
  offset += headerBytes.length;
  for (const chunk of encryptedChunks) {
    container.set(chunk, offset);
    offset += chunk.length;
  }
  return { container, plaintext };
}

describe('audioV2 browser helpers', () => {
  it('parses and decrypts a DAV2 container', async () => {
    const { container, plaintext } = await makeContainer();
    const parsed = parseAudioV2HeaderPrefix(container.slice(0, 1024));
    expect(parsed.header.mediaMime).toBe('audio/mpeg');

    const decrypted = await decryptAudioV2Container(container, KEY);
    expect(decrypted.mediaMime).toBe('audio/mpeg');
    expect(decrypted.bytes).toEqual(plaintext);
  });

  it('reports how many bytes are needed for an incomplete header', async () => {
    const { container } = await makeContainer();
    expect(() => parseAudioV2HeaderPrefix(container.slice(0, 12))).toThrow(AudioV2HeaderIncompleteError);
  });

  it('rejects a non-monotonic chunk table', async () => {
    const { container } = await makeContainer();
    const headerLength = new DataView(container.buffer, container.byteOffset + 4, 4).getUint32(0);
    const header = JSON.parse(new TextDecoder().decode(container.slice(8, 8 + headerLength)));
    header.chunks = [...header.chunks].reverse();
    const headerBytes = encoder.encode(JSON.stringify(header));
    const prefix = new Uint8Array([...encoder.encode('DAV2'), ...uint32be(headerBytes.length)]);
    const body = container.slice(8 + headerLength);
    const reorderedHeaderContainer = new Uint8Array(prefix.length + headerBytes.length + body.length);
    reorderedHeaderContainer.set(prefix, 0);
    reorderedHeaderContainer.set(headerBytes, prefix.length);
    reorderedHeaderContainer.set(body, prefix.length + headerBytes.length);

    expect(() => parseAudioV2Container(reorderedHeaderContainer)).toThrow(/Non-monotonic/);
  });

  it('rejects non-DAV2 bytes', () => {
    expect(() => parseAudioV2HeaderPrefix(encoder.encode('nope'))).toThrow();
  });
});
