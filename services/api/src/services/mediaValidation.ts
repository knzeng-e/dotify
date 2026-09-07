export type ValidatedMedia = {
  mime: string;
  extension: string;
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString('ascii');
}

function includesAscii(bytes: Uint8Array, value: string, offset = 0): boolean {
  return Buffer.from(bytes).indexOf(value, offset, 'ascii') !== -1;
}

type MpegFrame = {
  length: number;
};

function parseMpegAudioFrame(bytes: Uint8Array, offset = 0): MpegFrame | null {
  if (bytes.length < offset + 4 || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
  const version = (bytes[offset + 1] >> 3) & 0x03;
  const layer = (bytes[offset + 1] >> 1) & 0x03;
  const bitrate = (bytes[offset + 2] >> 4) & 0x0f;
  const sampleRate = (bytes[offset + 2] >> 2) & 0x03;
  if (version === 1 || layer === 0 || bitrate === 0 || bitrate === 0x0f || sampleRate === 0x03) return null;

  const bitrateKbpsByVersionAndLayer: Record<number, Record<number, number[]>> = {
    3: {
      3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
      2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
      1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    },
    2: {
      3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
      1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    },
    0: {
      3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
      1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    }
  };
  const sampleRatesByVersion: Record<number, number[]> = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000]
  };

  const bitrateBps = bitrateKbpsByVersionAndLayer[version]?.[layer]?.[bitrate] * 1000;
  const sampleRateHz = sampleRatesByVersion[version]?.[sampleRate];
  if (!bitrateBps || !sampleRateHz) return null;

  const padding = (bytes[offset + 2] >> 1) & 0x01;
  const length =
    layer === 3
      ? Math.floor((12 * bitrateBps) / sampleRateHz + padding) * 4
      : Math.floor(((version === 3 ? 144 : 72) * bitrateBps) / sampleRateHz + padding);
  if (length < 4 || offset + length > bytes.length) return null;
  return { length };
}

function id3AudioStart(bytes: Uint8Array): number | null {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== 'ID3') return null;
  const sizeBytes = bytes.subarray(6, 10);
  if (sizeBytes.some(value => (value & 0x80) !== 0)) return null;
  const tagBytes = (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
  const audioStart = 10 + tagBytes;
  return audioStart < bytes.length ? audioStart : null;
}

function hasCompleteMpegAudioFrameSequence(bytes: Uint8Array, offset = 0): boolean {
  let cursor = offset;
  let frames = 0;
  while (cursor < bytes.length) {
    if (bytes.length - cursor === 128 && ascii(bytes, cursor, 3) === 'TAG') return frames >= 2;
    const frame = parseMpegAudioFrame(bytes, cursor);
    if (!frame) return false;
    frames += 1;
    cursor += frame.length;
  }
  return frames >= 2;
}

function hasWavChunks(bytes: Uint8Array): boolean {
  let offset = 12;
  let hasFormat = false;
  let hasData = false;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = Buffer.from(bytes.subarray(offset + 4, offset + 8)).readUInt32LE(0);
    const next = offset + 8 + size + (size % 2);
    if (next > bytes.length) return false;
    if (chunk === 'fmt ' && size >= 16) hasFormat = true;
    if (chunk === 'data' && size > 0) hasData = true;
    if (hasFormat && hasData) return true;
    offset = next;
  }
  return false;
}

/** Detect supported audio containers from their received bytes. */
export function detectAudioMedia(bytes: Uint8Array): ValidatedMedia | null {
  if (bytes.length < 4) return null;
  if (bytes.length >= 42 && ascii(bytes, 0, 4) === 'fLaC' && (bytes[4] & 0x7f) === 0 && ((bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) === 34) {
    return { mime: 'audio/flac', extension: 'flac' };
  }
  if (bytes.length >= 27 && ascii(bytes, 0, 4) === 'OggS' && bytes[4] === 0 && 27 + bytes[26] <= bytes.length) {
    return { mime: 'audio/ogg', extension: 'ogg' };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'audio/webm', extension: 'webm' };
  if (bytes.length >= 44 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE' && hasWavChunks(bytes)) {
    return { mime: 'audio/wav', extension: 'wav' };
  }
  if (bytes.length >= 24 && ascii(bytes, 4, 4) === 'ftyp' && includesAscii(bytes, 'mdat', 12)) {
    return { mime: 'audio/mp4', extension: 'm4a' };
  }

  const id3Start = id3AudioStart(bytes);
  if (id3Start !== null && hasCompleteMpegAudioFrameSequence(bytes, id3Start)) return { mime: 'audio/mpeg', extension: 'mp3' };
  if (hasCompleteMpegAudioFrameSequence(bytes)) return { mime: 'audio/mpeg', extension: 'mp3' };

  if (bytes.length >= 7 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    const frameLength = ((bytes[3] & 0x03) << 11) | (bytes[4] << 3) | (bytes[5] >> 5);
    if (frameLength >= 7 && frameLength <= bytes.length) return { mime: 'audio/aac', extension: 'aac' };
  }
  return null;
}

/** Detect supported image containers from their received bytes. */
export function detectImageMedia(bytes: Uint8Array): ValidatedMedia | null {
  if (bytes.length >= 4 && startsWith(bytes, [0xff, 0xd8, 0xff]) && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 33 &&
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    ascii(bytes, 12, 4) === 'IHDR' &&
    includesAscii(bytes, 'IEND', 29)
  ) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(bytes, 12, 4))) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  const gifHeader = ascii(bytes, 0, 6);
  if (bytes.length >= 14 && (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') && bytes[bytes.length - 1] === 0x3b) {
    return { mime: 'image/gif', extension: 'gif' };
  }
  return null;
}
