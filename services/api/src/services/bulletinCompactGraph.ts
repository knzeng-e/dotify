// Compact construction is selected only by reviewed exact-source admission.
import { buildBulletinDirectoryGraph, validateBulletinMediaFiles, type BulletinGraph } from './bulletinGraph.js';
import { COMPACT_BULLETIN_LAYOUT, compactLayoutMarker } from './bulletinStorageLayout.js';
import type { PinataFile } from './pinata.js';
import type { StreamingManifest } from './streamingFormat.js';

export { compactObjectRanges, type CompactObjectRange } from './bulletinCompactRange.js';

/** Preserve original ciphertext, archive, init/first files and manifest bytes.
 * The custody encoder must authenticate the logical objects before calling. */
export function compactBulletinFiles(files: PinataFile[]): { manifest: StreamingManifest; files: PinataFile[] } {
  const manifest = validateBulletinMediaFiles(files);
  const byPath = new Map(files.map(file => [file.path, file.bytes]));
  const retained = ['manifest.json', manifest.master.path, ...manifest.renditions.flatMap(r => [r.init.path, r.segments[0].path])];
  return {
    manifest,
    files: [
      { path: 'layout.json', bytes: Buffer.from(JSON.stringify(compactLayoutMarker())) },
      ...retained.map(path => ({ path, bytes: Buffer.from(byPath.get(path)!) })),
      ...manifest.renditions.flatMap(rendition => {
        const later = rendition.segments.slice(1);
        return later.length ? [{ path: `${rendition.bitrateKbps}/pack.bin`, bytes: Buffer.concat(later.map(object => byPath.get(object.path)!)) }] : [];
      })
    ]
  };
}

export async function buildBulletinCompactMediaGraph(files: PinataFile[], signal: AbortSignal): Promise<BulletinGraph> {
  signal.throwIfAborted();
  const compact = compactBulletinFiles(files);
  const graph = await buildBulletinDirectoryGraph(compact.files, signal);
  const manifest = compact.manifest;
  return {
    ...graph,
    layout: COMPACT_BULLETIN_LAYOUT,
    scope: { chainId: manifest.chainId, runtimeAddress: manifest.runtimeAddress, contentHash: manifest.contentHash, keyVersion: manifest.keyVersion },
    generation: manifest.generation
  };
}
