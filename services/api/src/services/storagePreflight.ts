import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

type StorageLocation = { name: string; path: string };

/** Run before importing services that load persisted trust state. Never reset it. */
export async function verifyApiStorage(locations: readonly StorageLocation[]): Promise<void> {
  const checkedDirectories = new Set<string>();
  for (const location of locations) {
    try {
      const target = resolve(location.path);
      const directory = dirname(target);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const directoryInfo = await lstat(directory);
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error('UNSAFE_DIRECTORY');
      try {
        const before = await lstat(target);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) throw new Error('UNSAFE_FILE');
        const file = await open(target, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = await file.stat();
          if (!info.isFile() || info.nlink !== 1 || info.dev !== before.dev || info.ino !== before.ino) throw new Error('UNSAFE_FILE');
        } finally {
          await file.close();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (checkedDirectories.has(directory)) continue;
      const temporary = join(directory, `.dotify-storage-probe-${randomUUID()}`);
      const renamed = `${temporary}.ready`;
      try {
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile('storage-probe');
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, renamed);
      } finally {
        await rm(temporary, { force: true });
        await rm(renamed, { force: true });
      }
      checkedDirectories.add(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? 'UNSAFE_STORAGE';
      throw new Error(
        `API storage preflight failed for ${location.name} (${code}). Prepare the configured storage before starting; persisted state was not reset.`
      );
    }
  }
}
