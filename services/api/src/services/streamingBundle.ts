// Fixed, bounded binary protocol between the isolated parser and key custodian.
// There are no filenames, URLs, keys or caller-selected encoder options.
import type { EncodedStreamingAudio } from './streamingTranscoder.js';
export const STREAM_BUNDLE_MAX = 80 * 1024 * 1024;
const rates = [96, 160, 320] as const;
export function packStreamingBundle(audio: EncodedStreamingAudio): Buffer {
  const header = Buffer.from(
    JSON.stringify([audio.durationSeconds, audio.integratedLufs, audio.gainDb, audio.renditions.map(r => [r.init.length, ...r.segments.map(s => s.length)])])
  );
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(header.length);
  const bytes = Buffer.concat([prefix, header, ...audio.renditions.flatMap(r => [r.init, ...r.segments])]);
  unpackStreamingBundle(bytes); // Apply the same bounds at both ends.
  return bytes;
}
export function unpackStreamingBundle(bytes: Buffer): EncodedStreamingAudio {
  if (bytes.length < 5 || bytes.length > STREAM_BUNDLE_MAX) throw new Error('Invalid encoder bundle size');
  const length = bytes.readUInt32BE(0);
  if (!length || length > 32 * 1024 || length + 4 >= bytes.length) throw new Error('Invalid encoder bundle header');
  const header: unknown = JSON.parse(bytes.subarray(4, 4 + length).toString('utf8'));
  if (!Array.isArray(header) || header.length !== 4) throw new Error('Invalid encoder bundle');
  const [durationSeconds, integratedLufs, gainDb, lengths] = header;
  const finite = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (
    !finite(durationSeconds, 0.001, 900) ||
    !finite(gainDb, -24, 12) ||
    (integratedLufs !== null && !finite(integratedLufs, -70, 10)) ||
    !Array.isArray(lengths) ||
    lengths.length !== 3
  )
    throw new Error('Invalid encoder audio metadata');
  let offset = 4 + length;
  const renditions = rates.map((bitrateKbps, index) => {
    const sizes: unknown = lengths[index];
    if (!Array.isArray(sizes) || sizes.length < 2 || sizes.length > 257) throw new Error('Invalid encoder segment count');
    const parts = sizes.map(size => {
      if (!Number.isSafeInteger(size) || size <= 0 || size > 1024 * 1024 || offset + size > bytes.length) throw new Error('Invalid encoder object size');
      const part = bytes.subarray(offset, offset + size);
      offset += size;
      return part;
    });
    return { bitrateKbps, init: parts[0], segments: parts.slice(1) };
  });
  if (offset !== bytes.length) throw new Error('Unexpected encoder bundle bytes');
  return { durationSeconds, integratedLufs, gainDb, renditions };
}
