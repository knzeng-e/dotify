// Stopped-writer, settled multi-release DATA only. No configuration, vault,
// signer, network, queue startup, restore or directory initialization imports.
import assert from 'node:assert/strict';
import { mkdir, open, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { acquireBulletinPublisherLock } from './bulletinPublisherLock.js';
import { publisherProfileSchema } from './bulletinPublisherProfile.js';
import { sync } from './bulletinMediaState.js';
import { validateCheckpointState } from './bulletinCheckpointState.js';
import {
  CHECKPOINT_MAX_BYTES,
  CHECKPOINT_MAX_FILES,
  canonicalCheckpointDirectory,
  checkpointFile,
  checkpointHash,
  checkpointMetadata,
  checkpointPath,
  checkpointTree,
  type CheckpointEntry
} from './bulletinCheckpointFiles.js';

const hex = z.string().regex(/^[0-9a-f]{64}$/);
const planSchema = z
  .object({
    schema: z.literal('dotify.bulletin.checkpoint-plan.v1'),
    sources: z.object({ queue: z.string(), publisher: z.string(), profile: z.string() }).strict(),
    profileSha256: hex,
    requiredKeyVersions: z
      .array(
        z
          .string()
          .max(80)
          .regex(/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/)
      )
      .max(64),
    queueJobs: z.number().int().min(0).max(64),
    inventories: z.number().int().min(0).max(192),
    totalBytes: z.number().int().min(1).max(CHECKPOINT_MAX_BYTES),
    directories: z.array(z.string().max(256)).max(CHECKPOINT_MAX_FILES),
    files: z
      .array(
        z
          .object({
            path: z.string().max(256),
            bytes: z
              .number()
              .int()
              .min(1)
              .max(50 * 1024 * 1024 + 16),
            sha256: hex
          })
          .strict()
      )
      .min(1)
      .max(CHECKPOINT_MAX_FILES)
  })
  .strict();
type Plan = z.infer<typeof planSchema>;
type Options = { queue: string; profileFile: string; signal: AbortSignal };
const manifestSchema = z
  .object({
    schema: z.literal('dotify.bulletin.data-checkpoint.v1'),
    writerActivationAllowed: z.literal(false),
    secretsIncluded: z.literal(false),
    createdAt: z.string().datetime(),
    planSha256: hex,
    plan: planSchema
  })
  .strict();
const within = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);
const report = (plan: Plan) => ({
  planSha256: checkpointHash(JSON.stringify(plan)),
  files: plan.files.length,
  directories: plan.directories.length,
  totalBytes: plan.totalBytes,
  queueJobs: plan.queueJobs,
  inventories: plan.inventories,
  requiredKeyVersions: plan.requiredKeyVersions,
  secretsIncluded: false,
  writerActivationAllowed: false,
  canonicalHistoryChecked: false,
  independentStorageVerified: false
});

async function sourcePaths(options: Options) {
  options.signal.throwIfAborted();
  await canonicalCheckpointDirectory(options.queue);
  assert.ok(isAbsolute(options.profileFile) && resolve(options.profileFile) === options.profileFile, 'Canonical profile path required');
  await canonicalCheckpointDirectory(dirname(options.profileFile));
  const profile = publisherProfileSchema.parse(JSON.parse((await checkpointMetadata(options.profileFile, 2 * 1024 * 1024, options.signal)).toString('utf8')));
  assert.ok(profile.releasePolicy && !profile.pilotScope, 'Checkpoint supports the settled multi-release store only');
  await canonicalCheckpointDirectory(profile.directory);
  assert.ok(!within(options.queue, profile.directory) && !within(profile.directory, options.queue), 'Checkpoint roots must be separate');
  assert.ok(!within(options.queue, options.profileFile) && !within(profile.directory, options.profileFile), 'Keep the profile outside state roots');
  assert.ok(!within(options.queue, resolve(profile.seedFile)), 'Keep the signer outside checkpoint roots');
  return profile;
}

async function inspectLocked(options: Options, profile: Awaited<ReturnType<typeof sourcePaths>>): Promise<Plan> {
  const { queue, profileFile, signal } = options;
  const profileData = await checkpointFile(profileFile, undefined, signal);
  const budget = { files: 1, directories: 0, bytes: profileData.bytes };
  const roots = [await checkpointTree(queue, 'queue', signal, budget), await checkpointTree(profile.directory, 'publisher', signal, budget)];
  const files: CheckpointEntry[] = [...roots[0].files, ...roots[1].files, { path: 'profile.json', ...profileData }].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
  const directories = roots.flatMap(root => root.directories).sort();
  assert.ok(files.length <= CHECKPOINT_MAX_FILES && directories.length <= CHECKPOINT_MAX_FILES, 'Checkpoint exceeds entry bound');
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(totalBytes <= CHECKPOINT_MAX_BYTES, 'Checkpoint exceeds total byte bound');
  for (const required of ['queue/incoming', 'queue/jobs', 'queue/nonces', 'publisher'])
    assert.ok(directories.includes(required), 'Required state directory missing');
  const state = await validateCheckpointState(
    {
      files,
      directories,
      pathFor: logical =>
        logical === 'profile.json' ? profileFile : join(logical.startsWith('queue/') ? queue : profile.directory, logical.slice(logical.indexOf('/') + 1))
    },
    signal
  );
  assert.deepEqual(state.profile, profile, 'Checkpoint profile changed');
  const plan = planSchema.parse({
    schema: 'dotify.bulletin.checkpoint-plan.v1',
    sources: { queue, publisher: profile.directory, profile: profileFile },
    profileSha256: state.profileSha256,
    requiredKeyVersions: state.requiredKeyVersions,
    queueJobs: state.queueJobs,
    inventories: state.inventories,
    totalBytes,
    directories,
    files
  });
  validatePlan(plan);
  return plan;
}

/** Envelope checks; local state is checked separately through a bounded read-only view. */
function validatePlan(plan: Plan) {
  const names = new Set(plan.files.map(file => file.path));
  const directories = new Set(plan.directories);
  assert.equal(names.size, plan.files.length);
  assert.equal(directories.size, plan.directories.length);
  assert.equal(
    plan.totalBytes,
    plan.files.reduce((sum, file) => sum + file.bytes, 0)
  );
  for (const path of plan.directories) {
    assert.ok(checkpointPath(path, true));
    if (dirname(path) !== '.') assert.ok(directories.has(dirname(path)), 'Missing checkpoint ancestry');
  }
  for (const path of ['queue', 'publisher', 'queue/incoming', 'queue/jobs', 'queue/nonces']) assert.ok(directories.has(path), 'Required directory missing');
  for (const path of [
    'profile.json',
    'queue/jobs.json',
    'queue/publication-store.json',
    'queue/nonces/ledger.json',
    'publisher/owner.json',
    'publisher/publisher.json',
    'publisher/release-admission.json'
  ])
    assert.ok(names.has(path), 'Required file missing');
  for (const file of plan.files) {
    assert.ok(checkpointPath(file.path, false));
    if (file.path.endsWith('.json')) assert.ok(file.bytes <= 2 * 1024 * 1024, 'Checkpoint logical JSON exceeds bound');
    if (dirname(file.path) !== '.') assert.ok(directories.has(dirname(file.path)), 'Missing checkpoint ancestry');
  }
}
async function verifyObjects(plan: Plan, objects: string, signal: AbortSignal) {
  await canonicalCheckpointDirectory(objects);
  assert.deepEqual(
    (await readdir(objects)).sort(),
    [...new Set(plan.files.map(file => `${file.sha256}.bin`))].sort(),
    'Missing or unexpected checkpoint object'
  );
  const seen = new Map<string, number>();
  for (const file of plan.files) {
    signal.throwIfAborted();
    if (seen.has(file.sha256)) {
      assert.equal(seen.get(file.sha256), file.bytes);
      continue;
    }
    const object = await checkpointFile(join(objects, `${file.sha256}.bin`), undefined, signal);
    assert.deepEqual(object, { bytes: file.bytes, sha256: file.sha256 }, 'Checkpoint object differs from its plan');
    seen.set(file.sha256, file.bytes);
  }
  return seen.size;
}

export async function inspectBulletinCheckpoint(options: Options) {
  const profile = await sourcePaths(options);
  const release = await acquireBulletinPublisherLock(profile);
  try {
    const plan = await inspectLocked(options, profile);
    return { plan, report: report(plan) };
  } finally {
    await release();
  }
}

export async function copyBulletinCheckpoint(options: Options & { destination: string; expectedPlanSha256: string }) {
  assert.match(options.expectedPlanSha256, /^[0-9a-f]{64}$/);
  const profile = await sourcePaths(options);
  assert.ok(isAbsolute(options.destination) && resolve(options.destination) === options.destination, 'Canonical checkpoint destination required');
  await canonicalCheckpointDirectory(dirname(options.destination));
  for (const source of [options.queue, profile.directory, options.profileFile])
    assert.ok(!within(source, options.destination) && !within(options.destination, source), 'Checkpoint destination overlaps source');
  assert.ok(!within(options.destination, resolve(profile.seedFile)), 'Checkpoint destination contains the signer');
  const release = await acquireBulletinPublisherLock(profile);
  try {
    const plan = await inspectLocked(options, profile);
    assert.equal(report(plan).planSha256, options.expectedPlanSha256, 'Checkpoint plan changed; inspect again');
    await mkdir(options.destination, { mode: 0o700 }); // Exclusive; never overwrite/delete an existing copy.
    await writeFile(join(options.destination, 'INCOMPLETE'), 'data-only checkpoint in progress\n', { flag: 'wx', mode: 0o600 });
    await sync(options.destination);
    const objects = join(options.destination, 'objects');
    await mkdir(objects, { mode: 0o700 });
    const copied = new Set<string>();
    for (const file of plan.files) {
      options.signal.throwIfAborted();
      const path =
        file.path === 'profile.json'
          ? options.profileFile
          : join(file.path.startsWith('queue/') ? options.queue : profile.directory, file.path.slice(file.path.indexOf('/') + 1));
      const data = await checkpointFile(path, copied.has(file.sha256) ? undefined : join(objects, `${file.sha256}.bin`), options.signal);
      assert.deepEqual(data, { bytes: file.bytes, sha256: file.sha256 }, 'Checkpoint source changed during copy');
      copied.add(file.sha256);
    }
    assert.deepEqual(await inspectLocked(options, profile), plan, 'Checkpoint source changed during copy');
    await sync(objects);
    // Read the destination back before making a completed checkpoint visible.
    await verifyObjects(plan, objects, options.signal);
    options.signal.throwIfAborted();
    const manifest = manifestSchema.parse({
      schema: 'dotify.bulletin.data-checkpoint.v1',
      writerActivationAllowed: false,
      secretsIncluded: false,
      createdAt: new Date().toISOString(),
      planSha256: options.expectedPlanSha256,
      plan
    });
    const bytes = Buffer.from(JSON.stringify(manifest));
    assert.ok(bytes.length <= 4 * 1024 * 1024, 'Checkpoint manifest exceeds bound');
    const manifestFile = await open(join(options.destination, 'checkpoint.json'), 'wx', 0o600);
    try {
      await manifestFile.writeFile(bytes);
      await manifestFile.sync();
    } finally {
      await manifestFile.close();
    }
    await sync(options.destination);
    await rm(join(options.destination, 'INCOMPLETE'));
    await sync(options.destination);
    await sync(dirname(options.destination));
    return { ...report(plan), manifestSha256: checkpointHash(bytes), objects: copied.size };
  } finally {
    await release();
  }
}

/** Same bounded manifest bytes are hashed and parsed; source paths are never opened. */
export async function readCheckpointManifest(file: string, expectedManifestSha256: string, signal: AbortSignal) {
  assert.match(expectedManifestSha256, /^[0-9a-f]{64}$/);
  const bytes = await checkpointMetadata(file, 4 * 1024 * 1024, signal);
  assert.equal(checkpointHash(bytes), expectedManifestSha256, 'Checkpoint differs from separately retained digest');
  const manifest = manifestSchema.parse(JSON.parse(bytes.toString('utf8')));
  assert.equal(manifest.planSha256, report(manifest.plan).planSha256, 'Checkpoint plan digest changed');
  validatePlan(manifest.plan);
  return { bytes, manifest, report: report(manifest.plan) };
}
export async function readVerifiedBulletinCheckpoint(destination: string, expectedManifestSha256: string, signal: AbortSignal) {
  await canonicalCheckpointDirectory(destination);
  assert.deepEqual((await readdir(destination)).sort(), ['checkpoint.json', 'objects'], 'Incomplete or unexpected checkpoint contents');
  const read = await readCheckpointManifest(join(destination, 'checkpoint.json'), expectedManifestSha256, signal);
  const objects = await verifyObjects(read.manifest.plan, join(destination, 'objects'), signal);
  return { ...read, report: { ...read.report, manifestSha256: expectedManifestSha256, objects } };
}
export async function verifyBulletinCheckpoint(destination: string, expectedManifestSha256: string, signal: AbortSignal) {
  return (await readVerifiedBulletinCheckpoint(destination, expectedManifestSha256, signal)).report;
}
