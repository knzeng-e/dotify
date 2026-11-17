import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const API_STORAGE_UID = 1000;
export const API_STORAGE_GID = 1000;
const knownFile = /^(?:catalog\.json|receipts\.json|session-revocations\.json)(?:\.(?:[0-9]+\.)?[0-9a-f-]{36}\.tmp)?$/;
const MAX_FILES = 256;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

type Entry = { name: string; bytes: number; sha256: string; uid: number; gid: number; mode: number };
export type StorageInventory = {
  schema: 'dotify.api-storage-ownership.v1';
  fingerprint: string;
  directory: { uid: number; gid: number; mode: number };
  files: Entry[];
};

async function checkedDirectory(directory: string): Promise<FileHandle> {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Storage root must be a real directory');
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const opened = await handle.stat();
  if (opened.dev !== info.dev || opened.ino !== info.ino) {
    await handle.close();
    throw new Error('Storage directory changed during inspection');
  }
  return handle;
}

async function inspectFile(name: string, handle: FileHandle): Promise<Entry> {
  const before = await handle.stat();
  if (!before.isFile() || before.nlink !== 1 || before.size > MAX_FILE_BYTES) throw new Error('Unsafe or oversized storage file');
  const digest = createHash('sha256');
  for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) digest.update(chunk);
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
    throw new Error('Storage changed during inspection; stop the writer first');
  }
  return { name, bytes: before.size, sha256: digest.digest('hex'), uid: before.uid, gid: before.gid, mode: before.mode & 0o7777 };
}

async function fileNames(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  if (entries.length > MAX_FILES + 1) throw new Error('Storage inventory exceeds the maintenance bound');
  const names: string[] = [];
  for (const name of entries.sort()) {
    const info = await lstat(join(directory, name));
    // The volume's filesystem directory belongs to the filesystem, not the API.
    if (name === 'lost+found' && info.isDirectory() && !info.isSymbolicLink()) continue;
    if (!knownFile.test(name) || !info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
      throw new Error('Unsupported storage entry; review the offline inventory instead of changing it recursively');
    }
    if (names.length >= MAX_FILES) throw new Error('Storage inventory exceeds the maintenance bound');
    names.push(name);
  }
  return names;
}

export async function inspectApiStorage(directory: string): Promise<StorageInventory> {
  const root = resolve(directory);
  const handle = await checkedDirectory(root);
  try {
    const info = await handle.stat();
    const files: Entry[] = [];
    for (const name of await fileNames(root)) {
      const file = await open(join(root, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        files.push(await inspectFile(name, file));
      } finally {
        await file.close();
      }
    }
    // Ownership/mode are excluded, so a partially applied operation is safely resumable.
    const content = files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }));
    return {
      schema: 'dotify.api-storage-ownership.v1',
      fingerprint: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
      directory: { uid: info.uid, gid: info.gid, mode: info.mode & 0o7777 },
      files
    };
  } finally {
    await handle.close();
  }
}

/** Offline maintenance only: no API process may share this mounted volume. */
export async function prepareApiStorage(directory: string, expectedFingerprint: string): Promise<StorageInventory> {
  if (process.getuid?.() !== 0) throw new Error('Ownership maintenance requires an explicitly selected root maintenance process');
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) throw new Error('A reviewed inventory fingerprint is required');
  const root = resolve(directory);
  const before = await inspectApiStorage(root);
  if (before.fingerprint !== expectedFingerprint) throw new Error('Storage fingerprint changed; no ownership was modified');
  const directoryHandle = await checkedDirectory(root);
  const files: FileHandle[] = [];
  try {
    // Validate and hold every descriptor before the first ownership mutation.
    for (const entry of before.files) {
      const file = await open(join(root, entry.name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      files.push(file);
      const current = await inspectFile(entry.name, file);
      if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) throw new Error('Storage changed; no ownership was modified');
    }
    if (JSON.stringify(await fileNames(root)) !== JSON.stringify(before.files.map(file => file.name))) {
      throw new Error('Storage inventory changed; no ownership was modified');
    }
    for (const file of files) {
      await file.chown(API_STORAGE_UID, API_STORAGE_GID);
      await file.chmod(0o600);
      await file.sync();
    }
    await directoryHandle.chown(API_STORAGE_UID, API_STORAGE_GID);
    await directoryHandle.chmod(0o700);
    await directoryHandle.sync();
  } finally {
    await Promise.all(files.map(file => file.close()));
    await directoryHandle.close();
  }
  const after = await inspectApiStorage(root);
  if (after.fingerprint !== before.fingerprint) throw new Error('Post-maintenance content verification failed; keep the API stopped');
  if (
    after.directory.uid !== API_STORAGE_UID ||
    after.directory.gid !== API_STORAGE_GID ||
    after.directory.mode !== 0o700 ||
    after.files.some(file => file.uid !== API_STORAGE_UID || file.gid !== API_STORAGE_GID || file.mode !== 0o600)
  )
    throw new Error('Post-maintenance ownership verification failed; keep the API stopped');
  return after;
}
