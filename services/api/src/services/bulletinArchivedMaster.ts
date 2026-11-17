// Recovery-only constant path. Deliberately separate from ordinary media reads.
import assert from 'node:assert/strict';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { verifyBulletinBlock, BULLETIN_BLOCK_COUNT_MAX } from './bulletinGraph.js';

export async function readArchivedBulletinMaster(options: {
  root: string;
  encryptedLength: number;
  readBlock: (cid: string, signal: AbortSignal) => Promise<Uint8Array>;
  signal: AbortSignal;
}): Promise<Buffer> {
  const { root, encryptedLength: maximum, signal } = options;
  signal.throwIfAborted();
  assert.ok(Number.isSafeInteger(maximum) && maximum > 16 && maximum <= 50 * 1024 * 1024 + 16, 'Invalid archived master bound');
  let reads = 0,
    fetched = 0;
  const get = async (cid: CID) => {
    signal.throwIfAborted();
    assert.ok(++reads <= BULLETIN_BLOCK_COUNT_MAX, 'Archived master read bound exceeded');
    const bytes = await options.readBlock(cid.toString(), signal);
    signal.throwIfAborted();
    verifyBulletinBlock(cid.toString(), bytes);
    fetched += bytes.length;
    assert.ok(fetched <= maximum + 64 * 1024, 'Archived master byte bound exceeded');
    return bytes;
  };
  let cid = CID.parse(root);
  for (const part of ['archive', 'master.bin']) {
    assert.equal(cid.code, dagPB.code, 'Archived master path crosses raw data');
    const node = dagPB.decode(await get(cid));
    assert.ok(node.Data && UnixFS.unmarshal(node.Data).type === 'directory', 'Archived master path crosses a file');
    const links = node.Links.filter(link => link.Name === part);
    assert.equal(links.length, 1, 'Archived master path missing or ambiguous');
    cid = links[0].Hash;
  }
  // One pre-sized buffer avoids recursively concatenating a large original.
  const output = Buffer.alloc(maximum);
  let offset = 0;
  const append = (bytes: Uint8Array) => {
    assert.ok(bytes.length <= maximum - offset, 'Archived master exceeds expected length');
    output.set(bytes, offset);
    offset += bytes.length;
  };
  const visit = async (id: CID, depth = 0): Promise<void> => {
    assert.ok(depth <= 8, 'Archived master depth exceeded');
    const start = offset,
      bytes = await get(id);
    if (id.code === 0x55) {
      append(bytes);
      return;
    }
    const node = dagPB.decode(bytes);
    assert.ok(node.Data, 'Archived master UnixFS data missing');
    const unix = UnixFS.unmarshal(node.Data);
    assert.equal(unix.type, 'file', 'Archived master is not a file');
    assert.ok(unix.fileSize() <= BigInt(maximum - offset), 'Archived master declared size exceeds bound');
    append(unix.data ?? new Uint8Array());
    for (const link of node.Links) {
      assert.ok(!link.Name, 'Named archived master chunk');
      await visit(link.Hash, depth + 1);
    }
    assert.equal(BigInt(offset - start), unix.fileSize(), 'Archived master file size mismatch');
  };
  try {
    await visit(cid);
    assert.equal(offset, maximum, 'Archived master length differs from manifest');
    return output;
  } catch (error) {
    output.fill(0);
    throw error;
  }
}
