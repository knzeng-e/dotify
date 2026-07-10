const MAGIC = 'DAV2';
const PREFIX_BYTES = 8;
const AUTH_TAG_BYTES = 16;
const INITIAL_HEADER_RANGE_BYTES = 64 * 1024;

export class AudioV2HeaderIncompleteError extends Error {
  constructor(readonly neededBytes: number) {
    super(`DAV2 header requires ${neededBytes} bytes`);
    this.name = 'AudioV2HeaderIncompleteError';
  }
}

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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function readMagic(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes.slice(0, 4));
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function chunkNonce(header: AudioV2Header, index: number): Uint8Array {
  const prefix = hexToBytes(header.noncePrefix);
  if (prefix.length !== 8) throw new Error('DAV2 nonce prefix must be 8 bytes');
  const nonce = new Uint8Array(12);
  nonce.set(prefix, 0);
  nonce[8] = (index >>> 24) & 0xff;
  nonce[9] = (index >>> 16) & 0xff;
  nonce[10] = (index >>> 8) & 0xff;
  nonce[11] = index & 0xff;
  return nonce;
}

function chunkAad(header: AudioV2Header, index: number, plainLength: number): Uint8Array {
  return textEncoder.encode(
    [
      header.schema,
      String(header.version),
      header.contentHash,
      String(header.chunkSize),
      String(header.chunkCount),
      String(header.plaintextLength),
      header.mediaMime,
      String(index),
      String(plainLength)
    ].join('|')
  );
}

function validateHeader(header: AudioV2Header, bodyLength?: number): void {
  if (header.schema !== 'dotify.audio.v2' || header.version !== 1 || header.algorithm !== 'AES-256-GCM') throw new Error('Unsupported DAV2 header');
  if (!Number.isSafeInteger(header.chunkSize) || header.chunkSize <= 0) throw new Error('Invalid DAV2 chunk size');
  if (!Number.isSafeInteger(header.chunkCount) || header.chunkCount <= 0) throw new Error('Invalid DAV2 chunk count');
  if (!Number.isSafeInteger(header.plaintextLength) || header.plaintextLength <= 0) throw new Error('Invalid DAV2 plaintext length');
  if (!/^[0-9a-f]{16}$/i.test(header.noncePrefix)) throw new Error('Invalid DAV2 nonce prefix');
  if (!Array.isArray(header.chunks) || header.chunks.length !== header.chunkCount) throw new Error('Invalid DAV2 chunk table');

  let plainTotal = 0;
  let encryptedTotal = 0;
  for (let index = 0; index < header.chunks.length; index += 1) {
    const chunk = header.chunks[index];
    if (chunk.index !== index) throw new Error('Non-monotonic DAV2 chunk table');
    if (!Number.isSafeInteger(chunk.plainLength) || chunk.plainLength <= 0) throw new Error('Invalid DAV2 plain chunk length');
    if (chunk.encryptedLength !== chunk.plainLength + AUTH_TAG_BYTES) throw new Error('Invalid DAV2 encrypted chunk length');
    plainTotal += chunk.plainLength;
    encryptedTotal += chunk.encryptedLength;
  }
  if (plainTotal !== header.plaintextLength) throw new Error('DAV2 plaintext length mismatch');
  if (bodyLength !== undefined && encryptedTotal !== bodyLength) throw new Error('DAV2 body length mismatch');
}

export function parseAudioV2HeaderPrefix(bytes: Uint8Array): ParsedAudioV2 {
  if (bytes.length < PREFIX_BYTES) throw new AudioV2HeaderIncompleteError(PREFIX_BYTES);
  if (readMagic(bytes) !== MAGIC) throw new Error('Invalid DAV2 magic');
  const headerLength = readUint32BE(bytes, 4);
  const bodyOffset = PREFIX_BYTES + headerLength;
  if (headerLength <= 0) throw new Error('Invalid DAV2 header length');
  if (bytes.length < bodyOffset) throw new AudioV2HeaderIncompleteError(bodyOffset);
  const header = JSON.parse(textDecoder.decode(bytes.slice(PREFIX_BYTES, bodyOffset))) as AudioV2Header;
  validateHeader(header);
  return { header, bodyOffset };
}

export function parseAudioV2Container(bytes: Uint8Array): ParsedAudioV2 {
  const parsed = parseAudioV2HeaderPrefix(bytes);
  validateHeader(parsed.header, bytes.length - parsed.bodyOffset);
  return parsed;
}

export function initialAudioV2HeaderRangeEnd(): number {
  return INITIAL_HEADER_RANGE_BYTES - 1;
}

export function audioV2ChunkBodyOffset(header: AudioV2Header, index: number): number {
  let offset = 0;
  for (let chunkIndex = 0; chunkIndex < index; chunkIndex += 1) {
    offset += header.chunks[chunkIndex].encryptedLength;
  }
  return offset;
}

export async function decryptAudioV2Chunk(header: AudioV2Header, index: number, encryptedChunk: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const chunk = header.chunks[index];
  if (!chunk || encryptedChunk.length !== chunk.encryptedLength) throw new Error('Invalid DAV2 encrypted chunk');
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: chunkNonce(header, index),
        additionalData: chunkAad(header, index, chunk.plainLength)
      },
      cryptoKey,
      encryptedChunk
    )
  );
}

export async function decryptAudioV2Container(container: Uint8Array, key: Uint8Array): Promise<{ bytes: Uint8Array; mediaMime: string }> {
  const parsed = parseAudioV2Container(container);
  const clearChunks: Uint8Array[] = [];
  let encryptedOffset = parsed.bodyOffset;
  for (const chunk of parsed.header.chunks) {
    const encrypted = container.slice(encryptedOffset, encryptedOffset + chunk.encryptedLength);
    clearChunks.push(await decryptAudioV2Chunk(parsed.header, chunk.index, encrypted, key));
    encryptedOffset += chunk.encryptedLength;
  }

  const bytes = new Uint8Array(parsed.header.plaintextLength);
  let clearOffset = 0;
  for (const chunk of clearChunks) {
    bytes.set(chunk, clearOffset);
    clearOffset += chunk.length;
  }
  return { bytes, mediaMime: parsed.header.mediaMime };
}

export function canStreamAudioV2WithMse(header: AudioV2Header): boolean {
  const mediaSourceCtor = window.MediaSource;
  return Boolean(mediaSourceCtor && header.mediaMime && mediaSourceCtor.isTypeSupported(header.mediaMime));
}
