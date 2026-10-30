// Shared Node/Host reader: no Buffer, Node builtins, signer or gateway fallback.
import { CID } from 'multiformats/cid';
import { hashBytes, runtimeHashName } from './hashes.mjs';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
export const MAX_BLOCK_BYTES = 512 * 1024;
const assert = {
  ok(value, message = 'Invalid directory data') {
    if (!value) throw new Error(message);
  },
  equal(a, b, message = 'Directory data mismatch') {
    if (a !== b) throw new Error(message);
  },
  match(value, expression) {
    if (!expression.test(value)) throw new Error('Invalid path');
  }
};
function concatenate(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function validPath(path) {
  assert.equal(typeof path, 'string');
  assert.ok(path.length > 0 && path.length <= 160 && path.split('/').length <= 8, 'Invalid path budget');
  assert.match(path, /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/);
  assert.ok(path.split('/').every(part => part !== '.' && part !== '..'));
}

export async function verifyBlock(cidInput, bytes) {
  const cid = CID.parse(String(cidInput));
  assert.ok(cid.code === 0x55 || cid.code === dagPB.code, 'Only raw/DAG-PB blocks are admitted');
  runtimeHashName(cid.multihash.code);
  assert.equal(cid.multihash.digest.length, 32, 'Expected a 256-bit content hash');
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= MAX_BLOCK_BYTES, 'Invalid block byte budget');
  const expected = CID.create(cid.version, cid.code, await hashBytes(cid.multihash.code, bytes));
  assert.ok(cid.equals(expected), 'Block CID does not match its bytes');
  return cid;
}

/** Resolve named directories, then fetch only this file's dependencies. */
export async function readPath(readBlock, root, path, { maxBytes = 1024 * 1024, maxReads = 64 } = {}) {
  validPath(path);
  let reads = 0;
  let fetched = 0;
  const get = async cid => {
    assert.ok(++reads <= maxReads, 'Read exceeds block budget');
    const bytes = await readBlock(String(cid));
    await verifyBlock(cid, bytes);
    fetched += bytes.length;
    assert.ok(fetched <= maxBytes, 'Read exceeds byte budget');
    return bytes;
  };
  let cid = CID.parse(root);
  for (const part of path.split('/')) {
    assert.equal(cid.code, dagPB.code, 'Path crosses a raw file');
    const node = dagPB.decode(await get(cid));
    assert.equal(UnixFS.unmarshal(node.Data).type, 'directory', 'Path crosses a non-directory');
    const link = node.Links.find(link => link.Name === part);
    assert.ok(link, 'File path not found');
    cid = link.Hash;
  }
  const file = async (id, depth = 0) => {
    assert.ok(depth <= 8, 'File exceeds depth budget');
    const bytes = await get(id);
    if (id.code === 0x55) return bytes;
    const node = dagPB.decode(bytes);
    const unix = UnixFS.unmarshal(node.Data);
    assert.equal(unix.type, 'file', 'Expected a UnixFS file');
    const chunks = [unix.data ?? new Uint8Array()];
    for (const link of node.Links) chunks.push(await file(link.Hash, depth + 1));
    const result = concatenate(chunks);
    assert.equal(BigInt(result.length), unix.fileSize(), 'UnixFS file size mismatch');
    return result;
  };
  return { bytes: await file(cid), reads, fetchedBytes: fetched };
}

/** Pinned Product SDK 0.39 supports raw CID bytes via noReassemble. */
export function hostBlockReader(cloud, { lookupTimeoutMs = 10_000 } = {}) {
  assert.ok(Number.isSafeInteger(lookupTimeoutMs) && lookupTimeoutMs >= 1000 && lookupTimeoutMs <= 30_000, 'Invalid Host lookup bound');
  return async cid => {
    const result = await cloud.fetchBytes(cid, { noReassemble: true, lookupTimeoutMs });
    if (!result.ok) {
      const error = new Error('Host could not retrieve the requested block');
      error.name = result.error?.name ?? 'HostBlockReadError';
      error.message += result.error?.message ? `: ${String(result.error.message).slice(0, 300)}` : '';
      throw error;
    }
    await verifyBlock(cid, result.value);
    return result.value;
  };
}
