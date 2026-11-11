// Internal format construction, not selected by any profile, route or queue.
import assert from 'node:assert/strict';
import { buildBulletinDirectoryGraph, validateBulletinMediaFiles, type BulletinGraph } from './bulletinGraph.js';
import { COMPACT_BULLETIN_LAYOUT, compactLayoutMarker } from './bulletinStorageLayout.js';
import type { StreamingManifest } from './streamingFormat.js';
import type { PinataFile } from './pinata.js';

export type CompactObjectRange = Readonly<{ path: string; offset: number; length: number; total: number }>;

/** The caller supplies a parsed (and, for playback, ordinarily authenticated)
 * manifest. Physical offsets have no authority independent of that manifest. */
export function compactObjectRanges(manifest: StreamingManifest): ReadonlyMap<string, CompactObjectRange> {
  const result = new Map<string, CompactObjectRange>();
  for (const rendition of manifest.renditions) {
    for (const object of [rendition.init, rendition.segments[0]]) {
      result.set(object.path, { path: object.path, offset: 0, length: object.encryptedLength, total: object.encryptedLength });
    }
    const later = rendition.segments.slice(1);
    const total = later.reduce((sum, object) => sum + object.encryptedLength, 0);
    assert.ok(Number.isSafeInteger(total) && total <= 132 * 1024 * 1024, 'Invalid compact rendition length');
    let offset = 0;
    for (const object of later) {
      result.set(object.path, { path: `${rendition.bitrateKbps}/pack.bin`, offset, length: object.encryptedLength, total });
      offset += object.encryptedLength;
    }
  }
  return result;
}

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
