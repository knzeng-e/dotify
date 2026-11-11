// Internal Host seam; ordinary playback/publication still use the old format.
// One portable range algorithm is compiled by the API and available to the Host adapter. Its
// module has no Node imports, config, secrets or signer/SDK dependencies.
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { blake2b256 } from '@polkadot-apps/utils';
import { compactObjectRanges, readCompactBulletinRange } from '../../../../services/api/src/services/bulletinCompactRange';
import { createBulletinHostBlockReader, boundedHostRead, bulletinHostMediaDeps, readHostBulletinBlock, type HostDeps } from './bulletinHostMedia';
import { readStreamingManifest, type StreamingScope } from './streamingFormat';
import { isBulletinMediaRoot } from './streamingTransport';

export function createBulletinHostCompactMediaReader(deps: HostDeps, readBlock = createBulletinHostBlockReader(deps)) {
  // Share the actual SDK lifetime/cache budget across all prepared sessions
  // created by this adapter, not one independent budget for each read.
  return async (input: { root: string; manifestBytes: Uint8Array; key: Uint8Array; scope: StreamingScope; signal: AbortSignal }) => {
    const { root, signal: preparationOwner } = input;
    preparationOwner.throwIfAborted();
    if (!isBulletinMediaRoot(root)) throw new Error('Invalid compact Bulletin root');
    if (!(input.manifestBytes instanceof Uint8Array) || !input.manifestBytes.length || input.manifestBytes.length > 256 * 1024)
      throw new Error('Invalid compact manifest bound');
    const manifestBytes = Uint8Array.from(input.manifestBytes);
    // Verify scope and GCM before using any logical path or rendition length.
    const context = await readStreamingManifest(manifestBytes, input.key, input.scope);
    preparationOwner.throwIfAborted();
    const ranges = compactObjectRanges(context.manifest);
    return {
      context,
      async read(objectPath: string, maxBytes: number, owner: AbortSignal = preparationOwner): Promise<Uint8Array | null> {
        const signal = AbortSignal.any([preparationOwner, owner]);
        signal.throwIfAborted();
        const range = ranges.get(objectPath);
        if (!range) throw new Error('Unsupported compact playback object');
        if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 1024 * 1024 + 16 || range.length > maxBytes)
          throw new Error('Invalid compact object bound');
        if (!(await boundedHostRead(async () => deps.insideHost(), signal, 1500))) return null;
        return readCompactBulletinRange({
          readBlock: (cid, signal) => readBlock(CID.parse(cid), signal),
          root,
          manifestBytes,
          objectPath,
          range,
          maxBytes,
          signal,
          codecs: {
            parseCid: value => CID.parse(value),
            decodeNode: dagPB.decode,
            decodeUnix: bytes => UnixFS.unmarshal(bytes),
            hash: blake2b256
          }
        });
      }
    };
  };
}

export const prepareHostCompactMedia = createBulletinHostCompactMediaReader(bulletinHostMediaDeps, readHostBulletinBlock);
