import assert from 'node:assert/strict';
import { importer } from 'ipfs-unixfs-importer';
import { fixedSize } from 'ipfs-unixfs-importer/chunker';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';

import { verifyBlock, MAX_BLOCK_BYTES } from './reader.mjs';

export const GENESIS = '0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59';
export { verifyBlock, MAX_BLOCK_BYTES, readPath, hostBlockReader } from './reader.mjs';
import { fixtureProfile } from './fixture-profile.mjs';
const MAX_BLOCKS = 128;

function validPath(path) {
  assert.equal(typeof path, 'string');
  assert.ok(path.length > 0 && path.length <= 160 && path.split('/').length <= 8, 'Invalid path budget');
  assert.match(path, /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/);
  assert.ok(path.split('/').every(part => part !== '.' && part !== '..'));
}

export async function buildDirectory(files, { profile: profileId = 'short' } = {}) {
  const profile = fixtureProfile(profileId);
  assert.ok(files.length > 0 && files.length <= profile.maxFiles, 'Invalid fixture file count');
  const paths = new Set();
  let size = 0;
  for (const file of files) {
    validPath(file.path);
    assert.ok(!paths.has(file.path), 'Duplicate file path');
    paths.add(file.path);
    assert.ok(file.bytes instanceof Uint8Array && file.bytes.length > 0);
    size += file.bytes.length;
  }
  assert.ok(size <= profile.graphMaxBytes, 'Fixture exceeds graph budget');
  const blocks = new Map();
  const store = {
    async put(cid, bytes) {
      await verifyBlock(cid, bytes);
      assert.ok(blocks.has(cid.toString()) || blocks.size < MAX_BLOCKS, 'Graph exceeds block budget');
      blocks.set(cid.toString(), new Uint8Array(bytes));
      return cid;
    }
  };
  let root;
  for await (const entry of importer(
    [...files].sort((a, b) => a.path.localeCompare(b.path)).map(file => ({ path: file.path, content: file.bytes })),
    store,
    {
      cidVersion: 1,
      rawLeaves: true,
      wrapWithDirectory: true,
      chunker: fixedSize({ chunkSize: 256 * 1024 })
    }
  ))
    root = entry.cid;
  assert.ok(root && blocks.has(root.toString()), 'Directory root missing');
  // DFS gives children-before-parent writes and makes root publication last.
  const ordered = [];
  const seen = new Set();
  function visit(cid) {
    const id = cid.toString();
    if (seen.has(id)) return;
    seen.add(id);
    const bytes = blocks.get(id);
    assert.ok(bytes, 'Missing graph dependency');
    if (cid.code === dagPB.code) for (const link of dagPB.decode(bytes).Links) visit(link.Hash);
    ordered.push({ cid: id, bytes, codec: cid.code });
  }
  visit(root);
  assert.equal(seen.size, blocks.size, 'Unreachable graph blocks');
  return { root: root.toString(), blocks: ordered, bytes: ordered.reduce((sum, block) => sum + block.bytes.length, 0) };
}

export async function verifyGraph(graph, { profile: profileId = 'short' } = {}) {
  const profile = fixtureProfile(profileId);
  assert.ok(Array.isArray(graph.blocks) && graph.blocks.length > 0 && graph.blocks.length <= MAX_BLOCKS, 'Invalid graph block count');
  assert.equal(graph.blocks.at(-1).cid, graph.root, 'Directory root must be published last');
  const byId = new Map();
  let bytes = 0;
  for (const block of graph.blocks) {
    const cid = await verifyBlock(block.cid, block.bytes);
    assert.ok(!byId.has(block.cid), 'Duplicate graph block');
    assert.equal(cid.code, block.codec, 'Wrong block codec');
    if (cid.code === dagPB.code)
      for (const link of dagPB.decode(block.bytes).Links) assert.ok(byId.has(link.Hash.toString()), 'Graph dependency missing or ordered after its parent');
    byId.set(block.cid, block);
    bytes += block.bytes.length;
  }
  assert.equal(bytes, graph.bytes, 'Graph byte accounting mismatch');
  assert.ok(bytes <= profile.graphMaxBytes + MAX_BLOCK_BYTES, 'Graph exceeds byte budget');
  const root = dagPB.decode(byId.get(graph.root).bytes);
  assert.equal(UnixFS.unmarshal(root.Data).type, 'directory', 'Graph root is not a directory');
  const reachable = new Set();
  function visit(cid) {
    if (reachable.has(cid)) return;
    reachable.add(cid);
    const block = byId.get(cid);
    if (block.codec === dagPB.code) for (const link of dagPB.decode(block.bytes).Links) visit(link.Hash.toString());
  }
  visit(graph.root);
  assert.equal(reachable.size, graph.blocks.length, 'Graph contains unreachable blocks');
}
