import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('DAV2', 'ascii');
const PREFIX_BYTES = 8;
const AUTH_TAG_BYTES = 16;
export const DEFAULT_AUDIO_V2_CHUNK_SIZE = 512 * 1024;

export type AudioV2Header = {
  schema: 'dotify.audio.v2';
  version: 1;
  algorithm: 'AES-256-GCM';
  chunkSize: number;
  chunkCount: number;
  plaintextLength: number;
  mediaMime: string;
  contentHash: string;
  noncePrefix: string;
  chunks: Array<{
    index: number;
    plainLength: number;
    encryptedLength: number;
  }>;
};

export type ParsedAudioV2 = {
  header: AudioV2Header;
  bodyOffset: number;
};

function normalizeContentHash(contentHash: string): string {
  return contentHash.toLowerCase();
}

function chunkAad(header: AudioV2Header, index: number, plainLength: number): Buffer {
  return Buffer.from(
    [
      header.schema,
      String(header.version),
      header.contentHash,
      String(header.chunkSize),
      String(header.chunkCount),
      String(header.plaintextLength),
      header.mediaMime,
      String(index),
      String(plainLength),
    ].join('|'),
    'utf8',
  );
}

function chunkNonce(noncePrefix: Buffer, index: number): Buffer {
  if (noncePrefix.length !== 8) throw new Error('DAV2 nonce prefix must be 8 bytes');
  if (!Number.isSafeInteger(index) || index < 0 || index > 0xffffffff) throw new Error('DAV2 chunk index is out of range');
  const nonce = Buffer.alloc(12);
  noncePrefix.copy(nonce, 0);
  nonce.writeUInt32BE(index, 8);
  return nonce;
}

function encodeHeader(header: AudioV2Header): Buffer {
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const prefix = Buffer.alloc(PREFIX_BYTES);
  MAGIC.copy(prefix, 0);
  prefix.writeUInt32BE(json.length, 4);
  return Buffer.concat([prefix, json]);
}

export function parseAudioV2Container(bytes: Uint8Array): ParsedAudioV2 {
  const buffer = Buffer.from(bytes);
  if (buffer.length < PREFIX_BYTES) throw new Error('DAV2 container is too short');
  if (!buffer.subarray(0, 4).equals(MAGIC)) throw new Error('Invalid DAV2 magic');

  const headerLength = buffer.readUInt32BE(4);
  const bodyOffset = PREFIX_BYTES + headerLength;
  if (headerLength <= 0 || bodyOffset > buffer.length) throw new Error('Invalid DAV2 header length');

  const parsed = JSON.parse(buffer.subarray(PREFIX_BYTES, bodyOffset).toString('utf8')) as AudioV2Header;
  if (parsed.schema !== 'dotify.audio.v2' || parsed.version !== 1 || parsed.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported DAV2 header');
  }
  if (!Number.isSafeInteger(parsed.chunkSize) || parsed.chunkSize <= 0) throw new Error('Invalid DAV2 chunk size');
  if (!Number.isSafeInteger(parsed.chunkCount) || parsed.chunkCount <= 0) throw new Error('Invalid DAV2 chunk count');
  if (!Number.isSafeInteger(parsed.plaintextLength) || parsed.plaintextLength <= 0) throw new Error('Invalid DAV2 plaintext length');
  if (!/^0x[0-9a-f]{64}$/i.test(parsed.contentHash)) throw new Error('Invalid DAV2 content hash');
  if (typeof parsed.mediaMime !== 'string' || parsed.mediaMime.trim().length === 0) throw new Error('Invalid DAV2 media MIME');
  if (!/^[0-9a-f]{16}$/i.test(parsed.noncePrefix)) throw new Error('Invalid DAV2 nonce prefix');
  if (!Array.isArray(parsed.chunks) || parsed.chunks.length !== parsed.chunkCount) throw new Error('Invalid DAV2 chunk table');

  let encryptedTotal = 0;
  let plaintextTotal = 0;
  for (let index = 0; index < parsed.chunks.length; index += 1) {
    const chunk = parsed.chunks[index];
    if (chunk.index !== index) throw new Error('Non-monotonic DAV2 chunk table');
    if (!Number.isSafeInteger(chunk.plainLength) || chunk.plainLength <= 0) throw new Error('Invalid DAV2 plain chunk length');
    if (chunk.encryptedLength !== chunk.plainLength + AUTH_TAG_BYTES) throw new Error('Invalid DAV2 encrypted chunk length');
    plaintextTotal += chunk.plainLength;
    encryptedTotal += chunk.encryptedLength;
  }
  if (plaintextTotal !== parsed.plaintextLength) throw new Error('DAV2 plaintext length mismatch');
  if (bodyOffset + encryptedTotal !== buffer.length) throw new Error('DAV2 body length mismatch');

  return { header: parsed, bodyOffset };
}

export function encryptAudioV2Container(
  plaintext: Uint8Array,
  key: Buffer,
  options: { contentHash: string; mediaMime: string; chunkSize?: number },
): Buffer {
  if (plaintext.length === 0) throw new Error('Cannot encrypt an empty DAV2 audio payload');
  if (key.length !== 32) throw new Error('DAV2 encryption requires a 32-byte key');

  const chunkSize = options.chunkSize ?? DEFAULT_AUDIO_V2_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new Error('Invalid DAV2 chunk size');
  const chunkCount = Math.ceil(plaintext.length / chunkSize);
  if (chunkCount > 0xffffffff) throw new Error('DAV2 chunk count is out of range');
  const noncePrefix = randomBytes(8);

  const header: AudioV2Header = {
    schema: 'dotify.audio.v2',
    version: 1,
    algorithm: 'AES-256-GCM',
    chunkSize,
    chunkCount,
    plaintextLength: plaintext.length,
    mediaMime: options.mediaMime || 'application/octet-stream',
    contentHash: normalizeContentHash(options.contentHash),
    noncePrefix: noncePrefix.toString('hex'),
    chunks: [],
  };

  const encryptedChunks: Buffer[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, plaintext.length);
    const chunk = Buffer.from(plaintext.subarray(start, end));
    const cipher = createCipheriv('aes-256-gcm', key, chunkNonce(noncePrefix, index));
    cipher.setAAD(chunkAad(header, index, chunk.length));
    const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encrypted = Buffer.concat([ciphertext, authTag]);
    header.chunks.push({ index, plainLength: chunk.length, encryptedLength: encrypted.length });
    encryptedChunks.push(encrypted);
  }

  return Buffer.concat([encodeHeader(header), ...encryptedChunks]);
}

export function decryptAudioV2Container(container: Uint8Array, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('DAV2 decryption requires a 32-byte key');
  const parsed = parseAudioV2Container(container);
  const buffer = Buffer.from(container);
  const noncePrefix = Buffer.from(parsed.header.noncePrefix, 'hex');
  const clearChunks: Buffer[] = [];
  let offset = parsed.bodyOffset;

  for (const chunk of parsed.header.chunks) {
    const encrypted = buffer.subarray(offset, offset + chunk.encryptedLength);
    const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_BYTES);
    const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, chunkNonce(noncePrefix, chunk.index));
    decipher.setAAD(chunkAad(parsed.header, chunk.index, chunk.plainLength));
    decipher.setAuthTag(authTag);
    clearChunks.push(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
    offset += chunk.encryptedLength;
  }

  return Buffer.concat(clearChunks);
}
