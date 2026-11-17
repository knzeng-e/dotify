import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chmod, link, mkdir, mkdtemp, open, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyApiStorage } from './storagePreflight.js';
import { inspectApiStorage, prepareApiStorage } from './storageOwnership.js';

async function withStorage(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'dotify-storage-test-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('API storage startup and offline ownership', () => {
  it('checks atomic writes without creating or replacing persisted state', async () => {
    await withStorage(async directory => {
      const target = join(directory, 'catalog.json');
      const content = '{"synthetic":"preserve me"}\n';
      await writeFile(target, content, { mode: 0o600 });
      await verifyApiStorage([
        { name: 'catalog', path: target },
        { name: 'receipts', path: join(directory, 'receipts.json') }
      ]);
      assert.equal(await readFile(target, 'utf8'), content);
      assert.deepEqual(await readdir(directory), ['catalog.json']);
    });
  });

  it('can prepare an empty local default directory without fabricating files', async () => {
    await withStorage(async directory => {
      const local = join(directory, 'new-local');
      await verifyApiStorage([{ name: 'catalog', path: join(local, 'catalog.json') }]);
      assert.deepEqual(await readdir(local), []);
    });
  });

  it('rejects symlinked files/directories and non-file state without touching targets', async () => {
    await withStorage(async directory => {
      const real = join(directory, 'real');
      const alias = join(directory, 'alias');
      await mkdir(real);
      await writeFile(join(real, 'catalog.json'), 'unchanged');
      await symlink(real, alias);
      await assert.rejects(verifyApiStorage([{ name: 'catalog', path: join(alias, 'catalog.json') }]), /preflight failed/);
      const fileAlias = join(directory, 'catalog.json');
      await symlink(join(real, 'catalog.json'), fileAlias);
      await assert.rejects(verifyApiStorage([{ name: 'catalog', path: fileAlias }]), /preflight failed/);
      await assert.rejects(verifyApiStorage([{ name: 'catalog', path: real }]), /preflight failed/);
      assert.equal(await readFile(join(real, 'catalog.json'), 'utf8'), 'unchanged');
    });
  });

  it('refuses hard-linked trust state', async () => {
    await withStorage(async directory => {
      const source = join(directory, 'catalog.json');
      await writeFile(source, 'same inode');
      await link(source, join(directory, 'receipts.json'));
      await assert.rejects(verifyApiStorage([{ name: 'catalog', path: source }]), /preflight failed/);
      await assert.rejects(inspectApiStorage(directory), /Unsupported storage entry/);
    });
  });

  it('fingerprints bytes independently of ownership metadata and notices content changes', async () => {
    await withStorage(async directory => {
      const file = join(directory, 'catalog.json');
      await writeFile(file, 'first', { mode: 0o600 });
      const first = await inspectApiStorage(directory);
      await chmod(file, 0o640);
      const modeChanged = await inspectApiStorage(directory);
      assert.equal(modeChanged.fingerprint, first.fingerprint);
      assert.equal(modeChanged.files[0].mode, 0o640);
      await writeFile(file, 'second');
      assert.notEqual((await inspectApiStorage(directory)).fingerprint, first.fingerprint);
    });
  });

  it('refuses unknown entries and symlinks; preserves filesystem lost+found', async () => {
    await withStorage(async directory => {
      await mkdir(join(directory, 'lost+found'));
      assert.deepEqual((await inspectApiStorage(directory)).files, []);
      await mkdir(join(directory, 'unreviewed-ledger'));
      await assert.rejects(inspectApiStorage(directory), /Unsupported storage entry/);
      await rm(join(directory, 'unreviewed-ledger'), { recursive: true });
      await symlink('/dev/null', join(directory, 'receipts.json'));
      await assert.rejects(inspectApiStorage(directory), /Unsupported storage entry/);
    });
  });

  it('refuses oversized files and inventories beyond the application-file bound', async () => {
    await withStorage(async directory => {
      const file = await open(join(directory, 'catalog.json'), 'wx');
      try {
        await file.truncate(64 * 1024 * 1024 + 1);
      } finally {
        await file.close();
      }
      await assert.rejects(inspectApiStorage(directory), /oversized/);
      await rm(join(directory, 'catalog.json'));
      for (let index = 0; index < 257; index++) {
        await writeFile(join(directory, `catalog.json.${index}.12345678-1234-1234-1234-123456789abc.tmp`), '');
      }
      await assert.rejects(inspectApiStorage(directory), /exceeds the maintenance bound/);
    });
  });

  it('retains recognized interrupted-write files in the inventory', async () => {
    await withStorage(async directory => {
      const name = 'session-revocations.json.123.12345678-1234-1234-1234-123456789abc.tmp';
      await writeFile(join(directory, name), 'synthetic interrupted write');
      assert.equal((await inspectApiStorage(directory)).files[0].name, name);
      assert.equal(await readFile(join(directory, name), 'utf8'), 'synthetic interrupted write');
    });
  });

  it('cannot apply ownership maintenance from an ordinary API user', { skip: process.getuid?.() === 0 }, async () => {
    await withStorage(async directory => {
      const before = await inspectApiStorage(directory);
      await assert.rejects(prepareApiStorage(directory, before.fingerprint), /requires an explicitly selected root/);
      assert.deepEqual(await inspectApiStorage(directory), before);
    });
  });

  it('exits before loading session/catalog services when storage is unreadable', { skip: process.getuid?.() === 0 }, async () => {
    await withStorage(async directory => {
      const blocked = join(directory, 'catalog.json');
      await writeFile(blocked, 'do not reset', { mode: 0o000 });
      try {
        const child = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            NODE_ENV: 'test',
            CATALOG_SNAPSHOT_PATH: blocked,
            SESSION_REVOCATIONS_PATH: join(directory, 'session-revocations.json'),
            NATIVE_CONTRIBUTION_SNAPSHOT_PATH: join(directory, 'receipts.json')
          },
          encoding: 'utf8',
          timeout: 10_000
        });
        assert.equal(child.status, 1, child.stderr);
        assert.match(child.stderr, /API storage preflight failed for CATALOG_SNAPSHOT_PATH/);
        assert.doesNotMatch(child.stdout + child.stderr, /fresh session epoch|Server listening/);
      } finally {
        await chmod(blocked, 0o600);
      }
      assert.equal(await readFile(blocked, 'utf8'), 'do not reset');
    });
  });
});
