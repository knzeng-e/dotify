// Public synthetic codec fixture only; excluded from the production API image.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as dagPB from '@ipld/dag-pb';
import { CID } from 'multiformats/cid';
import { buildBulletinMediaGraph, type BulletinGraph } from '../services/bulletinGraph.js';
import { buildBulletinCompactMediaGraph } from '../services/bulletinCompactGraph.js';
import { parseStreamingManifest, verifyStreamingManifest, decryptStreamingObject, type StreamingScope } from '../services/streamingFormat.js';
import { formatStreamingReference } from '../services/streamingReference.js';
import type { PinataFile } from '../services/pinata.js';
import type { BulletinCodecFixture } from './bulletinCodecTypes.test.js';

export async function writeBulletinCodecFixture(output: string, files: PinataFile[], key: Buffer, scope: StreamingScope) {
  const manifest = parseStreamingManifest(files.find(file => file.path === 'manifest.json')!.bytes);
  verifyStreamingManifest(manifest, key, scope);
  for (const object of [manifest.master, ...manifest.renditions.flatMap(r => [r.init, ...r.segments])]) {
    const clear = decryptStreamingObject(files.find(file => file.path === object.path)!.bytes, key, manifest, object);
    clear.fill(0);
  }
  const signal = new AbortController().signal;
  const standard = await buildBulletinMediaGraph(files, signal);
  const compact = await buildBulletinCompactMediaGraph(files, signal);
  const blocks: Record<string, string> = {};
  function describe(graph: BulletinGraph, layout: 'unixfs-files-v1' | 'rendition-pack-v1') {
    const byCid = new Map(graph.blocks.map(block => [block.cid, block]));
    const playback = new Set<string>();
    const visit = (cid: string, root = false) => {
      if (playback.has(cid)) return;
      const block = byCid.get(cid);
      assert.ok(block, 'Fixture dependency missing');
      playback.add(cid);
      if (block.codec === dagPB.code) for (const link of dagPB.decode(block.bytes).Links) if (!(root && link.Name === 'archive')) visit(link.Hash.toString());
    };
    visit(graph.root, true);
    for (const block of graph.blocks) blocks[block.cid] = Buffer.from(block.bytes).toString('base64');
    const archiveBlockCids = graph.blocks.map(b => b.cid).filter(cid => !playback.has(cid));
    assert.ok(archiveBlockCids.length, 'Full archival graph must exist outside playback');
    return {
      root: graph.root,
      ref: formatStreamingReference(graph.root, scope.keyVersion, layout, value => CID.parse(value)),
      playbackBlockCids: [...playback],
      archiveBlockCids
    };
  }
  const fixture: BulletinCodecFixture = {
    schema: 'dotify.synthetic-bulletin-codec.v1',
    keyHex: key.toString('hex'),
    scope,
    blocks,
    graphs: { standard: describe(standard, 'unixfs-files-v1'), compact: describe(compact, 'rendition-pack-v1') }
  };
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(fixture));
}
