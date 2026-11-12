// Offline data reconstruction only. No app config, key vault, signer,
// transport, queue startup or restoration into an original source path.
import assert from 'node:assert/strict';
import { mkdir, open, readdir, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { readCheckpointManifest, readVerifiedBulletinCheckpoint } from './bulletinCheckpoint.js';
import { canonicalCheckpointDirectory, checkpointFile, checkpointMetadata } from './bulletinCheckpointFiles.js';
import { validateCheckpointState } from './bulletinCheckpointState.js';
import { publisherProfileSchema, type BulletinPublisherProfile } from './bulletinPublisherProfile.js';
import { sync } from './bulletinMediaState.js';

const protectedFiles = new Set(['profile.json', 'queue/publication-store.json', 'publisher/publisher.json']);
const guards = ['queue/publication-store.json', 'publisher/publisher.json'];
const within = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);
const dataPath = (root: string, logical: string) => join(root, 'data', `${logical}${protectedFiles.has(logical) ? '.checkpoint' : ''}`);
const guardBytes = (digest: string) =>
  Buffer.from(JSON.stringify({ schema: 'dotify.bulletin.restored-data-only.v1', manifestSha256: digest, writerActivationAllowed: false }));
const receiptBytes = (digest: string, plan: string) =>
  Buffer.from(
    JSON.stringify({
      schema: 'dotify.bulletin.isolated-restore.v1',
      manifestSha256: digest,
      planSha256: plan,
      writerActivationAllowed: false,
      secretsIncluded: false
    })
  );

type RestorePlan = Awaited<ReturnType<typeof readCheckpointManifest>>['manifest']['plan'];
function originalPaths(plan: RestorePlan, profile: BulletinPublisherProfile) {
  const { queue, publisher, profile: profileFile } = plan.sources;
  for (const path of Object.values(plan.sources)) assert.ok(isAbsolute(path) && resolve(path) === path, 'Canonical saved source required');
  assert.equal(profile.directory, publisher, 'Original publisher path changed');
  assert.ok(!within(queue, publisher) && !within(publisher, queue), 'Original roots overlap');
  assert.ok(!within(queue, profileFile) && !within(publisher, profileFile), 'Original profile overlaps state');
  const signer = resolve(profile.seedFile);
  assert.ok(!within(queue, signer) && !within(publisher, signer), 'Original signer overlaps state');
  return [...Object.values(plan.sources), signer];
}
function assertOutside(destination: string, sources: string[]) {
  for (const source of sources) assert.ok(!within(source, destination) && !within(destination, source), 'Restore overlaps checkpoint or original custody');
}

async function privateWrite(file: string, bytes: Uint8Array) {
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function verifyRestored(root: string, digest: string, signal: AbortSignal, completing: boolean) {
  signal.throwIfAborted();
  await canonicalCheckpointDirectory(root);
  assert.deepEqual(
    (await readdir(root)).sort(),
    [...(completing ? ['INCOMPLETE'] : []), 'checkpoint.json', 'data', 'restore.json'].sort(),
    'Incomplete or unexpected isolated restore'
  );
  const read = await readCheckpointManifest(join(root, 'checkpoint.json'), digest, signal);
  const { plan } = read.manifest;
  assert.deepEqual(
    await checkpointMetadata(join(root, 'restore.json'), 1024, signal),
    receiptBytes(digest, read.manifest.planSha256),
    'Restore receipt changed'
  );
  const expectedDirectories = new Set(['data', ...plan.directories.map(path => `data/${path}`)]);
  const expectedFiles = new Set(
    [...plan.files.map(file => `${file.path}${protectedFiles.has(file.path) ? '.checkpoint' : ''}`), ...guards].map(path => `data/${path}`)
  );
  const directories = new Set<string>();
  const files = new Set<string>();
  const visit = async (path: string) => {
    signal.throwIfAborted();
    assert.ok(expectedDirectories.has(path) && !directories.has(path), 'Unexpected restored directory');
    const directory = join(root, path);
    await canonicalCheckpointDirectory(directory);
    directories.add(path);
    const entries = await readdir(directory, { withFileTypes: true });
    assert.ok(entries.length <= expectedDirectories.size + expectedFiles.size, 'Restore directory exceeds bound');
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      assert.ok(!entry.isSymbolicLink(), 'Restore refuses links');
      if (entry.isDirectory()) await visit(child);
      else {
        assert.ok(entry.isFile() && expectedFiles.has(child), 'Unexpected restored file');
        files.add(child);
      }
    }
  };
  await visit('data');
  assert.deepEqual([...directories].sort(), [...expectedDirectories].sort(), 'Missing restored directory');
  assert.deepEqual([...files].sort(), [...expectedFiles].sort(), 'Missing restored file');
  for (const guard of guards)
    assert.deepEqual(await checkpointMetadata(join(root, 'data', guard), 1024, signal), guardBytes(digest), 'Writer refusal barrier changed');
  for (const file of plan.files) {
    const actual = await checkpointFile(dataPath(root, file.path), undefined, signal);
    assert.deepEqual(actual, { bytes: file.bytes, sha256: file.sha256 }, 'Restored data differs from checkpoint');
  }
  // Same local coherence rules as source capture. The view maps every read
  // into this workspace, including archived ORIGINAL binding bytes; neither
  // saved profile.directory nor plan.sources becomes a filesystem target.
  const state = await validateCheckpointState({ files: plan.files, directories: plan.directories, pathFor: logical => dataPath(root, logical) }, signal);
  assertOutside(root, originalPaths(plan, state.profile));
  assert.equal(state.profileSha256, plan.profileSha256);
  assert.deepEqual(state.requiredKeyVersions, plan.requiredKeyVersions);
  assert.equal(state.queueJobs, plan.queueJobs);
  assert.equal(state.inventories, plan.inventories);
  return { ...read.report, manifestSha256: digest, isolatedRestore: true, ciphertextAuthenticated: false };
}

export async function verifyIsolatedBulletinRestore(root: string, digest: string, signal: AbortSignal) {
  return verifyRestored(root, digest, signal, false);
}

export async function restoreIsolatedBulletinCheckpoint(options: {
  checkpoint: string;
  destination: string;
  expectedManifestSha256: string;
  signal: AbortSignal;
}) {
  const { checkpoint, destination, expectedManifestSha256: digest, signal } = options;
  signal.throwIfAborted();
  const read = await readVerifiedBulletinCheckpoint(checkpoint, digest, signal);
  const { plan } = read.manifest;
  const profileEntry = plan.files.find(file => file.path === 'profile.json')!;
  const profile = publisherProfileSchema.parse(
    JSON.parse((await checkpointMetadata(join(checkpoint, 'objects', `${profileEntry.sha256}.bin`), 2 * 1024 * 1024, signal)).toString('utf8'))
  );
  assert.ok(isAbsolute(destination) && resolve(destination) === destination, 'Canonical restore destination required');
  // These are lexical checks only. NEVER probe, create or rewrite a saved
  // source path, including when all originals have been lost.
  assertOutside(destination, [checkpoint, ...originalPaths(plan, profile)]);
  await canonicalCheckpointDirectory(dirname(destination));
  await mkdir(destination, { mode: 0o700 }); // Exclusive; no overwrite or resume.
  await privateWrite(join(destination, 'INCOMPLETE'), Buffer.from('isolated data restore in progress\n'));
  await sync(destination);
  await mkdir(join(destination, 'data'), { mode: 0o700 });
  for (const directory of ['queue', 'publisher']) await mkdir(join(destination, 'data', directory), { mode: 0o700 });
  // Poison normal publication bindings BEFORE materializing operational data.
  // Preserve original bytes under .checkpoint, never at the service entrypoint.
  for (const guard of guards) await privateWrite(join(destination, 'data', guard), guardBytes(digest));
  for (const directory of plan.directories
    .filter(path => !['queue', 'publisher'].includes(path))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))) {
    signal.throwIfAborted();
    await mkdir(join(destination, 'data', directory), { mode: 0o700 });
  }
  for (const file of plan.files) {
    signal.throwIfAborted();
    // Separate regular files, never hard links to the immutable input or to
    // another reconstructed name. Normal private readers require nlink === 1.
    const actual = await checkpointFile(join(checkpoint, 'objects', `${file.sha256}.bin`), dataPath(destination, file.path), signal);
    assert.deepEqual(actual, { bytes: file.bytes, sha256: file.sha256 }, 'Checkpoint changed during restore');
  }
  await privateWrite(join(destination, 'checkpoint.json'), read.bytes);
  await privateWrite(join(destination, 'restore.json'), receiptBytes(digest, read.manifest.planSha256));
  const result = await verifyRestored(destination, digest, signal, true);
  for (const directory of [...plan.directories].sort((a, b) => b.split('/').length - a.split('/').length)) await sync(join(destination, 'data', directory));
  await sync(join(destination, 'data'));
  await sync(destination);
  signal.throwIfAborted();
  await rm(join(destination, 'INCOMPLETE'));
  await sync(destination);
  await sync(dirname(destination));
  return result;
}
