// Bounded private-file I/O for data-only checkpoints. No vault, signer or RPC.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath, readdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { privateDirectory } from './bulletinMediaState.js';

export const CHECKPOINT_MAX_FILES = 8192;
export const CHECKPOINT_MAX_BYTES = 1024 * 1024 * 1024;
export const checkpointHash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export type CheckpointEntry = { path: string; bytes: number; sha256: string };
export const uuidPath = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const nonce = 'queue/nonces';
export function checkpointPath(path: string, directory: boolean) {
  if (directory)
    return (
      ['queue', 'publisher', 'queue/jobs', 'queue/incoming', nonce, 'queue/recoveries'].includes(path) ||
      new RegExp(`^queue/jobs/${uuidPath}(?:/output(?:/(?:archive|96|160|320))?)?$`).test(path) ||
      /^queue\/nonces\/[0-9a-f]{64}$/.test(path)
    );
  return (
    /^(profile\.json|queue\/(jobs|publication-store)\.json|queue\/nonces\/ledger\.json)$/.test(path) ||
    /^queue\/nonces\/[0-9a-f]{64}\/[0-9a-f]{16}\.json$/.test(path) ||
    new RegExp(
      `^queue/jobs/${uuidPath}/(?:job\\.json|source\\.bin|output/(?:manifest\\.json|archive/master\\.bin|(?:96|160|320)/(?:init|segment-(?:[01][0-9]{2}|2[0-4][0-9]|25[0-5]))\\.bin))$`
    ).test(path) ||
    new RegExp(`^queue/recoveries/prepared-recovery-${uuidPath}\\.json$`).test(path) ||
    /^(publisher\/(?:owner|publisher|release-admission)\.json|publisher\/admission-before-[0-9a-f]{64}\.json|publisher\/public-metadata-[0-9a-f]{64}\.json)$/.test(
      path
    ) ||
    new RegExp(`^publisher/stream-${uuidPath}\\.json$`).test(path)
  );
}
export async function canonicalCheckpointDirectory(path: string) {
  assert.ok(isAbsolute(path) && resolve(path) === path, 'Canonical absolute directory required');
  assert.equal(await realpath(path), path, 'Directory aliases are not checkpoint roots');
  await privateDirectory(path);
  return path;
}
export async function checkpointFile(path: string, output?: string, signal?: AbortSignal): Promise<Omit<CheckpointEntry, 'path'>> {
  signal?.throwIfAborted();
  const input = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let target: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const before = await input.stat();
    const maximum = path.endsWith('.json') ? 2 * 1024 * 1024 : 50 * 1024 * 1024 + 16;
    assert.ok(before.isFile() && before.nlink === 1 && before.uid === process.getuid?.() && !(before.mode & 0o077), 'Unsafe checkpoint file');
    assert.ok(before.size > 0 && before.size <= maximum, 'Checkpoint file exceeds bound');
    if (output) target = await open(output, 'wx', 0o600);
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    let bytes = 0;
    for (;;) {
      signal?.throwIfAborted();
      const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, maximum + 1 - bytes), bytes);
      if (!bytesRead) break;
      bytes += bytesRead;
      assert.ok(bytes <= before.size, 'Checkpoint file grew while reading');
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      if (target) {
        let written = 0;
        while (written < bytesRead) {
          const result = await target.write(chunk, written, bytesRead - written);
          assert.ok(result.bytesWritten > 0);
          written += result.bytesWritten;
        }
      }
    }
    const after = await input.stat();
    assert.equal(bytes, before.size);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink', 'mode', 'uid', 'gid'] as const)
      assert.equal(after[key], before[key], 'Checkpoint file changed while reading');
    await target?.sync();
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    await target?.close();
    await input.close();
  }
}
/** Read bounded metadata once, without reopening a path between digest and parse. */
export async function checkpointMetadata(path: string, maximum: number, signal: AbortSignal) {
  assert.ok(maximum > 0 && maximum <= 4 * 1024 * 1024);
  return checkpointBytes(path, maximum, signal);
}
/** Read one retained encrypted object, matching the trusted plan on these bytes. */
export async function checkpointCiphertext(path: string, expected: Omit<CheckpointEntry, 'path'>, signal: AbortSignal) {
  assert.ok(expected.bytes > 0 && expected.bytes <= 50 * 1024 * 1024 + 16);
  const bytes = await checkpointBytes(path, expected.bytes, signal);
  assert.equal(bytes.length, expected.bytes, 'Ciphertext size differs from checkpoint');
  assert.equal(checkpointHash(bytes), expected.sha256, 'Ciphertext differs from checkpoint');
  return bytes;
}
async function checkpointBytes(path: string, maximum: number, signal: AbortSignal) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    assert.ok(before.isFile() && before.nlink === 1 && before.uid === process.getuid?.() && !(before.mode & 0o077), 'Unsafe checkpoint metadata');
    assert.ok(before.size > 0 && before.size <= maximum, 'Checkpoint metadata exceeds bound');
    const data = Buffer.alloc(before.size + 1);
    let size = 0;
    for (;;) {
      signal.throwIfAborted();
      const result = await file.read(data, size, data.length - size, size);
      if (!result.bytesRead) break;
      size += result.bytesRead;
      assert.ok(size <= before.size, 'Checkpoint metadata grew');
    }
    const after = await file.stat();
    assert.equal(size, before.size);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink', 'mode', 'uid', 'gid'] as const)
      assert.equal(after[key], before[key], 'Checkpoint metadata changed');
    return data.subarray(0, size);
  } finally {
    await file.close();
  }
}
export async function checkpointTree(root: string, prefix: 'queue' | 'publisher', signal: AbortSignal, budget = { files: 0, directories: 0, bytes: 0 }) {
  const files: CheckpointEntry[] = [];
  const directories: string[] = [];
  const visit = async (directory: string, relative: string) => {
    signal.throwIfAborted();
    assert.ok(checkpointPath(relative, true) && budget.directories < CHECKPOINT_MAX_FILES, 'Unexpected checkpoint directory');
    await canonicalCheckpointDirectory(directory);
    budget.directories++;
    directories.push(relative);
    const entries = await readdir(directory, { withFileTypes: true });
    assert.ok(entries.length <= CHECKPOINT_MAX_FILES, 'Checkpoint directory exceeds bound');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${relative}/${entry.name}`;
      // Only the exclusive lease held by this inspector is omitted.
      if (path === 'publisher/publisher.lock') continue;
      assert.ok(!entry.isSymbolicLink(), 'Checkpoint refuses links');
      if (entry.isDirectory()) await visit(join(directory, entry.name), path);
      else {
        assert.ok(entry.isFile() && checkpointPath(path, false) && budget.files < CHECKPOINT_MAX_FILES, 'Unexpected checkpoint file');
        budget.files++;
        const data = await checkpointFile(join(directory, entry.name), undefined, signal);
        budget.bytes += data.bytes;
        assert.ok(budget.bytes <= CHECKPOINT_MAX_BYTES, 'Checkpoint exceeds total byte bound');
        files.push({ path, ...data });
      }
    }
  };
  await visit(root, prefix);
  return { files, directories };
}
