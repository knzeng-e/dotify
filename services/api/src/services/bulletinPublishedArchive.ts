// Separate published-data backup. No custody state, key, signer or transport imports.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { CID } from 'multiformats/cid';
import * as dagPB from '@ipld/dag-pb';
import { UnixFS } from 'ipfs-unixfs';
import { BULLETIN_BLOCK_COUNT_MAX, BULLETIN_BLOCK_MAX, BULLETIN_GRAPH_MAX, verifyBulletinBlock } from './bulletinGraph.js';
import { canonicalCheckpointDirectory, checkpointCiphertext, checkpointHash, checkpointMetadata } from './bulletinCheckpointFiles.js';
import { sync } from './bulletinMediaState.js';

type ReadBlock = (cid: string, signal: AbortSignal) => Promise<Uint8Array>;
const rowSchema = z
  .object({ cid: z.string().max(128), bytes: z.number().int().min(1).max(BULLETIN_BLOCK_MAX), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
const archiveSchema = z
  .object({
    schema: z.literal('dotify.bulletin.published-archive.v1'),
    root: z.string().max(128),
    createdAt: z.string().datetime(),
    blocks: z.array(rowSchema).min(1).max(BULLETIN_BLOCK_COUNT_MAX),
    writerActivationAllowed: z.literal(false),
    contentKeysLoaded: z.literal(false)
  })
  .strict();
type Row = z.infer<typeof rowSchema>;
const MARKER = '.incomplete';
function checkedCid(value: string) {
  const cid = CID.parse(value);
  assert.ok(
    cid.version === 1 && [0x55, dagPB.code].includes(cid.code) && cid.multihash.code === 0xb220 && cid.multihash.digest.length === 32,
    'Unsupported archive CID'
  );
  assert.equal(cid.toString(), value, 'Noncanonical archive CID');
  return cid;
}
async function exists(file: string) {
  try {
    await lstat(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
async function names(directory: string, maximum: number) {
  const handle = await opendir(directory);
  const result: string[] = [];
  try {
    for (;;) {
      const entry = await handle.read();
      if (!entry) break;
      assert.ok(result.length < maximum, 'Archive directory exceeds entry bound');
      result.push(entry.name);
    }
  } finally {
    await handle.close();
  }
  return result.sort();
}
async function writeNew(file: string, bytes: Uint8Array) {
  const f = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await f.writeFile(bytes);
    await f.sync();
  } finally {
    await f.close();
  }
}
async function observedRead(read: ReadBlock, cid: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let abort = () => {};
  try {
    const bytes = await Promise.race([
      read(cid, signal),
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      })
    ]);
    signal.throwIfAborted();
    assert.ok(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= BULLETIN_BLOCK_MAX, 'Invalid archive block size');
    return Buffer.from(bytes);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
async function graph(root: string, read: ReadBlock, signal: AbortSignal, consume?: (row: Row, bytes: Buffer) => Promise<void>) {
  assert.equal(checkedCid(root).code, dagPB.code, 'Archive root must be a directory');
  const discovered = new Set([root]);
  const visited = new Map<string, Row>(),
    visiting = new Set<string>();
  let total = 0;
  async function visit(id: string, depth: number) {
    signal.throwIfAborted();
    assert.ok(depth <= 8, 'Archive graph exceeds depth bound');
    if (visited.has(id)) return;
    assert.ok(!visiting.has(id) && visited.size + visiting.size < BULLETIN_BLOCK_COUNT_MAX, 'Archive graph exceeds block bound');
    const cid = checkedCid(id);
    visiting.add(id);
    const bytes = await observedRead(read, id, signal);
    verifyBulletinBlock(id, bytes);
    total += bytes.length;
    assert.ok(Number.isSafeInteger(total) && total <= BULLETIN_GRAPH_MAX, 'Archive graph exceeds byte bound');
    const row = { cid: id, bytes: bytes.length, sha256: checkpointHash(bytes) };
    if (consume) await consume(row, bytes);
    if (cid.code === dagPB.code) {
      const node = dagPB.decode(bytes);
      assert.ok(node.Data, 'Archive UnixFS data missing');
      const unix = UnixFS.unmarshal(node.Data);
      assert.ok(['directory', 'file'].includes(unix.type), 'Unsupported archive UnixFS type');
      if (depth === 0) assert.equal(unix.type, 'directory', 'Archive root must be a directory');
      if (unix.type === 'directory') {
        assert.equal(new Set(node.Links.map(link => link.Name)).size, node.Links.length, 'Duplicate archive directory name');
        for (const link of node.Links) assert.ok(link.Name && /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(link.Name), 'Unsafe archive directory name');
      } else for (const link of node.Links) assert.ok(!link.Name, 'Named archive file chunk');
      // Count distinct references before doing avoidable RPC/disk work on a wide DAG.
      for (const link of node.Links) {
        const child = link.Hash.toString();
        checkedCid(child);
        discovered.add(child);
        assert.ok(discovered.size <= BULLETIN_BLOCK_COUNT_MAX, 'Archive graph exceeds block bound');
      }
      for (const link of node.Links) await visit(link.Hash.toString(), depth + 1);
    }
    visiting.delete(id);
    visited.set(id, row);
  }
  await visit(root, 0);
  return { blocks: [...visited.values()].sort((a, b) => (a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0)), totalBytes: total };
}
const report = (digest: string, blocks: number, bytes: number) => ({
  schema: 'dotify.bulletin.published-archive-report.v1',
  manifestSha256: digest,
  blocks,
  totalBytes: bytes,
  completeReachableGraphVerified: true,
  ciphertextAuthenticated: false,
  canonicalHistoryChecked: false,
  independentStorageVerified: false,
  keyBackupOriginVerified: false,
  writerActivationAllowed: false,
  contentKeysLoaded: false,
  networkWrites: 0
});

/** Capture is explicit/injected. There is no implicit network source or repair. */
export async function capturePublishedBulletinArchive(options: { root: string; destination: string; readBlock: ReadBlock; signal: AbortSignal }) {
  const { root, destination, readBlock } = options;
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(360_000)]);
  signal.throwIfAborted();
  checkedCid(root);
  assert.ok(isAbsolute(destination) && resolve(destination) === destination, 'Canonical archive destination required');
  await canonicalCheckpointDirectory(dirname(destination));
  await mkdir(destination, { mode: 0o700 }); // Exclusive: never overwrite or clean an existing destination.
  await writeNew(join(destination, MARKER), Buffer.from('Incomplete published graph archive\n'));
  try {
    const objects = join(destination, 'objects');
    await mkdir(objects, { mode: 0o700 });
    const written = new Set<string>();
    const captured = await graph(root, readBlock, signal, async (row, bytes) => {
      signal.throwIfAborted();
      if (!written.has(row.sha256)) {
        await writeNew(join(objects, row.sha256 + '.bin'), bytes);
        written.add(row.sha256);
      }
    });
    const manifest = archiveSchema.parse({
      schema: 'dotify.bulletin.published-archive.v1',
      root,
      createdAt: new Date().toISOString(),
      blocks: captured.blocks,
      writerActivationAllowed: false,
      contentKeysLoaded: false
    });
    const bytes = Buffer.from(JSON.stringify(manifest)),
      digest = checkpointHash(bytes);
    assert.ok(bytes.length <= 1024 * 1024, 'Archive manifest exceeds byte bound');
    await writeNew(join(destination, 'archive.json.tmp'), bytes);
    signal.throwIfAborted();
    await sync(objects);
    await rename(join(destination, 'archive.json.tmp'), join(destination, 'archive.json'));
    await sync(destination);
    await rm(join(destination, MARKER));
    await sync(destination);
    return await verifyPublishedBulletinArchive(destination, digest, signal);
  } catch (error) {
    // Preserve partial data for inspection, but never expose it as a committed backup.
    if (!(await exists(join(destination, MARKER)))) await writeNew(join(destination, MARKER), Buffer.from('Incomplete published graph archive\n'));
    throw error;
  }
}

/** Offline verification follows only the trusted manifest, never saved paths. */
export async function verifyPublishedBulletinArchive(directory: string, expectedManifestSha256: string, owner: AbortSignal) {
  const signal = AbortSignal.any([owner, AbortSignal.timeout(360_000)]);
  signal.throwIfAborted();
  assert.match(expectedManifestSha256, /^[a-f0-9]{64}$/);
  await canonicalCheckpointDirectory(directory);
  assert.deepEqual(await names(directory, 4), ['archive.json', 'objects'], 'Incomplete or unexpected archive files');
  const raw = await checkpointMetadata(join(directory, 'archive.json'), 1024 * 1024, signal);
  assert.equal(checkpointHash(raw), expectedManifestSha256, 'Published archive manifest changed');
  const manifest = archiveSchema.parse(JSON.parse(raw.toString('utf8')));
  assert.equal(new Set(manifest.blocks.map(b => b.cid)).size, manifest.blocks.length, 'Duplicate archive block');
  const objects = join(directory, 'objects');
  await canonicalCheckpointDirectory(objects);
  const files = [...new Set(manifest.blocks.map(b => b.sha256 + '.bin'))].sort();
  assert.deepEqual(await names(objects, BULLETIN_BLOCK_COUNT_MAX + 1), files, 'Missing or unexpected archive blocks');
  const byCid = new Map(manifest.blocks.map(row => [row.cid, row]));
  const verified = await graph(
    manifest.root,
    async (cid, readSignal) => {
      const row = byCid.get(cid);
      assert.ok(row, 'Missing reachable archive block');
      return checkpointCiphertext(join(objects, row.sha256 + '.bin'), row, readSignal);
    },
    signal
  );
  assert.deepEqual(verified.blocks, manifest.blocks, 'Unreachable or changed archive graph');
  assert.equal(
    checkpointHash(await checkpointMetadata(join(directory, 'archive.json'), 1024 * 1024, signal)),
    expectedManifestSha256,
    'Archive manifest changed during verification'
  );
  assert.deepEqual(await names(directory, 4), ['archive.json', 'objects']);
  assert.deepEqual(await names(objects, BULLETIN_BLOCK_COUNT_MAX + 1), files);
  return report(expectedManifestSha256, verified.blocks.length, verified.totalBytes);
}

/** Offline consumers get only verified CID-addressed bytes, never saved paths.
 * Recheck the full artifact after consumption, before exposing its result. */
export async function withVerifiedPublishedBulletinArchive<T>(
  directory: string,
  expectedManifestSha256: string,
  signal: AbortSignal,
  consume: (archive: { root: string; readBlock: ReadBlock }) => Promise<T>
): Promise<T> {
  await verifyPublishedBulletinArchive(directory, expectedManifestSha256, signal);
  const bytes = await checkpointMetadata(join(directory, 'archive.json'), 1024 * 1024, signal);
  assert.equal(checkpointHash(bytes), expectedManifestSha256, 'Archive manifest changed before consumption');
  const manifest = archiveSchema.parse(JSON.parse(bytes.toString('utf8')));
  const byCid = new Map(manifest.blocks.map(row => [row.cid, row]));
  const result = await consume({
    root: manifest.root,
    readBlock: async (cid, owner) => {
      const readSignal = AbortSignal.any([signal, owner]);
      readSignal.throwIfAborted();
      const row = byCid.get(cid);
      assert.ok(row, 'Missing archived block');
      await canonicalCheckpointDirectory(directory);
      await canonicalCheckpointDirectory(join(directory, 'objects'));
      const block = await checkpointCiphertext(join(directory, 'objects', row.sha256 + '.bin'), row, readSignal);
      verifyBulletinBlock(cid, block);
      return block;
    }
  });
  await verifyPublishedBulletinArchive(directory, expectedManifestSha256, signal);
  return result;
}
