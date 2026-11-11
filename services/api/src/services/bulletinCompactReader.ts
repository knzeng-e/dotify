import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { blake2b } from '@noble/hashes/blake2';
// Internal authenticated object seam. No route, profile or publisher selects it.
import { parseStreamingManifest, verifyStreamingManifest, type StreamingScope } from './streamingFormat.js';
import { compactObjectRanges, readCompactBulletinRange } from './bulletinCompactRange.js';

export async function readAuthenticatedCompactObject(input: {
  readBlock: (cid: string, signal: AbortSignal) => Promise<Uint8Array>;
  root: string;
  manifestBytes: Uint8Array;
  key: Buffer;
  scope: StreamingScope;
  objectPath: string;
  maxBytes: number;
  signal: AbortSignal;
}): Promise<Uint8Array> {
  input.signal.throwIfAborted();
  // Copy before authentication; a caller's later mutation cannot change the
  // bytes compared against the root while a network read is in flight.
  if (!(input.manifestBytes instanceof Uint8Array) || !input.manifestBytes.length || input.manifestBytes.length > 256 * 1024)
    throw new Error('Invalid compact manifest bound');
  const manifestBytes = Uint8Array.from(input.manifestBytes);
  const manifest = parseStreamingManifest(manifestBytes);
  verifyStreamingManifest(manifest, input.key, input.scope);
  const range = compactObjectRanges(manifest).get(input.objectPath);
  if (!range) throw new Error('Unsupported compact playback object');
  return readCompactBulletinRange({
    ...input,
    manifestBytes,
    range,
    codecs: {
      parseCid: value => CID.parse(value),
      decodeNode: dagPB.decode,
      decodeUnix: bytes => UnixFS.unmarshal(bytes),
      hash: bytes => blake2b(bytes, { dkLen: 32 })
    }
  });
}
