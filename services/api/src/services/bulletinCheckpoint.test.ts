import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, link, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture as recoveryFixture, tree } from './bulletinPreparedRecovery.fixture.js';
import { inspectBulletinCheckpoint, copyBulletinCheckpoint, verifyBulletinCheckpoint } from './bulletinCheckpoint.js';
import { checkpointHash } from './bulletinCheckpointFiles.js';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { load, save } from './bulletinMediaState.js';
import type { TestContext } from 'node:test';
import { tmpdir } from 'node:os';
const fixture = async (t: TestContext, mode: 'standard' | 'compact') => recoveryFixture(t, mode, await realpath(tmpdir()));

for (const mode of ['standard', 'compact'] as const) {
  test(`settled ${mode} checkpoint preserves every byte/directory, excludes keys and is not a runnable queue`, async t => {
    const c = await fixture(t, mode);
    await c.execute((await c.inspect()).planSha256);
    await mkdir(join(c.root, 'keys'), { mode: 0o700 });
    await writeFile(c.profile.seedFile, 'never-copy-the-signer', { mode: 0o600 });
    await writeFile(join(c.root, 'content-key.json'), 'never-copy-the-master', { mode: 0o600 });
    const before = await tree(c.root);
    const planned = await inspectBulletinCheckpoint(c.options);
    assert.deepEqual(await tree(c.root), before);
    assert.equal(c.signerLoads, c.closed);
    const destination = join(c.root, 'checkpoint');
    const copied = await copyBulletinCheckpoint({ ...c.options, destination, expectedPlanSha256: planned.report.planSha256 });
    assert.equal(copied.planSha256, planned.report.planSha256);
    assert.equal(copied.secretsIncluded, false);
    assert.equal(copied.writerActivationAllowed, false);
    assert.equal(copied.canonicalHistoryChecked, false);
    assert.deepEqual(copied.requiredKeyVersions, ['dotify-content-key-v3']);
    assert.deepEqual((await readdir(destination)).sort(), ['checkpoint.json', 'objects']);
    const manifest = JSON.parse(await readFile(join(destination, 'checkpoint.json'), 'utf8'));
    assert.ok(manifest.plan.directories.includes('queue/incoming'));
    assert.ok(manifest.plan.files.some((file: { path: string }) => file.path.startsWith('queue/nonces/')));
    assert.ok(manifest.plan.files.some((file: { path: string }) => file.path.startsWith('queue/recoveries/')));
    for (const file of manifest.plan.files) {
      const bytes = await readFile(join(destination, 'objects', `${file.sha256}.bin`));
      assert.equal(bytes.toString('hex'), before[file.path]);
      assert.ok(!bytes.includes(Buffer.from('never-copy-the-')));
    }
    const verified = await verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal);
    assert.deepEqual(verified, copied);
    const after = await tree(c.root);
    for (const [path, bytes] of Object.entries(before)) assert.equal(after[path], bytes);
    // Verification needs only copied objects and the separately retained digest.
    await rm(c.queue, { recursive: true });
    await rm(c.profile.directory, { recursive: true });
    assert.deepEqual(await verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal), copied);
  });
}

test('running/orphan leases, unfinished queue and uncertain inventory refuse before creating output', async t => {
  const c = await fixture(t, 'standard');
  const release = await acquireBulletinPublisherLock(c.profile);
  try {
    await assert.rejects(inspectBulletinCheckpoint(c.options), /EEXIST/);
  } finally {
    await release();
  }
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Unsettled queue/);
  await c.execute((await c.inspect()).planSha256);
  const owner = (await load(join(c.profile.directory, 'owner.json'))) as Record<string, unknown>;
  await save(c.profile.directory, 'owner.json', { ...owner, activeJob: c.name });
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Active publisher/);
  await save(c.profile.directory, 'owner.json', owner);
  const inventory = (await load(join(c.profile.directory, `${c.name}.json`))) as Record<string, unknown>;
  await save(c.profile.directory, `${c.name}.json`, { ...inventory, pending: { unknown: { nonce: 10, afterBlock: 1 } } });
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Unsettled inventory/);
});

test('changed plans, an existing destination and overlapping sources preserve existing data', async t => {
  const c = await fixture(t, 'compact');
  await c.execute((await c.inspect()).planSha256);
  const planned = await inspectBulletinCheckpoint(c.options);
  const file = join(c.queue, 'jobs.json');
  const original = await readFile(file);
  await writeFile(file, Buffer.concat([original, Buffer.from('\n')]));
  const destination = join(c.root, 'checkpoint');
  await assert.rejects(copyBulletinCheckpoint({ ...c.options, destination, expectedPlanSha256: planned.report.planSha256 }), /plan changed/);
  await assert.rejects(readFile(join(destination, 'checkpoint.json')), /ENOENT/);
  await writeFile(file, original);
  await mkdir(destination, { mode: 0o700 });
  await writeFile(join(destination, 'sentinel'), 'retain', { mode: 0o600 });
  await assert.rejects(copyBulletinCheckpoint({ ...c.options, destination, expectedPlanSha256: planned.report.planSha256 }), /EEXIST/);
  assert.equal(await readFile(join(destination, 'sentinel'), 'utf8'), 'retain');
  await assert.rejects(copyBulletinCheckpoint({ ...c.options, destination: join(c.queue, 'copy'), expectedPlanSha256: planned.report.planSha256 }), /overlaps/);
});

test('unknown files, symlinks, hard links, open permissions and missing nonce custody refuse', async t => {
  const c = await fixture(t, 'standard');
  await c.execute((await c.inspect()).planSha256);
  const secret = join(c.queue, 'content-key.json');
  await writeFile(secret, 'do not capture', { mode: 0o600 });
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Unexpected checkpoint file/);
  await rm(secret);
  const file = join(c.queue, 'jobs.json');
  const original = await readFile(file);
  await rm(file);
  await symlink(join(c.root, 'profile.json'), file);
  await assert.rejects(inspectBulletinCheckpoint(c.options), /refuses links/);
  await rm(file);
  await link(join(c.root, 'profile.json'), file);
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Unsafe/);
  await rm(file);
  await writeFile(file, original, { mode: 0o600 });
  await chmod(file, 0o644);
  await assert.rejects(inspectBulletinCheckpoint(c.options), /Unsafe/);
  await chmod(file, 0o600);
  const fingerprints = (await readdir(join(c.queue, 'nonces'))).filter(name => name !== 'ledger.json');
  for (const fingerprint of fingerprints) await rm(join(c.queue, 'nonces', fingerprint), { recursive: true });
  await assert.rejects(inspectBulletinCheckpoint(c.options), /nonce reservation missing/);
});

test('verification rejects a changed object, wrong digest, incomplete marker, links and unexpected contents', async t => {
  const c = await fixture(t, 'compact');
  await c.execute((await c.inspect()).planSha256);
  const planned = await inspectBulletinCheckpoint(c.options);
  const destination = join(c.root, 'checkpoint');
  const copied = await copyBulletinCheckpoint({ ...c.options, destination, expectedPlanSha256: planned.report.planSha256 });
  await assert.rejects(verifyBulletinCheckpoint(destination, '00'.repeat(32), c.options.signal), /separately retained/);
  await writeFile(join(destination, 'INCOMPLETE'), 'interrupted', { mode: 0o600 });
  await assert.rejects(verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal), /Incomplete/);
  await rm(join(destination, 'INCOMPLETE'));
  const object = join(destination, 'objects', `${planned.plan.files[0].sha256}.bin`);
  const original = await readFile(object);
  await writeFile(object, Buffer.from('changed'));
  await assert.rejects(verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal), /object differs/);
  await rm(object);
  await symlink(join(c.root, 'profile.json'), object);
  await assert.rejects(verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal));
  await rm(object);
  await writeFile(object, original, { mode: 0o600 });
  await writeFile(join(destination, 'objects', 'unexpected'), 'extra', { mode: 0o600 });
  await assert.rejects(verifyBulletinCheckpoint(destination, copied.manifestSha256, c.options.signal), /unexpected checkpoint object/);
});

test('bounded manifest is authenticated before parsing logical paths and refuses path traversal', async t => {
  const c = await fixture(t, 'standard');
  await c.execute((await c.inspect()).planSha256);
  const planned = await inspectBulletinCheckpoint(c.options);
  const destination = join(c.root, 'checkpoint');
  await copyBulletinCheckpoint({ ...c.options, destination, expectedPlanSha256: planned.report.planSha256 });
  const file = join(destination, 'checkpoint.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  const original = JSON.stringify(manifest);
  manifest.plan.directories = manifest.plan.directories.filter((path: string) => path !== 'queue');
  manifest.planSha256 = checkpointHash(JSON.stringify(manifest.plan));
  const missingParent = Buffer.from(JSON.stringify(manifest));
  await writeFile(file, missingParent);
  await assert.rejects(verifyBulletinCheckpoint(destination, checkpointHash(missingParent), c.options.signal), /ancestry|Required directory/);
  Object.assign(manifest, JSON.parse(original));
  manifest.plan.files[0].path = '../outside';
  manifest.planSha256 = checkpointHash(JSON.stringify(manifest.plan));
  const bytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(file, bytes);
  await assert.rejects(verifyBulletinCheckpoint(destination, checkpointHash(bytes), c.options.signal));
  await writeFile(file, Buffer.alloc(4 * 1024 * 1024 + 1));
  await assert.rejects(verifyBulletinCheckpoint(destination, checkpointHash(Buffer.alloc(4 * 1024 * 1024 + 1)), c.options.signal), /exceeds bound/);
});

test('CLI inspection has no application environment or signer and prints no file paths or contents', async t => {
  const c = await fixture(t, 'standard');
  await c.execute((await c.inspect()).planSha256);
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/checkpointBulletinCustody.ts', ...args], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH }
    });
  const result = run('inspect', c.queue, c.profileFile);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.writerActivationAllowed, false);
  assert.equal(report.secretsIncluded, false);
  assert.ok(!result.stdout.includes(c.root));
  const destination = join(c.root, 'cli-checkpoint');
  const copy = run('copy', c.queue, c.profileFile, destination, report.planSha256);
  assert.equal(copy.status, 0, copy.stderr);
  const copied = JSON.parse(copy.stdout);
  const verify = run('verify', destination, copied.manifestSha256);
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).planSha256, report.planSha256);
  assert.ok(!copy.stdout.includes(c.root) && !verify.stdout.includes(c.root));
  const refused = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/scripts/checkpointBulletinCustody.ts', 'inspect', '/unavailable-private-path', c.profileFile],
    { encoding: 'utf8', env: { PATH: process.env.PATH } }
  );
  assert.equal(refused.status, 1);
  assert.equal(refused.stdout, '');
  assert.ok(refused.stderr.startsWith('BULLETIN_CHECKPOINT_STOPPED:'));
  assert.ok(!refused.stderr.includes('/unavailable-private-path'));
});

test('aborted operations, directory aliases and legacy pilot refuse without initializing state', async t => {
  const c = await fixture(t, 'standard');
  await c.execute((await c.inspect()).planSha256);
  const before = await tree(c.root);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(inspectBulletinCheckpoint({ ...c.options, signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(
    copyBulletinCheckpoint({ ...c.options, signal: controller.signal, destination: join(c.root, 'aborted'), expectedPlanSha256: '00'.repeat(32) }),
    { name: 'AbortError' }
  );
  assert.deepEqual(await tree(c.root), before);
  const alias = join(c.root, 'queue-alias');
  await symlink(c.queue, alias);
  await assert.rejects(inspectBulletinCheckpoint({ ...c.options, queue: alias }), /aliases/);
  const pilot = await recoveryFixture(t, 'pilot', await realpath(tmpdir()));
  const pilotBefore = await tree(pilot.root);
  await assert.rejects(inspectBulletinCheckpoint(pilot.options), /multi-release/);
  assert.deepEqual(await tree(pilot.root), pilotBefore);
  assert.equal(pilot.signerLoads, 0);
});
