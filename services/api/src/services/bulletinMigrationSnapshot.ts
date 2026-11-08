// Bounded private snapshot IO. No recursive cp (which could follow a link),
// secret discovery, network, or in-place restore. Sources must already be frozen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { privateDirectory, sync } from './bulletinMediaState.js';
export type SnapshotEntry = { path: string; bytes: number; sha256: string | null };
const MAX_FILES = 8192,
  MAX_BYTES = 2 * 1024 ** 3,
  MAX_FILE = 220 * 1024 ** 2;
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export async function canonicalPrivate(directory: string) {
  assert.ok(isAbsolute(directory) && resolve(directory) === directory && (await realpath(directory)) === directory, 'Canonical absolute private path required');
  await privateDirectory(directory);
}
export async function privateSnapshotBytes(file: string) {
  assert.equal(await realpath(file), resolve(file), 'Snapshot link refused');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    assert.ok(
      stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid?.() && !(stat.mode & 0o077) && stat.size <= MAX_FILE,
      'Invalid private snapshot file'
    );
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    assert.ok(
      offset === stat.size && after.size === stat.size && after.mtimeMs === stat.mtimeMs && after.ctimeMs === stat.ctimeMs,
      'Snapshot changed during read'
    );
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}
export async function snapshotTree(directory: string): Promise<SnapshotEntry[]> {
  await canonicalPrivate(directory);
  const entries: SnapshotEntry[] = [];
  let bytes = 0;
  const walk = async (relative: string, depth: number) => {
    assert.ok(depth <= 12, 'Snapshot nesting bound exceeded');
    const folder = join(directory, relative);
    await canonicalPrivate(folder);
    for (const name of (await readdir(folder)).sort()) {
      assert.ok(!name.endsWith('.lock') && !name.endsWith('.tmp'), 'Snapshot has live/crash lock or unfinished write');
      const path = relative ? `${relative}/${name}` : name;
      const stat = await lstat(join(directory, path));
      assert.ok(!stat.isSymbolicLink(), 'Snapshot link refused');
      assert.ok(entries.length < MAX_FILES, 'Snapshot file bound exceeded');
      if (stat.isDirectory()) {
        entries.push({ path, bytes: 0, sha256: null });
        await walk(path, depth + 1);
      } else {
        const content = await privateSnapshotBytes(join(directory, path));
        bytes += content.length;
        assert.ok(bytes <= MAX_BYTES, 'Snapshot byte bound exceeded');
        entries.push({ path, bytes: content.length, sha256: sha256(content) });
      }
    }
  };
  await walk('', 0);
  return entries;
}
export async function exclusiveBytes(file: string, bytes: Uint8Array) {
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await sync(dirname(file));
}
export async function copySnapshot(source: string, destination: string, entries: SnapshotEntry[]) {
  await mkdir(destination, { mode: 0o700 });
  for (const entry of entries) {
    if (entry.sha256 === null) await mkdir(join(destination, entry.path), { mode: 0o700 });
    else {
      const bytes = await privateSnapshotBytes(join(source, entry.path));
      assert.equal(bytes.length, entry.bytes, 'Snapshot changed');
      assert.equal(sha256(bytes), entry.sha256, 'Snapshot changed');
      await exclusiveBytes(join(destination, entry.path), bytes);
    }
  }
  for (const entry of [...entries].reverse()) if (entry.sha256 === null) await sync(join(destination, entry.path));
  await sync(destination);
  await sync(dirname(destination));
}
