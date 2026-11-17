import assert from 'node:assert/strict';
import { describe, before, after, it } from 'node:test';
import { mkdtemp, writeFile, readFile, rm, mkdir, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareRestoreRehearsal, restoreRehearsal, readRestoreBundle, backupDigest } from './bulletinRestoreRehearsal.fixture.js';

describe('generated Bulletin backup and restore', () => {
  let root: string, file: string, bytes: Buffer, digest: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dotify-backup-test-'));
    file = join(root, 'bundle.json');
    const prepared = await prepareRestoreRehearsal();
    bytes = prepared.bytes;
    digest = prepared.sha256;
    await writeFile(file, bytes, { mode: 0o600 });
  });
  after(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });
  it('recovers and authenticates both layouts after source loss, and refuses six inconsistent states per layout', async () => {
    const report = await restoreRehearsal(file, digest);
    assert.equal(report.cases.length, 14);
    assert.equal(report.cases.filter(c => c.outcome === 'recovered-and-authenticated').length, 2);
    assert.equal(report.productionTouched, false);
    assert.equal(report.historicalBinaryRollbackTested, false);
    assert.deepEqual(await readFile(file), bytes, 'consumer must never edit its retained backup');
  });
  it('checks the separately retained digest before parsing any paths', async () => {
    await assert.rejects(readRestoreBundle(file, '00'.repeat(32)), /separately retained/);
  });
  it('refuses unsafe paths, missing empty directories, absent ancestry and oversized input', async () => {
    for (const kind of ['path', 'empty', 'ancestry', 'oversized']) {
      const value = JSON.parse(bytes.toString('utf8'));
      if (kind === 'path') value.snapshots[0].files['queue/../../outside'] = '00';
      else if (kind === 'empty') value.snapshots[0].directories = value.snapshots[0].directories.filter((d: string) => d !== 'queue/incoming');
      else if (kind === 'ancestry') value.snapshots[0].directories.push('queue/absent/child');
      const input = kind === 'oversized' ? Buffer.alloc(4 * 1024 * 1024 + 1) : Buffer.from(JSON.stringify(value));
      const candidate = join(root, `${kind}.json`);
      await writeFile(candidate, input, { mode: 0o600 });
      await assert.rejects(readRestoreBundle(candidate, backupDigest(input)));
    }
  });
  it('refuses an existing destination without changing or deleting it', async () => {
    const bundle = await readRestoreBundle(file, digest);
    const target = join(await realpath('/tmp'), bundle.snapshots[0].rootName);
    await mkdir(target, { mode: 0o700 });
    try {
      await writeFile(join(target, 'sentinel'), 'existing state', { mode: 0o600 });
      await assert.rejects(restoreRehearsal(file, digest), /EEXIST/);
      assert.equal(await readFile(join(target, 'sentinel'), 'utf8'), 'existing state');
    } finally {
      await rm(target, { recursive: true });
    }
  });
  it('does not follow a bundle symlink', async () => {
    const link = join(root, 'linked.json');
    await symlink(file, link);
    await assert.rejects(readRestoreBundle(link, digest));
  });
});
